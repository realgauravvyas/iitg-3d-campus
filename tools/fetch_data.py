"""Download the raw open data used to build the IIT Guwahati 3D campus.

Sources (all free / open):
  * OpenStreetMap via the Overpass API (ODbL) - campus boundary, buildings,
    roads, footpaths, lakes, sports grounds, landuse, trees, named places.
  * AWS Open Data "Terrain Tiles" (Mapzen terrarium PNGs; SRTM/NASADEM for
    this region) - ground elevation, so hills around the hostels are real.

Everything is clipped later (process_data.py) to the official campus
boundary: OSM way 52435139 "Indian Institute of Technology Guwahati".

Usage:  python tools/fetch_data.py
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
UA = "IITG-3D-Campus/1.0 (personal, non-commercial campus explorer)"
CAMPUS_WAY = 52435139
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
TERRAIN_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
TERRAIN_ZOOM = 15


def overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for attempt in range(4):
        for url in OVERPASS:
            try:
                req = urllib.request.Request(url, data=body, headers={
                    "User-Agent": UA, "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=240) as r:
                    txt = r.read().decode("utf-8")
                if txt.lstrip().startswith("{"):
                    return json.loads(txt)
                last = txt[:300]
            except Exception as e:  # noqa: BLE001 - retry any network error
                last = repr(e)
            print(f"  overpass {url} failed: {last}", file=sys.stderr)
        time.sleep(8 * (attempt + 1))
    raise RuntimeError(f"Overpass failed: {last}")


def fetch_osm():
    q = f"""
[out:json][timeout:240];
way({CAMPUS_WAY})->.b;
.b map_to_area->.campus;
(
  .b;
  way["building"](area.campus);
  relation["building"](area.campus);
  way["building:part"](area.campus);
  way["highway"](area.campus);
  way["natural"](area.campus);
  relation["natural"](area.campus);
  way["water"](area.campus);
  relation["water"](area.campus);
  way["waterway"](area.campus);
  way["landuse"](area.campus);
  relation["landuse"](area.campus);
  way["leisure"](area.campus);
  relation["leisure"](area.campus);
  way["amenity"](area.campus);
  relation["amenity"](area.campus);
  way["sport"](area.campus);
  way["man_made"](area.campus);
  way["barrier"](area.campus);
  way["tourism"](area.campus);
  way["place"](area.campus);
  way["parking"](area.campus);
  node["name"](area.campus);
  node["amenity"](area.campus);
  node["natural"="tree"](area.campus);
  node["highway"](area.campus);
  node["entrance"](area.campus);
  node["barrier"="gate"](area.campus);
  node["tourism"](area.campus);
  node["leisure"](area.campus);
  node["shop"](area.campus);
);
out geom;
"""
    print("Downloading OpenStreetMap features inside the IITG boundary ...")
    data = overpass(q)
    path = os.path.join(RAW, "osm_campus.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    print(f"  {len(data['elements'])} elements -> {path}")
    return data


def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n
    return x, y


def fetch_terrain(osm):
    b = next(e for e in osm["elements"] if e["type"] == "way" and e["id"] == CAMPUS_WAY)
    lats = [p["lat"] for p in b["geometry"]]
    lons = [p["lon"] for p in b["geometry"]]
    pad = 0.004
    west, east = min(lons) - pad, max(lons) + pad
    south, north = min(lats) - pad, max(lats) + pad
    x0, y0 = lonlat_to_tile(west, north, TERRAIN_ZOOM)
    x1, y1 = lonlat_to_tile(east, south, TERRAIN_ZOOM)
    tdir = os.path.join(RAW, "terrain")
    os.makedirs(tdir, exist_ok=True)
    tiles = []
    for tx in range(int(x0), int(x1) + 1):
        for ty in range(int(y0), int(y1) + 1):
            fn = os.path.join(tdir, f"{TERRAIN_ZOOM}_{tx}_{ty}.png")
            if not os.path.exists(fn):
                url = TERRAIN_URL.format(z=TERRAIN_ZOOM, x=tx, y=ty)
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r, open(fn, "wb") as f:
                    f.write(r.read())
            tiles.append([tx, ty])
    meta = {"zoom": TERRAIN_ZOOM, "tiles": tiles,
            "bbox": [west, south, east, north]}
    with open(os.path.join(tdir, "meta.json"), "w") as f:
        json.dump(meta, f)
    print(f"Downloaded {len(tiles)} elevation tiles (zoom {TERRAIN_ZOOM}).")


if __name__ == "__main__":
    os.makedirs(RAW, exist_ok=True)
    osm = fetch_osm()
    fetch_terrain(osm)
    print("Done. Next: python tools/process_data.py")
