"""Download land cover + true-colour ground imagery for the IITG bbox.

  * ESA WorldCover 2021 v200 (10 m, CC BY 4.0) - tells us where the real
    tree cover, grass, bare ground and water are, so forests on the campus
    hills are placed where they actually grow. Read as a window from the
    Cloud-Optimised GeoTIFF on AWS with HTTP range requests (only the few
    internal tiles covering the campus are downloaded, not the 99 MB file).
  * Sentinel-2 cloudless 2024 by EOX (s2maps.eu, CC BY-NC-SA 4.0, contains
    modified Copernicus Sentinel data) - real ground colour at ~10 m.

Usage:  python tools/fetch_landcover.py   (after fetch_data.py)
"""
import io
import json
import math
import os
import urllib.request

import numpy as np
import tifffile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
UA = "IITG-3D-Campus/1.0 (personal, non-commercial campus explorer)"
WC_URL = ("https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
          "ESA_WorldCover_10m_2021_v200_N24E090_Map.tif")
S2_URL = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg"
S2_ZOOM = 16


class HttpRangeFile(io.RawIOBase):
    """Minimal seekable read-only file over HTTP range requests (block cached)."""
    BLOCK = 1 << 16

    def __init__(self, url):
        self.url, self.pos, self.cache = url, 0, {}
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def _block(self, i):
        if i not in self.cache:
            a = i * self.BLOCK
            b = min(self.size, a + self.BLOCK) - 1
            req = urllib.request.Request(self.url, headers={
                "User-Agent": UA, "Range": f"bytes={a}-{b}"})
            with urllib.request.urlopen(req, timeout=60) as r:
                self.cache[i] = r.read()
        return self.cache[i]

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        out = bytearray()
        while n > 0 and self.pos < self.size:
            i, o = divmod(self.pos, self.BLOCK)
            chunk = self._block(i)[o:o + n]
            out += chunk
            self.pos += len(chunk)
            n -= len(chunk)
        return bytes(out)

    def readinto(self, b):
        data = self.read(len(b))
        b[:len(data)] = data
        return len(data)


def bbox():
    meta = json.load(open(os.path.join(RAW, "terrain", "meta.json")))
    return meta["bbox"]  # west, south, east, north (already padded)


def fetch_worldcover(w, s, e, n):
    print("Reading ESA WorldCover window via HTTP range requests ...")
    fh = HttpRangeFile(WC_URL)
    with tifffile.TiffFile(fh) as tif:
        page = tif.pages[0]
        H, W = page.shape[:2]
        tw, th = page.tilewidth, page.tilelength
        # tile covers lon 90..93, lat 27..24 -> 3 deg / W px
        px = 3.0 / W
        x0 = int((w - 90.0) / px); x1 = int(math.ceil((e - 90.0) / px))
        y0 = int((27.0 - n) / px); y1 = int(math.ceil((27.0 - s) / px))
        tiles_across = (W + tw - 1) // tw
        out = np.zeros((y1 - y0, x1 - x0), np.uint8)
        offs, cnts = page.dataoffsets, page.databytecounts
        for ty in range(y0 // th, (y1 - 1) // th + 1):
            for tx in range(x0 // tw, (x1 - 1) // tw + 1):
                idx = ty * tiles_across + tx
                fh.seek(offs[idx])
                seg, _, shape = page.decode(fh.read(cnts[idx]), idx)
                tile = np.asarray(seg).reshape(shape[1], shape[2])
                gy0, gx0 = ty * th, tx * tw
                ya, yb = max(y0, gy0), min(y1, gy0 + th)
                xa, xb = max(x0, gx0), min(x1, gx0 + tw)
                out[ya - y0:yb - y0, xa - x0:xb - x0] = tile[ya - gy0:yb - gy0, xa - gx0:xb - gx0]
    Image.fromarray(out).save(os.path.join(RAW, "worldcover.png"))
    meta = {"bbox": [90.0 + x0 * px, 27.0 - y1 * px, 90.0 + x1 * px, 27.0 - y0 * px],
            "classes": {"10": "tree", "20": "shrub", "30": "grass", "40": "crop",
                        "50": "built", "60": "bare", "80": "water", "90": "wetland"}}
    json.dump(meta, open(os.path.join(RAW, "worldcover.json"), "w"))
    vals, cnt = np.unique(out, return_counts=True)
    print("  classes:", dict(zip(vals.tolist(), cnt.tolist())))


def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def fetch_s2(w, s, e, n):
    print("Downloading Sentinel-2 cloudless imagery tiles ...")
    z = S2_ZOOM
    fx0, fy0 = lonlat_to_tile(w, n, z)
    fx1, fy1 = lonlat_to_tile(e, s, z)
    tx0, ty0, tx1, ty1 = int(fx0), int(fy0), int(fx1), int(fy1)
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            url = S2_URL.format(z=z, x=tx, y=ty)
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                im = Image.open(io.BytesIO(r.read())).convert("RGB")
            mosaic.paste(im, ((tx - tx0) * 256, (ty - ty0) * 256))
    # crop to the exact bbox (web-mercator pixel space)
    crop = (int((fx0 - tx0) * 256), int((fy0 - ty0) * 256),
            int((fx1 - tx0) * 256), int((fy1 - ty0) * 256))
    mosaic.crop(crop).save(os.path.join(RAW, "s2cloudless.jpg"), quality=92)
    json.dump({"bbox": [w, s, e, n], "zoom": z, "projection": "webmercator"},
              open(os.path.join(RAW, "s2cloudless.json"), "w"))
    print(f"  {tx1 - tx0 + 1}x{ty1 - ty0 + 1} tiles -> s2cloudless.jpg")


if __name__ == "__main__":
    w, s, e, n = bbox()
    fetch_worldcover(w, s, e, n)
    fetch_s2(w, s, e, n)
