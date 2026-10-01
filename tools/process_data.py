"""Turn the raw open data into the game's campus model (data/campus.json + textures).

Everything is projected to local metres (x = east, y = north) around the
campus centroid and clipped to the official IITG boundary (OSM way 52435139).
Nothing outside the campus wall is exported.

Outputs
  data/campus.json   buildings, roads + road graph, lakes, sports fields,
                     trees, terrain heightmap, landmarks, gates
  data/ground.jpg    ground colour texture (land cover + Sentinel-2 + painted fields/roads)
  data/mask.png      campus-shape alpha mask for the ground

Usage:  python tools/process_data.py
"""
import base64
import hashlib
import json
import math
import os
from collections import defaultdict

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from shapely import contains_xy
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, shape
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data")
CAMPUS_WAY = 52435139
TERRAIN_CELL = 6.0      # metres per heightmap sample
GROUND_RES = 1.0        # metres per ground-texture pixel
PAD = 70.0              # metres of margin around the boundary

rng = np.random.default_rng(1994)  # IITG founded 1994; deterministic output


def stable_rand(key: str) -> float:
    return int(hashlib.md5(key.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


# --------------------------------------------------------------------------- projection
osm = json.load(open(os.path.join(RAW, "osm_campus.json"), encoding="utf-8"))
els = osm["elements"]
bway = next(e for e in els if e["type"] == "way" and e["id"] == CAMPUS_WAY)
LON0 = sum(p["lon"] for p in bway["geometry"]) / len(bway["geometry"])
LAT0 = sum(p["lat"] for p in bway["geometry"]) / len(bway["geometry"])
phi = math.radians(LAT0)
KY = 111132.92 - 559.82 * math.cos(2 * phi) + 1.175 * math.cos(4 * phi)
KX = 111412.84 * math.cos(phi) - 93.5 * math.cos(3 * phi)


def proj(lon, lat):
    return ((lon - LON0) * KX, (lat - LAT0) * KY)


def unproj(x, y):
    return (LON0 + x / KX, LAT0 + y / KY)


boundary = Polygon([proj(p["lon"], p["lat"]) for p in bway["geometry"]]).buffer(0)
bprep = prep(boundary)
inside_loose = prep(boundary.buffer(12))
minx, miny, maxx, maxy = boundary.bounds
minx, miny, maxx, maxy = minx - PAD, miny - PAD, maxx + PAD, maxy + PAD
print(f"Campus area: {boundary.area / 1e4:.1f} ha  extent {maxx - minx:.0f} x {maxy - miny:.0f} m")


def r1(v):
    return round(v, 1)


def ring_out(coords):
    c = list(coords)
    if len(c) > 1 and c[0] == c[-1]:
        c = c[:-1]
    return [[r1(x), r1(y)] for x, y in c]


def polys_of(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def way_poly(e):
    pts = [proj(p["lon"], p["lat"]) for p in e["geometry"]]
    if len(pts) < 4:
        return None
    return Polygon(pts).buffer(0)


def rel_poly(e):
    outers, inners = [], []
    for m in e.get("members", []):
        if m.get("type") != "way" or "geometry" not in m:
            continue
        pts = [proj(p["lon"], p["lat"]) for p in m["geometry"]]
        (inners if m.get("role") == "inner" else outers).append(pts)
    # stitch open outer segments into rings
    rings = []
    segs = [s for s in outers]
    while segs:
        ring = segs.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]; segs.pop(i); changed = True; break
                if s[-1] == ring[-1]:
                    ring += s[::-1][1:]; segs.pop(i); changed = True; break
        if len(ring) >= 4:
            rings.append(Polygon(ring).buffer(0))
    if not rings:
        return None
    outer = unary_union(rings)
    for pts in inners:
        if len(pts) >= 4:
            outer = outer.difference(Polygon(pts).buffer(0))
    return outer


def feature_poly(e):
    if e["type"] == "way":
        return way_poly(e)
    if e["type"] == "relation":
        return rel_poly(e)
    return None


# --------------------------------------------------------------------------- terrain
print("Building heightmap ...")
tmeta = json.load(open(os.path.join(RAW, "terrain", "meta.json")))
Z = tmeta["zoom"]
tiles = {}
for tx, ty in tmeta["tiles"]:
    a = np.asarray(Image.open(os.path.join(RAW, "terrain", f"{Z}_{tx}_{ty}.png")).convert("RGB")).astype(np.float64)
    tiles[(tx, ty)] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
txs = sorted({t[0] for t in tiles}); tys = sorted({t[1] for t in tiles})
big = np.zeros((len(tys) * 256, len(txs) * 256))
for (tx, ty), h in tiles.items():
    big[(ty - tys[0]) * 256:(ty - tys[0] + 1) * 256, (tx - txs[0]) * 256:(tx - txs[0] + 1) * 256] = h
big = np.clip(big, 38, None)  # river-bed artefacts outside campus

NX = int(math.ceil((maxx - minx) / TERRAIN_CELL)) + 1
NY = int(math.ceil((maxy - miny) / TERRAIN_CELL)) + 1
gx = minx + np.arange(NX) * TERRAIN_CELL
gy = miny + np.arange(NY) * TERRAIN_CELL
GX, GY = np.meshgrid(gx, gy)            # row j = y index (south -> north)
LON, LAT = unproj(GX, GY)
n = 2 ** Z
PX = (LON + 180) / 360 * n * 256 - txs[0] * 256
PY = (1 - np.arcsinh(np.tan(np.radians(LAT))) / math.pi) / 2 * n * 256 - tys[0] * 256
H = ndimage.map_coordinates(big, [PY, PX], order=1, mode="nearest")
H = ndimage.gaussian_filter(H, 1.6)     # SRTM is ~30 m: remove resampling staircase


def h_at(x, y):
    fx = (x - minx) / TERRAIN_CELL; fy = (y - miny) / TERRAIN_CELL
    return float(ndimage.map_coordinates(H, [[fy], [fx]], order=1, mode="nearest")[0])


def grid_mask(poly, buffer=0.0):
    g = poly.buffer(buffer) if buffer else poly
    return contains_xy(g, GX, GY)


# --------------------------------------------------------------------------- water
print("Water ...")
water = []
water_polys = []
for e in els:
    t = e.get("tags", {})
    if t.get("natural") == "water" or "water" in t or t.get("leisure") == "swimming_pool":
        g = feature_poly(e)
        if g is None or g.is_empty:
            continue
        g = g.intersection(boundary)
        for p in polys_of(g):
            if p.area < 30:
                continue
            kind = "pool" if t.get("leisure") == "swimming_pool" else "lake"
            water_polys.append((p, t.get("name"), kind))

# unmapped ponds from ESA WorldCover (class 80), only if not already covered
wc = np.asarray(Image.open(os.path.join(RAW, "worldcover.png")))
wcm = json.load(open(os.path.join(RAW, "worldcover.json")))
ww, ws, we, wn = wcm["bbox"]
wat = (wc == 80)
lab, nlab = ndimage.label(wat)
mapped = unary_union([p for p, _, _ in water_polys]) if water_polys else Polygon()
for k in range(1, nlab + 1):
    ys_, xs_ = np.nonzero(lab == k)
    if len(xs_) < 4:
        continue
    cells = []
    for cy, cx in zip(ys_, xs_):
        lo0 = ww + (cx) * (we - ww) / wc.shape[1]; lo1 = ww + (cx + 1) * (we - ww) / wc.shape[1]
        la1 = wn - (cy) * (wn - ws) / wc.shape[0]; la0 = wn - (cy + 1) * (wn - ws) / wc.shape[0]
        x0, y0 = proj(lo0, la0); x1, y1 = proj(lo1, la1)
        cells.append(Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]))
    blob = unary_union(cells).buffer(4).buffer(-6).buffer(2).simplify(2)
    blob = blob.intersection(boundary.buffer(-8))
    for p in polys_of(blob):
        if p.area < 350 or p.intersection(mapped).area > 0.3 * p.area:
            continue
        water_polys.append((p, None, "pond"))
print(f"  {len(water_polys)} water bodies ({sum(1 for w in water_polys if w[2] == 'pond')} ponds from WorldCover)")

def long_angle_of(poly):
    rc = list(poly.minimum_rotated_rectangle.exterior.coords)
    e1 = math.dist(rc[0], rc[1]); e2 = math.dist(rc[1], rc[2])
    return math.atan2(rc[1][1] - rc[0][1], rc[1][0] - rc[0][0]) if e1 >= e2 else math.atan2(rc[2][1] - rc[1][1], rc[2][0] - rc[1][0])


# carve lakes into the terrain so the water sits in a basin
for p, name, kind in water_polys:
    m_in = grid_mask(p)
    if kind == "pool":
        # the map outlines the whole pool area (72 x 37 m, as big as a hostel); the pool itself is a standard 25 m x 12.5 m (a semi-Olympic pool, six lanes
        # of 2 m) in the middle of it, along its long axis; the terrain is levelled over the compound that is built round it (scene/pool.js)
        _ca = long_angle_of(p)
        _c = p.centroid
        _rect = Polygon([(_c.x + math.cos(_ca) * u - math.sin(_ca) * v, _c.y + math.sin(_ca) * u + math.cos(_ca) * v) for u, v in ((-12.5, -6.25), (12.5, -6.25), (12.5, 6.25), (-12.5, 6.25))])
        print(f"  swimming pool: map outline {p.area:.0f} m2 -> 25 x 12.5 m ({_rect.area:.0f} m2)")
        p = _rect
        m_in = grid_mask(p)
        # flat deck around the pool; the basin itself is modelled in the game (terrain is cut out)
        lvl = h_at(p.centroid.x, p.centroid.y)
        H[grid_mask(p.buffer(22), 0)] = lvl
        water.append({"p": ring_out(p.exterior.coords), "holes": [ring_out(i.coords) for i in p.interiors],
                      "level": r1(lvl - 0.3), "deck": r1(lvl), "kind": kind, "name": name})
        continue
    shore = grid_mask(p, 10) & ~m_in
    samples = H[grid_mask(p, 4)]
    if samples.size == 0:
        lvl = h_at(p.centroid.x, p.centroid.y)
    else:
        lvl = float(np.percentile(samples, 15))
    H[m_in] = np.minimum(H[m_in], lvl - 2.2)
    H[shore] = np.minimum(H[shore], np.maximum(lvl + 0.25, H[shore] - 0.0))
    water.append({"p": ring_out(p.exterior.coords), "holes": [ring_out(i.coords) for i in p.interiors],
                  "level": r1(lvl - 0.25), "kind": kind, "name": name})

# --------------------------------------------------------------------------- sports & parks
print("Sports fields & parks ...")
fields = []
for e in els:
    t = e.get("tags", {})
    lei = t.get("leisure")
    if t.get("name") == "Cricket Ground - IITG":
        continue                                        # the east cricket ground is now the Technology Park (buildings added below)
    if lei in ("pitch", "sports_centre", "park", "stadium", "track") or (t.get("amenity") == "college" and "Cricket" in t.get("name", "")):
        if "building" in t:
            continue
        g = feature_poly(e)
        if g is None:
            continue
        g = g.intersection(boundary)
        for p in polys_of(g):
            if p.area < 60:
                continue
            sport = t.get("sport") or ("cricket" if "Cricket" in t.get("name", "") else None)
            if t.get("name") == "athletics":
                sport = "athletics"
            kind = sport or ("park" if lei == "park" else "ground")
            rect = p.minimum_rotated_rectangle
            rc = list(rect.exterior.coords)
            e1 = math.hypot(rc[1][0] - rc[0][0], rc[1][1] - rc[0][1])
            e2 = math.hypot(rc[2][0] - rc[1][0], rc[2][1] - rc[1][1])
            ang = math.atan2(rc[1][1] - rc[0][1], rc[1][0] - rc[0][0]) if e1 >= e2 else \
                math.atan2(rc[2][1] - rc[1][1], rc[2][0] - rc[1][0])
            fields.append({"p": ring_out(p.exterior.coords), "kind": kind, "name": t.get("name"),
                           "angle": round(ang, 3), "len": r1(max(e1, e2)), "wid": r1(min(e1, e2))})
            if kind in ("athletics", "soccer", "hockey", "cricket", "basketball", "tennis", "volleyball"):
                m = grid_mask(p, 3)
                if m.any():
                    H[m] = ndimage.gaussian_filter(np.where(m, H[m].mean(), H), 0)[m]
print(f"  {len(fields)} fields/parks")
H = np.where(contains_xy(boundary.buffer(40), GX, GY), H, ndimage.gaussian_filter(H, 3))

# --------------------------------------------------------------------------- roads
print("Roads & road graph ...")
WIDTH = {"primary": 9, "secondary": 8, "tertiary": 7.5, "unclassified": 7, "residential": 6.5,
         "service": 4.5, "living_street": 5, "track": 3.5, "cycleway": 3, "footway": 2.2,
         "path": 2.2, "pedestrian": 4, "steps": 2}
CAR = {"primary", "secondary", "tertiary", "unclassified", "residential", "service", "living_street"}
CAR_GATE = {"primary", "secondary", "tertiary", "unclassified", "residential"}
roads = []
node_xy = {}
way_runs = []
crossings = []
for e in els:
    t = e.get("tags", {})
    hw = t.get("highway")
    if e["type"] != "way" or hw not in WIDTH:
        continue
    pts = [proj(p["lon"], p["lat"]) for p in e["geometry"]]
    ids = e["nodes"]
    for nid, xy in zip(ids, pts):
        node_xy[nid] = xy
    # split into runs that stay inside the campus; a drivable road that
    # leaves the campus marks a gate in the boundary wall
    run = []
    inside = [inside_loose.contains(Point(xy)) for xy in pts]
    for k, (nid, xy) in enumerate(zip(ids, pts)):
        if inside[k]:
            run.append(nid)
        else:
            if len(run) >= 2:
                way_runs.append((run, hw, t))
            run = []
        if k > 0 and inside[k] != inside[k - 1] and hw in CAR_GATE:
            cross = LineString([pts[k - 1], pts[k]]).intersection(boundary.exterior)
            if not cross.is_empty:
                c = cross if cross.geom_type == "Point" else list(cross.geoms)[0]
                a_in, a_out = (pts[k - 1], pts[k]) if inside[k - 1] else (pts[k], pts[k - 1])
                crossings.append((c.x, c.y, math.atan2(a_out[1] - a_in[1], a_out[0] - a_in[0]), hw))
    if len(run) >= 2:
        way_runs.append((run, hw, t))

for run, hw, t in way_runs:
    line = LineString([node_xy[i] for i in run]).intersection(boundary.buffer(6))
    for seg in getattr(line, "geoms", [line]):
        if seg.is_empty or seg.geom_type != "LineString" or seg.length < 3:
            continue
        roads.append({"pts": ring_out(seg.coords) if seg.coords[0] != seg.coords[-1] else [[r1(x), r1(y)] for x, y in seg.coords],
                      "w": WIDTH[hw], "kind": hw, "name": t.get("name"),
                      "oneway": t.get("oneway") == "yes", "surface": t.get("surface")})

# graph: vertices = run endpoints + nodes shared between runs
use = defaultdict(int)
for run, hw, t in way_runs:
    for i, nid in enumerate(run):
        use[nid] += 1 if 0 < i < len(run) - 1 else 2
gnodes, gindex, edges = [], {}, []


def gid(nid):
    if nid not in gindex:
        gindex[nid] = len(gnodes)
        x, y = node_xy[nid]
        gnodes.append([r1(x), r1(y)])
    return gindex[nid]


for run, hw, t in way_runs:
    start = 0
    for i in range(1, len(run)):
        if i == len(run) - 1 or use[run[i]] >= 2:
            seg = run[start:i + 1]
            pts = [node_xy[k] for k in seg]
            length = sum(math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1))
            if length > 0.5:
                edges.append({"a": gid(seg[0]), "b": gid(seg[-1]), "len": r1(length), "kind": hw,
                              "car": hw in CAR, "pts": [[r1(x), r1(y)] for x, y in pts]})
            start = i

# keep the largest drivable connected component flagged for vehicles
adj = defaultdict(list)
for k, ed in enumerate(edges):
    if ed["car"]:
        adj[ed["a"]].append(ed["b"]); adj[ed["b"]].append(ed["a"])
seen, best = set(), set()
for s in list(adj):
    if s in seen:
        continue
    comp, stack = set(), [s]
    while stack:
        u = stack.pop()
        if u in comp:
            continue
        comp.add(u); stack.extend(adj[u])
    seen |= comp
    if len(comp) > len(best):
        best = comp
for ed in edges:
    ed["main"] = ed["car"] and ed["a"] in best and ed["b"] in best
print(f"  {len(roads)} road pieces, graph {len(gnodes)} nodes / {len(edges)} edges "
      f"({sum(e['main'] for e in edges)} in main drivable network)")

# gates: where drivable roads cross the boundary wall
# drivable roads that stop exactly on the wall are gates too (the main gate road ends at the gate)
for r in roads:
    if r["kind"] not in CAR_GATE:
        continue
    for end, nxt in ((r["pts"][0], r["pts"][1]), (r["pts"][-1], r["pts"][-2])):
        if boundary.exterior.distance(Point(end)) < 3:
            crossings.append((end[0], end[1], math.atan2(end[1] - nxt[1], end[0] - nxt[0]), r["kind"]))
gates = []
for x, y, ang, hw in crossings:
    if all(math.dist((g["x"], g["y"]), (x, y)) > 60 for g in gates):
        gates.append({"x": r1(x), "y": r1(y), "angle": round(ang, 3), "kind": hw, "name": None})


def lonlat_xy(lon, lat):
    return proj(lon, lat)


# IITG has three gates: Main Gate (west, past the Market Complex), Khokha Gate (east, Khokha
# market is just outside) and KV Gate (south, where the road past Disang ends). Other road
# crossings in the data become closed service gates.
def name_gate(label, ref):
    free = [g for g in gates if not g["name"]]
    if free:
        g = min(free, key=lambda g: math.dist((g["x"], g["y"]), ref))
        g["name"] = label


name_gate("Main Gate", proj(91.68785, 26.19495))      # just north-west of the Market Complex
name_gate("Khokha Gate", proj(91.70109, 26.18552))    # Khoka Market (Overture place)
name_gate("KV Gate", proj(91.69480, 26.18270))        # south, beyond Disang
# the KV Gate is the Lothia Baghicha Gate of the campus map: it stands where the road from the circle (past the Kendriya Vidyalaya) meets the
# PWD Road, by the sub post office. That road (a service road in the map data) ends 20 m short of the wall at (167, -664): the gate is the
# nearest point of the wall to that end, and step 4c2 below carries the road on to it. The road gate that was named KV Gate before becomes a
# closed service gate
_KV_AT = (167.0, -664.0)
_kv_old = next((g for g in gates if g["name"] == "KV Gate"), None)
if _kv_old is not None:
    _c = boundary.exterior.interpolate(boundary.exterior.project(Point(_KV_AT)))
    _ang = math.atan2(_c.y - _KV_AT[1], _c.x - _KV_AT[0])
    _kv_old["name"] = None
    gates.append({"x": r1(_c.x), "y": r1(_c.y), "angle": round(_ang, 3), "kind": "residential", "name": "KV Gate"})
    print(f"  KV Gate moved to ({_c.x:.0f}, {_c.y:.0f}), out {math.degrees(_ang):.0f} deg; the old one is a service gate")
for g in gates:
    g["main"] = g["name"] == "Main Gate"
    g["closed"] = g["name"] is None
print(f"  {len(gates)} campus gates: " + ", ".join(g["name"] or "service gate" for g in gates))

# --------------------------------------------------------------------------- buildings
print("Buildings ...")
ob = json.load(open(os.path.join(RAW, "overture_buildings.json"), encoding="utf-8"))
s2 = Image.open(os.path.join(RAW, "s2cloudless.jpg")).convert("RGB")
s2a = np.asarray(s2).astype(np.float32)
s2m = json.load(open(os.path.join(RAW, "s2cloudless.json")))
sw_, ss_, se_, sn_ = s2m["bbox"]


def merc(lat):
    return np.arcsinh(np.tan(np.radians(lat)))


def s2_sample(xs, ys):
    lon, lat = unproj(np.asarray(xs), np.asarray(ys))
    px = (lon - sw_) / (se_ - sw_) * s2a.shape[1] - 0.5
    py = (merc(sn_) - merc(lat)) / (merc(sn_) - merc(ss_)) * s2a.shape[0] - 0.5
    return np.stack([ndimage.map_coordinates(s2a[..., c], [py, px], order=1, mode="nearest") for c in range(3)], -1)


landuse_res = []
for e in els:
    t = e.get("tags", {})
    if t.get("landuse") == "residential":
        g = feature_poly(e)
        if g is not None:
            landuse_res.append((g, t.get("name", "")))


def classify(name, cls, area, cx, cy):
    n = (name or "").lower()
    if "hostel" in n or cls == "dormitory":
        return "hostel"
    if "auditorium" in n:
        return "auditorium"
    if "administrative" in n or "planning" in n:
        return "admin"
    if any(k in n for k in ("academic", "lecture", "core", "workshop", "conference", "library", "centre", "center")):
        return "academic"
    if "hospital" in n:
        return "hospital"
    if "gym" in n or "activity" in n:
        return "sports"
    if any(k in n for k in ("shopping", "food", "market")):
        return "commercial"
    if "guest" in n or "transit" in n:
        return "guest"
    for g, lname in landuse_res:
        if g.contains(Point(cx, cy)):
            return "hostel" if "hostel" in lname.lower() else "residential"
    if area > 900:
        return "institutional"
    return "residential"


LEVELS = {"hostel": 4, "academic": 4, "admin": 4, "hospital": 3, "sports": 2, "commercial": 1,
          "guest": 3, "auditorium": 4, "institutional": 3}


def window_mask(poly, buffer=0.0):
    """Grid cells inside a polygon, evaluated only in its bounding window (fast)."""
    g = poly.buffer(buffer) if buffer else poly
    x0, y0, x1, y1 = g.bounds
    i0 = max(0, int((x0 - minx) / TERRAIN_CELL) - 1); i1 = min(NX, int((x1 - minx) / TERRAIN_CELL) + 2)
    j0 = max(0, int((y0 - miny) / TERRAIN_CELL) - 1); j1 = min(NY, int((y1 - miny) / TERRAIN_CELL) + 2)
    sub = contains_xy(g, GX[j0:j1, i0:i1], GY[j0:j1, i0:i1])
    return (slice(j0, j1), slice(i0, i1)), sub


def plen(pts):
    return sum(math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1))


drive_lines = [(LineString(r["pts"]), r["w"]) for r in roads if r["kind"] in CAR]
foot_lines = [(LineString(r["pts"]), r["w"]) for r in roads if r["kind"] not in CAR]
road_surf = unary_union([ls.buffer(w / 2) for ls, w in drive_lines + foot_lines])
water_u = unary_union([Polygon(w["p"], w["holes"]) for w in water]) if water else Polygon()
field_u = unary_union([Polygon(f["p"]) for f in fields if f["kind"] != "park"])

# ---- collect footprints
raw_b, dropped = [], 0
for b in ob:
    g = shape(b["geom"])
    g = Polygon([proj(x, y) for x, y in g.exterior.coords],
                [[proj(x, y) for x, y in r.coords] for r in g.interiors]) if g.geom_type == "Polygon" else \
        MultiPolygon([Polygon([proj(x, y) for x, y in p.exterior.coords],
                              [[proj(x, y) for x, y in r.coords] for r in p.interiors]) for p in g.geoms])
    g = g.buffer(0)
    if not bprep.contains(g.representative_point()):
        continue
    for p in polys_of(g):
        if p.area < 14:
            dropped += 1
            continue
        raw_b.append({"poly": p, "name": b.get("name"), "cls": b.get("class"), "id": b["id"],
                      "src": b["sources"][0] if b.get("sources") else "", "floors": b.get("num_floors")})

# ---- the Technology Park: the old east cricket ground becomes a campus of research buildings, and more buildings stand east of the
# Technology Incubation Centre (the campus wall and the ring road leave no room east of it). They are planned buildings (not in the map data), so they are added here, each checked against
# what is already there (x east, y north, metres; w along x, h along y)
from shapely import affinity
TECH = [("Technology Park Main Centre", 785, 556, 48, 20, 5), ("Technology Park Labs Centre A", 752, 606, 28, 16, 4),
        ("Technology Park Labs Centre B", 818, 606, 26, 16, 4), ("Startup Labs Centre", 789, 624, 34, 14, 3),
        ("Innovation Hub Centre", 789, 652, 40, 16, 4)]
_old = unary_union([r["poly"] for r in raw_b])
_roads_now = unary_union([LineString(r["pts"]).buffer(r["w"] / 2 + 4) for r in roads]) if roads else Polygon()
for _i, (_nm, _cx, _cy, _w, _h, _fl) in enumerate(TECH):
    _poly = Polygon([(_cx - _w / 2, _cy - _h / 2), (_cx + _w / 2, _cy - _h / 2), (_cx + _w / 2, _cy + _h / 2), (_cx - _w / 2, _cy + _h / 2)])
    if not boundary.buffer(-6).contains(_poly) or _poly.intersects(_old.buffer(3)) or _poly.intersects(water_u) or _poly.intersects(_roads_now):
        print("  !! Technology Park building skipped (no room):", _nm); continue
    raw_b.append({"poly": _poly, "name": _nm, "cls": None, "id": f"techpark-{_i}", "src": "IITG Technology Park (planned)", "floors": _fl})
    print("  + ", _nm)

# ---- logic clean-up: nothing may stand on a road, in a lake or on a pitch
def thin_strip(q, w=7.0):
    """a long thin strip (what is left of a hostel compound after the roads are cut out of it): no such building"""
    rr = list(q.minimum_rotated_rectangle.exterior.coords)
    return min(math.dist(rr[0], rr[1]), math.dist(rr[1], rr[2])) < w


clean, split_n, cut_n, drop_n, strips = [], 0, 0, 0, 0
for rb in raw_b:
    p, a = rb["poly"], rb["poly"].area
    if rb["name"]:
        # OSM sometimes maps a whole hostel compound as one "building": split it along the roads that run through it
        cuts = [ls.buffer(w / 2 + 2.0) for ls, w in drive_lines if ls.intersection(p).length > 6]
        cuts += [ls.buffer(1.8) for ls, w in foot_lines if ls.intersection(p).length > 4]   # archway / passage
        if cuts:
            split_n += 1
            for q in polys_of(p.difference(unary_union(cuts))):
                if q.area > 60 and thin_strip(q):
                    strips += 1                       # the thin slivers of "Brahmaputra Hostel" (109 x 3 m) and "Umiam Hostel" (87 x 4 m) along a road
                elif q.area > 60:
                    clean.append({**rb, "poly": q})
            continue
        clean.append(rb)
        continue
    if p.intersects(water_u) and p.intersection(water_u).area > 0.05 * a:
        drop_n += 1; continue
    if p.intersects(field_u) and p.intersection(field_u).area > 0.2 * a:
        drop_n += 1; continue
    if p.intersects(road_surf):
        ov = p.intersection(road_surf).area
        if ov > 0.25 * a or ov > 30:
            drop_n += 1; continue
        if ov > 1:
            parts = polys_of(p.difference(road_surf.buffer(0.3)))
            q = max(parts, key=lambda q: q.area) if parts else None
            if q is None or q.area < 14:
                drop_n += 1; continue
            rb = {**rb, "poly": q}
            cut_n += 1
    clean.append(rb)
ctree = STRtree([c["poly"] for c in clean])
gone = set()
for i, c in enumerate(clean):
    if i in gone:
        continue
    for j in ctree.query(c["poly"]):
        j = int(j)
        if j <= i or j in gone:
            continue
        o = c["poly"].intersection(clean[j]["poly"]).area
        if o > 0.3 * min(c["poly"].area, clean[j]["poly"].area):
            if clean[i]["name"] and clean[j]["name"]:
                continue
            loser = j if clean[i]["name"] or (not clean[j]["name"] and c["poly"].area >= clean[j]["poly"].area) else i
            gone.add(loser)
            if loser == i:
                break
clean = [c for k, c in enumerate(clean) if k not in gone]

# ---- buildings taken out by hand: sheds and a stray block among the Dhansiri / Married Scholars hostels that only showed
# up as "hostel" or "staff quarter" (by centre: x east, y north, in metres from the campus centre; 4 m tolerance); and the three-storey map
# block that sits where the KV Gate's own sub post office stands (scene/gates.js draws that one, from photographs, on to the gate wall)
REMOVE_AT = [(440, 545), (434, 557), (460, 570), (437, 596), (446, 598), (429, 630), (420, 653), (181.4, -676.1)]
n0 = len(clean)
clean = [c for c in clean if not any(math.hypot(c["poly"].centroid.x - x, c["poly"].centroid.y - y) < 4.0 for x, y in REMOVE_AT)]
print(f"  removed by hand: {n0 - len(clean)} buildings")
print(f"  removed {strips} thin slivers left of split compounds")
print(f"  clean-up: split {split_n} named compounds along internal roads, trimmed {cut_n}, "
      f"dropped {drop_n} footprints on roads/water/pitches and {len(gone)} duplicates")

# ---- level a construction pad under every building (SRTM is 30 m and would
# otherwise leave hostels hanging over 5-10 m slopes)
pads_P = np.zeros_like(H); pads_W = np.zeros_like(H)
for c in clean:
    p = Polygon(c["poly"].exterior.coords)
    if p.area < 60:
        continue
    win, sub = window_mask(p, 4.0)
    if not sub.any():
        cx, cy = p.representative_point().x, p.representative_point().y
        j, i = int(round((cy - miny) / TERRAIN_CELL)), int(round((cx - minx) / TERRAIN_CELL))
        win = (slice(j, j + 1), slice(i, i + 1)); sub = np.ones((1, 1), bool)
    vals = H[win][sub]
    pad = float(np.percentile(vals, 40))
    P = pads_P[win]; Wm = pads_W[win]
    P[sub] = pad; Wm[sub] = 1.0
Wb = ndimage.gaussian_filter(pads_W, 1.3)
Pb = ndimage.gaussian_filter(pads_P * pads_W, 1.3) / np.maximum(Wb, 1e-6)
H = np.where(pads_W > 0, pads_P, H * (1 - np.clip(Wb * 1.6, 0, 1)) + Pb * np.clip(Wb * 1.6, 0, 1))
print(f"  levelled {int(pads_W.sum())} terrain cells under buildings")

# staff quarters and small houses: only the row of houses opposite the entrance of Subansiri Hostel stays (x0, x1, y0, y1), with the
# Director's Bungalow and the house beside the Alcheringa wall (centre x, y, radius): no quarters are scattered along the roads
KEEP_BOX = [(-62.0, -12.0, 338.0, 622.0)]
KEEP_DISC = [(-160.0, 318.0, 50.0), (137.0, 260.0, 14.0)]
MID = (78.0, 281.0)                                       # the middle of the campus: nothing is kept within 450 m of it, except the above
RES_C = [(c["poly"].centroid.x, c["poly"].centroid.y) for c in clean if not c["name"]]
removed_houses = 0
buildings, bshapes = [], []
for c in clean:
    area = c["poly"].area
    p = c["poly"].simplify(0.35)
    if p.is_empty or not isinstance(p, Polygon):
        continue
    name, cls, src = c["name"], c["cls"], c["src"]
    kind = classify(name, cls, area, p.centroid.x, p.centroid.y)
    if name and name.startswith(("Technology Park", "Startup Labs", "Innovation Hub")):
        kind = "academic"
    drop_house = False
    if kind == "residential" and not name:
        cxh, cyh = p.centroid.x, p.centroid.y
        keep = any(x0 <= cxh <= x1 and y0 <= cyh <= y1 for x0, x1, y0, y1 in KEEP_BOX) or any(math.hypot(cxh - kx, cyh - ky) <= kr for kx, ky, kr in KEEP_DISC)
        if not keep and math.hypot(cxh - MID[0], cyh - MID[1]) >= 450.0:
            # a real colony (a dense cluster of houses) far out at the edge of the campus stays; a lone house on a road does not
            keep = sum(1 for ox, oy in RES_C if math.hypot(ox - cxh, oy - cyh) < 45.0) - 1 >= 8
        drop_house = not keep                              # decided after the landmarks are placed: a shop, a pool house, a canteen stays
    if c["floors"]:
        lv = int(c["floors"])
    elif name:
        lv = LEVELS.get(kind, 3)
    else:
        j = stable_rand(c["id"])
        if area < 45:
            lv = 1
        elif area < 110:
            lv = 1 if j < 0.35 else 2
        elif area < 300:
            lv = 2 if j < 0.45 else 3
        elif area < 900:
            lv = 3 if j < 0.6 else 4
        else:
            lv = 3 if j < 0.4 else 4
        if kind == "hostel":
            lv = max(lv, 3)
    height = lv * 3.3 + 1.0
    if kind == "auditorium":
        height = 17.0
    if name == "General Gym" or name == "Mechnical Workshop":
        height = 10.0
    holes = [ring_out(i.coords) for i in p.interiors]
    # big hostel / academic blocks in IITG are quadrangles around courtyards
    if name and not holes and area > 2600 and kind in ("hostel", "academic", "guest"):
        depth = 13.0 if kind != "academic" else 16.0
        inner = p.buffer(-depth, join_style=2)
        inner_polys = [q for q in polys_of(inner) if q.area > 250]
        if inner_polys and sum(q.area for q in inner_polys) < 0.75 * area:
            holes = [ring_out(q.simplify(0.5).exterior.coords) for q in inner_polys]
    roof = None
    if area > 350:
        inner_pts = p.buffer(-3)
        if not inner_pts.is_empty:
            bx0, by0, bx1, by1 = inner_pts.bounds
            xs = rng.uniform(bx0, bx1, 40); ys = rng.uniform(by0, by1, 40)
            ok = contains_xy(inner_pts, xs, ys)
            if ok.sum() >= 5:
                col_ = np.median(s2_sample(xs[ok], ys[ok]), 0)
                roof = [int(v) for v in col_]
    ring = ring_out(p.exterior.coords)
    zs = [h_at(x, y) for x, y in ring]
    buildings.append({"p": ring, "holes": holes, "hgt": r1(height), "lv": lv, "kind": kind,
                      "name": name, "src": {"OpenStreetMap": "osm", "Google Open Buildings": "google",
                                            "Microsoft ML Buildings": "microsoft"}.get(src, src),
                      "base": r1(min(zs) - 0.6), "top": r1(max(zs)), "roof": roof,
                      "id": c["id"][:12], "_drop": drop_house})
    bshapes.append(Polygon(ring, holes))
print(f"  {len(buildings)} buildings inside campus (dropped {dropped} slivers)")

# --------------------------------------------------------------------------- landmarks & POIs
print("Landmarks ...")
cur = json.load(open(os.path.join(ROOT, "tools", "landmarks.json"), encoding="utf-8"))
places = json.load(open(os.path.join(RAW, "overture_places.json"), encoding="utf-8"))


def locate(match, source=None, tag=None):
    if tag:
        k, v = tag.split("=")
        for e in els:
            if e.get("tags", {}).get(k) == v and e["type"] == "node":
                return proj(e["lon"], e["lat"])
        return None
    if source != "overture":
        cands = []
        for e in els:
            t = e.get("tags", {})
            if t.get("name") != match or e.get("id") == CAMPUS_WAY:
                continue
            if e["type"] == "node":
                cands.append(proj(e["lon"], e["lat"]))
            else:
                g = feature_poly(e)
                if g is not None and not g.is_empty:
                    rp = g.representative_point() if g.area > 0 else g.centroid
                    cands.append((rp.x, rp.y))
        if cands:
            return cands[0]
    for p in places:
        if p["name"] and p["name"].strip() == match:
            return proj(p["lon"], p["lat"])
    return None


landmarks, pois = [], []
for L in cur["landmarks"]:
    xy = tuple(L["at"]) if "at" in L else locate(L.get("match"), L.get("source"), L.get("tag"))
    if xy is None:
        print("  !! not found:", L.get("match") or L.get("tag")); continue
    if not boundary.buffer(40).contains(Point(xy)):
        print("  !! outside campus, skipped:", L["name"]); continue
    landmarks.append({"id": L["id"], "name": L["name"], "kind": L["kind"], "desc": L["desc"],
                      "x": r1(xy[0]), "y": r1(xy[1]), "z": r1(h_at(*xy))})
for P in cur["pois"]:
    xy = tuple(P["at"]) if "at" in P else locate(P["match"], P.get("source"))        # ("at": a place the map data puts in the wrong spot, set by hand)
    if xy is None or not boundary.buffer(30).contains(Point(xy)):
        continue
    pois.append({"name": P["name"], "kind": P["kind"], "x": r1(xy[0]), "y": r1(xy[1])})
print(f"  {len(landmarks)} landmarks, {len(pois)} points of interest")

# staff quarters and small houses that are not kept (see KEEP_BOX / KEEP_DISC above) are taken out now, except any small building that
# IS a place: within 38 m of a landmark, a point of interest or a gate (the swimming-pool house, a canteen, a cycle shop...)
_places = [(l["x"], l["y"]) for l in landmarks] + [(q["x"], q["y"]) for q in pois] + [(g["x"], g["y"]) for g in gates]
_keep_idx = [i for i, b in enumerate(buildings) if not b["_drop"] or any(math.hypot(Polygon(b["p"]).centroid.x - px, Polygon(b["p"]).centroid.y - py) < 38.0 for px, py in _places)]
removed_houses = len(buildings) - len(_keep_idx)
buildings = [buildings[i] for i in _keep_idx]
for b in buildings:
    b.pop("_drop", None)
bshapes = [Polygon(b["p"], b["holes"]) for b in buildings]
print(f"  {removed_houses} staff quarters / small houses taken out, {len(buildings)} buildings left")

# --------------------------------------------------------------------------- campus planning
# Make the campus logical: every building reachable, no road that ends in the bush,
# no island roads, and hostels with a proper compound (lawn, forecourt, courts).
print("Campus planning ...")
bsolid = [Polygon(b["p"]) for b in buildings]
btree = STRtree(bsolid)
inner_campus = boundary.buffer(-3)


def blocked(line, width, ignore=()):
    g = line.buffer(width / 2 + 0.6)
    for j in btree.query(g):
        j = int(j)
        if j not in ignore and bsolid[j].intersects(g):
            return True
    if g.intersects(water_u) or g.intersects(field_u):
        return True
    return not inner_campus.contains(line)


class Net:
    def __init__(self, nodes, edges):
        self.nodes, self.edges, self.ver, self._cache = nodes, edges, 0, {}

    def index(self, key, filt):
        c = self._cache.get(key)
        if c and c[0] == self.ver:
            return c[1]
        segs, ref = [], []
        for ei, e in enumerate(self.edges):
            if not filt(e):
                continue
            P = e["pts"]
            for k in range(len(P) - 1):
                if P[k] != P[k + 1]:
                    segs.append(LineString([P[k], P[k + 1]])); ref.append((ei, k))
        res = (STRtree(segs), segs, ref) if segs else None
        self._cache[key] = (self.ver, res)
        return res

    def nearest(self, key, filt, pt):
        idx = self.index(key, filt)
        if idx is None:
            return None
        tree, segs, ref = idx
        j = int(tree.nearest(pt))
        s = segs[j]
        return s.distance(pt), s.interpolate(s.project(pt)), ref[j]

    def nearest_k(self, key, filt, pt, maxd, k=8):
        """Up to k closest candidate links (one per edge), nearest first."""
        idx = self.index(key, filt)
        if idx is None:
            return []
        tree, segs, ref = idx
        best = {}
        for j in tree.query(pt.buffer(maxd)):
            j = int(j)
            s = segs[j]
            d = s.distance(pt)
            ei = ref[j][0]
            if d <= maxd and (ei not in best or d < best[ei][0]):
                best[ei] = (d, s.interpolate(s.project(pt)), ref[j])
        return sorted(best.values(), key=lambda t: t[0])[:k]

    def attach(self, ei, k, x, y):
        """Node at (x, y) on edge ei (segment k), splitting the edge if needed."""
        e = self.edges[ei]
        P = e["pts"]
        if math.dist(P[0], (x, y)) < 2.5:
            return e["a"]
        if math.dist(P[-1], (x, y)) < 2.5:
            return e["b"]
        q = [r1(x), r1(y)]
        nid = len(self.nodes)
        self.nodes.append(q)
        p1 = P[:k + 1] + ([q] if math.dist(P[k], q) > 0.3 else [])
        p2 = ([q] if math.dist(P[k + 1], q) > 0.3 else []) + P[k + 1:]
        base = {kk: v for kk, v in e.items() if kk not in ("a", "b", "len", "pts")}
        self.edges[ei] = {**base, "a": e["a"], "b": nid, "pts": p1, "len": r1(plen(p1))}
        self.edges.append({**base, "a": nid, "b": e["b"], "pts": p2, "len": r1(plen(p2))})
        self.ver += 1
        return nid

    def node(self, x, y):
        self.nodes.append([r1(x), r1(y)])
        return len(self.nodes) - 1

    def add(self, pts, kind, a, b):
        P = [[r1(x), r1(y)] for x, y in pts]
        self.edges.append({"a": a, "b": b, "len": r1(plen(P)), "kind": kind, "car": kind in CAR, "pts": P, "gen": True})
        self.ver += 1
        roads.append({"pts": P, "w": WIDTH[kind], "kind": kind, "name": None, "oneway": False, "surface": None, "gen": True})

    def components(self, filt):
        adj_ = defaultdict(list)
        for e in self.edges:
            if filt(e):
                adj_[e["a"]].append(e["b"]); adj_[e["b"]].append(e["a"])
        seen_, comps = set(), []
        for s in list(adj_):
            if s in seen_:
                continue
            comp, st = set(), [s]
            while st:
                u = st.pop()
                if u in comp:
                    continue
                comp.add(u); st.extend(adj_[u])
            seen_ |= comp; comps.append(comp)
        comps.sort(key=len, reverse=True)
        return comps


net = Net(gnodes, edges)
is_car = lambda e: e["car"]
any_road = lambda e: True

# 1. island road networks join the main campus network
joined = 0
for _ in range(12):
    comps = net.components(is_car)
    if len(comps) <= 1:
        break
    main = comps[0]
    in_main = lambda e, m=main: e["car"] and e["a"] in m and e["b"] in m
    net._cache.pop("main", None)
    best = None
    for comp in comps[1:]:
        for nid in comp:
            pt = Point(net.nodes[nid])
            for r in net.nearest_k("main", in_main, pt, 320, 12):
                if best and r[0] >= best[0]:
                    break
                if not blocked(LineString([pt, r[1]]), 6.5):
                    best = (r[0], nid, r[1], r[2])
                    break
    mid = None
    if not best:
        # no straight link: route around the houses with one bend
        for comp in comps[1:]:
            for nid in comp:
                pt = Point(net.nodes[nid])
                for ox in range(-150, 151, 10):
                    for oy in range(-150, 151, 10):
                        m_ = Point(pt.x + ox, pt.y + oy)
                        l1 = math.hypot(ox, oy)
                        if l1 < 5 or (best and l1 >= best[0]) or blocked(LineString([pt, m_]), 6.5):
                            continue
                        for r in net.nearest_k("main", in_main, m_, 150, 6):
                            if best and l1 + r[0] >= best[0]:
                                break
                            if not blocked(LineString([m_, r[1]]), 6.5):
                                best = (l1 + r[0], nid, r[1], r[2]); mid = (m_.x, m_.y)
                                break
    if not best:
        break
    d, nid, q, (ei, k) = best
    nq = net.attach(ei, k, q.x, q.y)
    net.add([net.nodes[nid]] + ([mid] if mid else []) + [(q.x, q.y)], "residential", nid, nq)
    joined += 1
print(f"  joined {joined} island road networks to the main network")


def find_access(polys, width, filters, maxd=160, ign=()):
    """Shortest unobstructed link from a footprint to the road network."""
    for key, filt in filters:
        best = None
        for poly in polys:
            ring = poly.exterior
            n = max(8, int(ring.length / 4))
            for s in range(n):
                p = ring.interpolate((s + 0.5) / n, normalized=True)
                for d, q, ref in net.nearest_k(key, filt, p, maxd, 6):
                    if best and d >= best[0]:
                        break
                    if d > 3:
                        L = math.hypot(q.x - p.x, q.y - p.y)
                        start = Point(p.x + (q.x - p.x) / L * 1.2, p.y + (q.y - p.y) / L * 1.2)
                        if poly.contains(start) or blocked(LineString([start, q]), width, ign):
                            continue
                    best = (d, p, q, ref, poly)
                    break
        if best:
            return best, key
    return None, None


# the library, the auditorium and the conference centre had their entrances on the side away from the flag lawn: they open on the opposite side
FLIP = {"library", "auditorium", "conference"}


def flip_access(polys, res, ign=()):
    d0, p0, q0, ref0, poly0 = res
    allp = unary_union(polys)
    c = allp.centroid
    ux, uy = c.x - p0.x, c.y - p0.y
    Lc = math.hypot(ux, uy) or 1.0
    ux, uy = ux / Lc, uy / Lc
    inter = LineString([(c.x, c.y), (c.x + ux * 400, c.y + uy * 400)]).intersection(allp.exterior)
    pts = [g for g in getattr(inter, "geoms", [inter]) if g.geom_type == "Point"]
    if not pts:
        return None
    p = max(pts, key=lambda g: g.distance(c))
    poly = min(polys, key=lambda pl: pl.exterior.distance(p))
    for key, filt in (("car", is_car), ("any", any_road)):
        for d, q, ref in net.nearest_k(key, filt, p, 170, 12):
            L2 = math.hypot(q.x - p.x, q.y - p.y)
            if d > 3:
                if (q.x - p.x) * ux + (q.y - p.y) * uy < 0.2 * L2:
                    continue                                        # the road has to lie out in front of the new entrance
                start = Point(p.x + (q.x - p.x) / L2 * 1.2, p.y + (q.y - p.y) / L2 * 1.2)
                if poly.contains(start) or blocked(LineString([start, q]), 5.0, ign):
                    continue
            return (d, p, q, ref, poly)
    return None


def outward(poly, p):
    ring = poly.exterior
    s = ring.project(p)
    a, b = ring.interpolate(s - 0.8), ring.interpolate(s + 0.8)
    tx, ty = b.x - a.x, b.y - a.y
    L = math.hypot(tx, ty) or 1
    nx_, ny_ = ty / L, -tx / L
    if poly.contains(Point(p.x + nx_ * 0.5, p.y + ny_ * 0.5)):
        nx_, ny_ = -nx_, -ny_
    return nx_, ny_


# 2. sites: landmark buildings and named buildings get an entrance, an access road and a forecourt
KIND_R = {"hostel": 20, "academic": 14, "admin": 14, "culture": 14, "sports": 12, "service": 12, "food": 10, "residential": 10}
sites, used = [], set()
for lm in landmarks:
    pt = Point(lm["x"], lm["y"])
    js = [int(j) for j in btree.query(pt.buffer(30)) if bsolid[int(j)].distance(pt) < 30]
    if not js:
        continue
    j0 = min(js, key=lambda j: bsolid[j].distance(pt))
    nm = buildings[j0]["name"]
    if nm:
        ids = [i for i, b in enumerate(buildings) if b["name"] == nm and bsolid[i].distance(pt) < 150]
    else:
        ids = [j0]
        grow = bsolid[j0].buffer(15)
        for j in btree.query(grow):
            j = int(j)
            if j != j0 and not buildings[j]["name"] and bsolid[j].area > 200 and bsolid[j].intersects(grow):
                ids.append(j)
    ids = [i for i in ids if i not in used]
    if not ids:
        continue
    used.update(ids)
    sites.append({"name": lm["name"], "lm": lm["id"], "kind": lm["kind"], "ids": ids})
    if lm["kind"] == "hostel":
        for i in ids:
            b = buildings[i]
            if b["kind"] != "hostel":
                b["kind"] = "hostel"
            if b["lv"] < 3:
                b["lv"] = 3; b["hgt"] = r1(3 * 3.3 + 1.0)
for nm in sorted({b["name"] for b in buildings if b["name"]}):
    ids = [i for i, b in enumerate(buildings) if b["name"] == nm and i not in used]
    if ids:
        used.update(ids)
        sites.append({"name": nm, "lm": None, "kind": {"hostel": "hostel", "auditorium": "culture", "admin": "admin", "hospital": "service",
                                                       "sports": "sports", "commercial": "food", "guest": "service"}.get(buildings[ids[0]]["kind"], "academic"), "ids": ids})

plazas = []
for si, st in enumerate(sites):
    polys = [bsolid[i] for i in st["ids"]]
    res, key = find_access(polys, 5.0, [("car", is_car), ("any", any_road)], ign=set(st["ids"]))
    if res and st["lm"] in FLIP:
        alt = flip_access(polys, res, set(st["ids"]))
        if alt:
            print(f"  {st['name']}: entrance turned to the opposite side ({alt[0]:.0f} m from a road)")
            res = alt
        else:
            print(f"  !! {st['name']}: no access on the opposite side, entrance kept")
    if not res:
        print("  !! no access for", st["name"]); continue
    d, p, q, (ei, k), poly = res
    if d > 1:
        nx_, ny_ = (q.x - p.x) / d, (q.y - p.y) / d
    else:
        nx_, ny_ = outward(poly, p)
    nq = net.attach(ei, k, q.x, q.y)
    if d > 4:
        ep = (p.x + nx_ * 0.6, p.y + ny_ * 0.6)
        ne = net.node(*ep)
        net.add([ep, (q.x, q.y)], "service" if key == "car" else "footway", ne, nq)
    else:
        ne = nq
    st.update(entry=[r1(p.x), r1(p.y)], normal=[round(nx_, 3), round(ny_, 3)], node=ne, plaza=-1)
    # forecourt: paved apron in front of the entrance (parking, cycle stands, gatherings)
    tx, ty = -ny_, nx_
    W = 28 if st["kind"] == "hostel" else 22 if st["kind"] in ("academic", "admin", "culture") else 16
    Dp = max(7.0, min(d + 2.0, 14.0))
    c0 = (p.x + nx_ * 0.3, p.y + ny_ * 0.3)
    rect = Polygon([(c0[0] + tx * W / 2, c0[1] + ty * W / 2), (c0[0] - tx * W / 2, c0[1] - ty * W / 2),
                    (c0[0] - tx * W / 2 + nx_ * Dp, c0[1] - ty * W / 2 + ny_ * Dp),
                    (c0[0] + tx * W / 2 + nx_ * Dp, c0[1] + ty * W / 2 + ny_ * Dp)])
    near = [bsolid[int(j)] for j in btree.query(rect)]
    if near:
        rect = rect.difference(unary_union(near).buffer(0.4))
    rect = rect.difference(water_u).difference(field_u).intersection(inner_campus)
    parts = polys_of(rect)
    if parts:
        rp = max(parts, key=lambda q: q.area)
        if rp.area > 50:
            st["plaza"] = len(plazas)
            plazas.append({"p": ring_out(rp.simplify(0.3).exterior.coords), "x": r1(c0[0] + nx_ * Dp / 2), "y": r1(c0[1] + ny_ * Dp / 2),
                           "a": round(math.atan2(ny_, nx_), 3), "w": W, "d": r1(Dp), "site": si})
print(f"  {len(sites)} sites with entrances, {len(plazas)} forecourts")

# 3. every other building gets a lane or footpath (staff quarters were often mapped without their lanes)
site_ids = {i for st in sites for i in st["ids"]}
cand = []
for i in range(len(buildings)):
    if i in site_ids:
        continue
    r = net.nearest("any", any_road, bsolid[i].centroid)
    cand.append((r[0] if r else 1e9, i))
cand.sort()
lanes = 0
for _, i in cand:
    res, key = find_access([bsolid[i]], 2.4, [("any", any_road)], maxd=110, ign={i})
    if not res or res[0] <= 9:
        continue
    d, p, q, (ei, k), poly = res
    nq = net.attach(ei, k, q.x, q.y)
    ep = (p.x + (q.x - p.x) / d * 0.6, p.y + (q.y - p.y) / d * 0.6)
    net.add([ep, (q.x, q.y)], "footway", net.node(*ep), nq)
    lanes += 1
print(f"  {lanes} footpaths to buildings that had no path")

# 4. dead ends must lead somewhere: extend them to the nearest building, else give them a sit-out
deg = defaultdict(int)
for e in net.edges:
    deg[e["a"]] += 1; deg[e["b"]] += 1
plaza_u = unary_union([Polygon(pl["p"]) for pl in plazas]) if plazas else Polygon()
sitouts, extended = [], 0
for nid in [n for n, dg in deg.items() if dg == 1]:
    pt = Point(net.nodes[nid])
    j = int(btree.nearest(pt))
    if bsolid[j].distance(pt) < 25 or boundary.exterior.distance(pt) < 12 or plaza_u.distance(pt) < 10:
        continue
    e = next(e for e in net.edges if e["a"] == nid or e["b"] == nid)
    kind = "service" if e["kind"] in CAR else e["kind"]
    done = False
    for j in sorted((int(j) for j in btree.query(pt.buffer(150))), key=lambda j: bsolid[j].distance(pt))[:6]:
        from shapely.ops import nearest_points
        bq = nearest_points(pt, bsolid[j])[1]
        L = pt.distance(bq)
        if L < 1:
            break
        end = (bq.x - (bq.x - pt.x) / L * 0.8, bq.y - (bq.y - pt.y) / L * 0.8)
        if blocked(LineString([pt, end]), WIDTH[kind], {j}):
            continue
        net.add([(pt.x, pt.y), end], kind, nid, net.node(*end))
        extended += 1; done = True
        break
    if not done:
        P = e["pts"]
        a0, a1 = (P[1], P[0]) if e["a"] == nid else (P[-2], P[-1])
        sitouts.append({"x": r1(pt.x), "y": r1(pt.y), "a": round(math.atan2(a1[1] - a0[1], a1[0] - a0[0]), 3)})
print(f"  dead ends: {extended} extended to a building, {len(sitouts)} given a sit-out")

# 4b. the hill-top View Point gets a footpath and a paved lookout facing downhill
for lm in landmarks:
    if lm["id"] != "viewpoint":
        continue
    pt = Point(lm["x"], lm["y"])
    best_a, best_drop = 0.0, -1e9
    for k in range(16):
        a = k / 16 * math.pi * 2
        drop = h_at(lm["x"], lm["y"]) - h_at(lm["x"] + math.cos(a) * 80, lm["y"] + math.sin(a) * 80)
        if drop > best_drop:
            best_drop, best_a = drop, a
    sitouts.append({"x": lm["x"], "y": lm["y"], "a": round(best_a, 3), "view": True})
    for d, q, (ei, k) in net.nearest_k("any", any_road, pt, 250, 8):
        if d < 4:
            break
        if not blocked(LineString([pt, q]), 2.4):
            net.add([(pt.x, pt.y), (q.x, q.y)], "footway", net.node(pt.x, pt.y), net.attach(ei, k, q.x, q.y))
            print(f"  View Point: {d:.0f} m footpath, facing {math.degrees(best_a):.0f} deg, {best_drop:.1f} m drop")
            break

# 4c. the IITG Bus Stop (the terminus every campus bus starts from), east of the ring road round the Transit Complex and the TIC:
# a service road runs out to it from the ring road, through the stand
_bs = next((lm for lm in landmarks if lm["id"] == "busstop"), None)
if _bs:
    _c = Point(_bs["x"], _bs["y"])
    for _d, _q, (_ei, _k) in net.nearest_k("car", is_car, _c, 140, 8):
        if not blocked(LineString([_c, _q]), 6.5):
            _nq = net.attach(_ei, _k, _q.x, _q.y)
            _nc = net.node(_c.x, _c.y)
            net.add([(_q.x, _q.y), (_c.x, _c.y)], "service", _nq, _nc)
            for _s in (-1, 1):
                net.add([(_c.x, _c.y), (_c.x + _s * 38, _c.y)], "service", _nc, net.node(_c.x + _s * 38, _c.y))
            print(f"  IITG Bus Stop: road of {_d:.0f} m to the ring road, a 76 m stand road through it")
            break
    else:
        print("  !! IITG Bus Stop: no link to the road network")

# 4c2. the KV (Lothia Baghicha) Gate: the road from the circle runs on to it, straight on to the wall at the PWD Road
_kg = next((g for g in gates if g["name"] == "KV Gate"), None)
if _kg:
    _gin = (_kg["x"] - math.cos(_kg["angle"]) * 1.0, _kg["y"] - math.sin(_kg["angle"]) * 1.0)
    for _d, _q, (_ei, _k) in net.nearest_k("car", is_car, Point(*_KV_AT), 12, 6):
        _nq = net.attach(_ei, _k, _q.x, _q.y)
        net.add([(_q.x, _q.y), _gin], "service", _nq, net.node(*_gin))
        net.edges[-1].pop("gen"); roads[-1].pop("gen")      # a real road: cars, buses and taxis use it (the gate is open in the day)
        print(f"  KV Gate: the road from the circle runs {math.dist((_q.x, _q.y), _gin):.0f} m on to the gate")
        break
    else:
        print("  !! KV Gate: no road to join")

# 4d. the road up to the View Point becomes a winding footpath through the forest: no vehicles, no cycles, and at least 2 km on
# foot from the nearest place a vehicle can reach (the old service road is lengthened with bends; the hill is covered with
# forest at run time, scene/hilltrail.js)
_vp = next((lm for lm in landmarks if lm["id"] == "viewpoint"), None)
if _vp:
    _hill = next((r for r in roads if r["kind"] == "service" and math.hypot(r["pts"][-1][0] - _vp["x"], r["pts"][-1][1] - _vp["y"]) < 15 and len(r["pts"]) > 40), None)
    if _hill:
        _band = LineString(_hill["pts"]).buffer(1.2)
        chain = [i for i, e in enumerate(net.edges) if e["kind"] == "service" and LineString(e["pts"]).within(_band)]
        chain += [i for i, e in enumerate(net.edges) if e.get("gen") and e["kind"] == "service" and i not in chain
                  and all(math.hypot(x - _vp["x"], y - _vp["y"]) < 130 for x, y in e["pts"])]
        # a short branch joining the trail to the hostel road is cut as well: the trail can only be entered on foot
        _nodes = {e[k] for c in chain for e in [net.edges[c]] for k in ('a', 'b')}
        for i, e in enumerate(net.edges):
            if i not in chain and e['kind'] == 'service' and e['len'] < 60 and (e['a'] in _nodes or e['b'] in _nodes)                     and any(math.hypot(x - _vp['x'], y - _vp['y']) < 330 for x, y in (net.nodes[e['a']], net.nodes[e['b']])):
                chain.append(i)
        # the winding service road that comes up from the hostel road at (-428, 439) to the trail's western end is part of the trail
        # too (otherwise a vehicle could come within 1.3 km of the View Point)
        for i, e in enumerate(net.edges):
            if i in chain or e["kind"] != "service":
                continue
            pa, pb = net.nodes[e["a"]], net.nodes[e["b"]]
            if (math.dist(pa, (-428, 439)) < 4 and math.dist(pb, (-352, 591)) < 4) or (math.dist(pb, (-428, 439)) < 4 and math.dist(pa, (-352, 591)) < 4):
                chain.append(i)
        free = lambda x, y: inner_campus.contains(Point(x, y)) and not water_u.contains(Point(x, y)) and not field_u.contains(Point(x, y)) and \
            all(bsolid[int(j)].distance(Point(x, y)) > 4.0 for j in btree.query(Point(x, y).buffer(5)))

        def meander(pts, amp, lam, ph):
            """the polyline with a sine wave along it (zero at both ends); None if it would leave the free ground"""
            d = [pts[0]]
            for a, b in zip(pts, pts[1:]):
                L = math.dist(a, b); n = max(1, int(L / 3))
                for s in range(1, n + 1):
                    d.append((a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n))
            cum = [0.0]
            for a, b in zip(d, d[1:]):
                cum.append(cum[-1] + math.dist(a, b))
            T = cum[-1]; out = []
            for k, (x, y) in enumerate(d):
                a, b = d[max(0, k - 1)], d[min(len(d) - 1, k + 1)]
                tx, ty = b[0] - a[0], b[1] - a[1]; tl = math.hypot(tx, ty) or 1.0
                taper = min(1.0, cum[k] / 25.0, (T - cum[k]) / 25.0)
                off = amp * taper * math.sin(2 * math.pi * cum[k] / lam + ph)
                px, py = x - ty / tl * off, y + tx / tl * off
                if 0 < k < len(d) - 1 and not free(px, py):
                    return None
                out.append((px, py))
            return out

        long_edges = [i for i in chain if net.edges[i]["len"] > 40]
        _top = min({n for i in chain for n in (net.edges[i]["a"], net.edges[i]["b"])}, key=lambda n: math.dist(net.nodes[n], (_vp["x"], _vp["y"])))
        _inc = defaultdict(list)
        for j, e2 in enumerate(net.edges):
            _inc[e2["a"]].append(j); _inc[e2["b"]].append(j)
        _entries = {n for i in chain for n in (net.edges[i]["a"], net.edges[i]["b"]) if any(net.edges[j]["car"] and j not in chain for j in _inc[n])}

        def min_walk(new_pts):
            """the shortest walk to the top from any place a vehicle can reach (along the trail only)"""
            import heapq
            adj = defaultdict(list)
            for i in chain:
                e2 = net.edges[i]
                pp = new_pts.get(i, [tuple(p) for p in e2["pts"]])
                L2 = sum(math.dist(p, q) for p, q in zip(pp, pp[1:]))
                adj[e2["a"]].append((e2["b"], L2)); adj[e2["b"]].append((e2["a"], L2))
            dist = {_top: 0.0}
            pq = [(0.0, _top)]
            while pq:
                d0, u = heapq.heappop(pq)
                if d0 > dist.get(u, 1e18):
                    continue
                for v, w2 in adj[u]:
                    if d0 + w2 < dist.get(v, 1e18):
                        dist[v] = d0 + w2; heapq.heappush(pq, (d0 + w2, v))
            return min((dist.get(n, 1e18) for n in _entries), default=0.0)

        TARGET = 2150.0
        got = 0.0
        for amp, lam in ((9, 36), (12, 34), (14, 30), (16, 28), (18, 26), (22, 24), (26, 22), (30, 20)):
            new = {}
            for i in long_edges:
                e = net.edges[i]
                for a in (amp, amp * 0.75, amp * 0.5, amp * 0.3, 0):
                    m = meander([tuple(p) for p in e["pts"]], a, lam + (i % 5) * 3, i * 1.3) if a else [tuple(p) for p in e["pts"]]
                    if m:
                        new[i] = m; break
            got = min_walk(new)
            if got >= TARGET:
                break
        for i in chain:
            e = net.edges[i]
            if i in new:
                e["pts"] = [[r1(x), r1(y)] for x, y in new[i]]
                e["len"] = r1(plen(e["pts"]))
            e["kind"] = "path"; e["car"] = False; e["hill"] = True
        net.ver += 1; net._cache.clear()
        roads[:] = [r for r in roads if r is not _hill]
        for i in chain:
            e = net.edges[i]
            roads.append({"pts": e["pts"], "w": 2.6, "kind": "path", "name": None, "oneway": False, "surface": None, "trail": True})
        print(f"  View Point trail: {len(chain)} edges, {sum(net.edges[i]['len'] for i in chain if net.edges[i]['len'] > 40):.0f} m of winding footpath (bends {amp} m), shortest walk from a vehicle road {got:.0f} m")

# 5. hostel compounds: courts beside every hostel
road_clear = unary_union([LineString(r["pts"]).buffer(r["w"] / 2 + 1.5) for r in roads])
occupied = [road_clear, water_u.buffer(4), field_u.buffer(3), plaza_u.buffer(1)]


def court_rect(cx, cy, ang, L, W):
    ca, sa = math.cos(ang), math.sin(ang)
    return Polygon([(cx + ca * u - sa * v, cy + sa * u + ca * v) for u, v in ((-L / 2, -W / 2), (L / 2, -W / 2), (L / 2, W / 2), (-L / 2, W / 2))])


def long_angle(poly):
    rc = list(poly.minimum_rotated_rectangle.exterior.coords)
    e1 = math.dist(rc[0], rc[1]); e2 = math.dist(rc[1], rc[2])
    return math.atan2(rc[1][1] - rc[0][1], rc[1][0] - rc[0][0]) if e1 >= e2 else math.atan2(rc[2][1] - rc[1][1], rc[2][0] - rc[1][0])


court_n = 0
campus_safe = boundary.buffer(-8)
for st in sites:
    if st["kind"] != "hostel":
        continue
    grp = unary_union([bsolid[i] for i in st["ids"]])
    ang0 = long_angle(max((bsolid[i] for i in st["ids"]), key=lambda q: q.area))
    zone = grp.buffer(60).difference(grp.buffer(9))
    # every hostel gets a volleyball court, a basketball court and a cricket practice pitch (a mown square with a rolled strip)
    for kind, L, W, clr in (("volleyball", 18, 9, 3.0), ("cricket", 36, 24, 3.0), ("basketball", 28, 15, 2.0)):
        best = None
        bx0, by0, bx1, by1 = zone.bounds
        occ = unary_union(occupied)
        for yy in np.arange(by0, by1, 7.0):
            for xx in np.arange(bx0, bx1, 7.0):
                if not zone.contains(Point(xx, yy)):
                    continue
                for ang in (ang0, ang0 + math.pi / 2):
                    rect = court_rect(xx, yy, ang, L + clr * 2, W + clr * 2)
                    if not campus_safe.contains(rect) or occ.intersects(rect):
                        continue
                    rb = rect.buffer(3)
                    if any(bsolid[int(j)].intersects(rb) for j in btree.query(rb)):
                        continue
                    win, sub = window_mask(rect)
                    hv = H[win][sub]
                    if hv.size == 0:
                        continue
                    slope = float(hv.max() - hv.min())
                    if slope > 3.5:
                        continue
                    score = slope * 3 + grp.distance(rect) * 0.08
                    if best is None or score < best[0]:
                        best = (score, xx, yy, ang, rect)
        if not best:
            continue
        _, xx, yy, ang, rect = best
        court = court_rect(xx, yy, ang, L, W)
        fields.append({"p": ring_out(court.exterior.coords), "kind": kind, "name": None, "angle": round(ang, 3),
                       "len": L, "wid": W, "gen": True, "site": st["lm"], **({"practice": True} if kind == "cricket" else {})})
        occupied.append(rect.buffer(2))
        win, sub = window_mask(rect.buffer(2))
        Hw = H[win]
        Hw[sub] = float(Hw[sub].mean())
        res, key = find_access([rect], 2.4, [("any", any_road)], maxd=80)
        if res and res[0] > 2:
            d, p, q, (ei, k), poly = res
            nq = net.attach(ei, k, q.x, q.y)
            net.add([(p.x, p.y), (q.x, q.y)], "footway", net.node(p.x, p.y), nq)
        court_n += 1
print(f"  {court_n} hostel courts")

for st in sites:
    grp = unary_union([bsolid[i] for i in st["ids"]])
    st["compound"] = grp.buffer(KIND_R.get(st["kind"], 10), join_style=2).difference(water_u).intersection(inner_campus)

comps = net.components(is_car)
main = comps[0] if comps else set()
for e in net.edges:
    e["main"] = e["car"] and e["a"] in main and e["b"] in main
print(f"  road graph now {len(net.nodes)} nodes / {len(net.edges)} edges, {len(comps)} drivable components")

# --------------------------------------------------------------------------- trees (ESA WorldCover)
print("Trees ...")
b_obst = unary_union([p.buffer(6.0) for p in bsolid])
r_obst = unary_union([LineString(r["pts"]).buffer(r["w"] / 2 + 1.6) for r in roads])
w_obst = unary_union([Polygon(w["p"]).buffer(1.5) for w in water])
f_obst = unary_union([Polygon(f["p"]).buffer(2 if f.get("gen") else 0) for f in fields if f["kind"] not in ("park",)])
s_obst = unary_union([st["compound"] for st in sites])
p_obst = unary_union([plaza_u.buffer(2)] + [Point(s["x"], s["y"]).buffer(6) for s in sitouts])
obst = unary_union([b_obst, r_obst, w_obst, f_obst, s_obst, p_obst])
campus_in = boundary.buffer(-3)

cell_lon = (we - ww) / wc.shape[1]
cell_lat = (wn - ws) / wc.shape[0]
tx_list, ty_list, tk_list = [], [], []
for cy in range(wc.shape[0]):
    for cx in range(wc.shape[1]):
        c = wc[cy, cx]
        if c == 10:
            k = 2 if rng.random() < 0.6 else 1
        elif c == 20:
            k = 1 if rng.random() < 0.5 else 0
        elif c in (30, 40):
            k = 1 if rng.random() < 0.12 else 0
        elif c == 50:
            k = 1 if rng.random() < 0.10 else 0
        else:
            k = 0
        for _ in range(k):
            lon = ww + (cx + rng.random()) * cell_lon
            lat = wn - (cy + rng.random()) * cell_lat
            x, y = proj(lon, lat)
            tx_list.append(x); ty_list.append(y); tk_list.append(c)
tx_a, ty_a, tk_a = np.array(tx_list), np.array(ty_list), np.array(tk_list)
keep = contains_xy(campus_in, tx_a, ty_a) & ~contains_xy(obst, tx_a, ty_a)
tx_a, ty_a, tk_a = tx_a[keep], ty_a[keep], tk_a[keep]

# avenue trees along campus roads (IITG roads are tree-lined)
av = []
for r in roads:
    if r["kind"] not in ("residential", "unclassified", "tertiary", "secondary"):
        continue
    ls = LineString(r["pts"])
    d = 6.0
    while d < ls.length - 4:
        p0 = ls.interpolate(d); p1 = ls.interpolate(min(ls.length, d + 1))
        dx, dy = p1.x - p0.x, p1.y - p0.y
        L = math.hypot(dx, dy) or 1
        nx_, ny_ = -dy / L, dx / L
        for side in (-1, 1):
            if rng.random() < 0.55:
                off = r["w"] / 2 + 2.6 + rng.random() * 1.2
                av.append((p0.x + nx_ * off * side, p0.y + ny_ * off * side))
        d += 11 + rng.random() * 6
# ornamental trees lining hostel / academic compounds, and a few shade trees in courtyards
orn = []
for st in sites:
    if st["kind"] not in ("hostel", "academic", "admin", "culture", "service"):
        continue
    for poly in polys_of(st["compound"]):
        ring = poly.exterior
        n = int(ring.length / 12)
        for s in range(n):
            if rng.random() < 0.55:
                p = ring.interpolate((s + rng.random() * 0.4) / max(n, 1), normalized=True)
                orn.append((p.x, p.y))
court_yards = []
for b in buildings:
    for h in b["holes"]:
        cy_ = Polygon(h)
        if cy_.area < 250:
            continue
        court_yards.append(cy_)
        inner = cy_.buffer(-5)
        if inner.is_empty:
            continue
        x0, y0, x1, y1 = inner.bounds
        for _ in range(min(4, 1 + int(cy_.area / 700))):
            for _t in range(20):
                x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
                if inner.contains(Point(x, y)):
                    orn.append((x, y)); break
av = np.array(av + orn) if (av or orn) else np.zeros((0, 2))
n_orn = len(orn)
if len(av):
    hard = unary_union([b_obst.difference(unary_union(court_yards).buffer(-4)) if court_yards else b_obst, r_obst, w_obst, f_obst, p_obst])
    ok = contains_xy(campus_in, av[:, 0], av[:, 1]) & ~contains_xy(hard, av[:, 0], av[:, 1])
    is_orn = np.arange(len(av)) >= len(av) - n_orn
    av, is_orn = av[ok], is_orn[ok]
else:
    is_orn = np.zeros(0, bool)
# species: 0 broadleaf, 1 areca palm, 2 bamboo clump, 3 flowering (gulmohar), 4 tall sal/teak
species = []
for c in tk_a:
    u = rng.random()
    if c == 10:
        species.append(4 if u < 0.28 else 2 if u < 0.40 else 1 if u < 0.47 else 0)
    elif c == 20:
        species.append(2 if u < 0.35 else 0)
    else:
        species.append(1 if u < 0.35 else 3 if u < 0.5 else 0)
av_species = []
for o in is_orn:
    u = rng.random()
    if o:
        av_species.append(1 if u < 0.38 else 3 if u < 0.58 else 0)
    else:
        av_species.append(3 if u < 0.22 else 1 if u < 0.38 else 0)
all_x = np.concatenate([tx_a, av[:, 0] if len(av) else []])
all_y = np.concatenate([ty_a, av[:, 1] if len(av) else []])
all_s = np.array(species + av_species, dtype=np.int16)
scale = (rng.uniform(0.75, 1.3, len(all_x)) * 100).astype(np.int16)
packed = np.stack([np.round(all_x * 4), np.round(all_y * 4), all_s * 256 + scale], 1).astype(np.int16)
trees_b64 = base64.b64encode(packed.tobytes()).decode()
print(f"  {len(all_x)} trees ({len(av)} avenue / ornamental trees)")

# --------------------------------------------------------------------------- ground texture
print("Painting ground texture ...")
GW = int(round((maxx - minx) / GROUND_RES)); GH = int(round((maxy - miny) / GROUND_RES))
px_x = minx + (np.arange(GW) + 0.5) * GROUND_RES
px_y = maxy - (np.arange(GH) + 0.5) * GROUND_RES          # image row 0 = north
PXX, PXY = np.meshgrid(px_x, px_y)
lonp, latp = unproj(PXX, PXY)
wci = np.clip(((wn - latp) / (wn - ws) * wc.shape[0]).astype(int), 0, wc.shape[0] - 1)
wcj = np.clip(((lonp - ww) / (we - ww) * wc.shape[1]).astype(int), 0, wc.shape[1] - 1)
cls = wc[wci, wcj]
PAL = {10: (40, 66, 30), 20: (72, 94, 44), 30: (92, 128, 52), 40: (106, 130, 58), 50: (122, 118, 102),
       60: (138, 116, 84), 80: (52, 74, 62), 90: (66, 96, 62), 0: (92, 128, 52)}
base = np.zeros((GH, GW, 3), np.float32)
for k, colr in PAL.items():
    base[cls == k] = colr
for c in range(3):
    base[..., c] = ndimage.gaussian_filter(base[..., c], 5)
sat = s2_sample(PXX.ravel(), PXY.ravel()).reshape(GH, GW, 3)
# boost the slightly hazy mosaic: contrast + saturation
mean = sat.mean(-1, keepdims=True)
sat = np.clip((sat - mean) * 1.35 + mean, 0, 255)
sat = np.clip((sat - 90) * 1.1 + 84, 0, 255)
sat = np.where(sat > 125, 125 + (sat - 125) * 0.35, sat)   # tame bright plazas / roofs in the imagery
col = base * 0.6 + sat * 0.4
noise_f = rng.normal(0, 1, (GH, GW)).astype(np.float32)
noise_m = ndimage.gaussian_filter(rng.normal(0, 1, (GH // 8 + 1, GW // 8 + 1)).astype(np.float32), 1.5)
noise_m = ndimage.zoom(noise_m, (GH / noise_m.shape[0], GW / noise_m.shape[1]), order=1)[:GH, :GW]
noise_m /= (noise_m.std() + 1e-6)
col *= (1 + 0.05 * noise_f + 0.07 * noise_m)[..., None]


def to_px(pts):
    return [((x - minx) / GROUND_RES, (maxy - y) / GROUND_RES) for x, y in pts]


def paint(polys, rgb, noise=0.06):
    """Blend a flat colour (with a little texture) into col wherever the polygons are."""
    m = Image.new("L", (GW, GH), 0)
    md_ = ImageDraw.Draw(m)
    for poly in polys:
        for p in polys_of(poly):
            md_.polygon(to_px(p.exterior.coords), fill=255)
            for i in p.interiors:
                md_.polygon(to_px(i.coords), fill=0)
    a = np.asarray(m.filter(ImageFilter.GaussianBlur(1.2)), np.float32)[..., None] / 255.0
    tex = np.array(rgb, np.float32) * (1 + noise * noise_f[..., None] * 0.6 + noise * noise_m[..., None])
    col[:] = col * (1 - a) + tex * a


LAWN, PAVE = (100, 146, 64), (150, 146, 136)
paint([st["compound"] for st in sites], LAWN, 0.07)            # mown compound lawns
img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
dr = ImageDraw.Draw(img)


def fill_poly(poly, colr):
    for p in polys_of(poly):
        dr.polygon(to_px(p.exterior.coords), fill=colr)


# building aprons / plinths
for p in bshapes:
    fill_poly(Polygon(p.exterior).buffer(2.2, join_style=2), (126, 121, 110))
col = np.asarray(img).astype(np.float32)
paint(court_yards, (96, 142, 62), 0.07)                         # courtyards are lawns, not concrete
paint([Polygon(pl["p"]) for pl in plazas], PAVE, 0.05)           # forecourts
paint([Point(s["x"], s["y"]).buffer(4.5) for s in sitouts], PAVE, 0.05)
img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
dr = ImageDraw.Draw(img)
for cy_ in court_yards:                                         # cross paths through the courtyards
    c = cy_.centroid
    ang = long_angle(cy_)
    for a_ in (ang, ang + math.pi / 2):
        ln = LineString([(c.x - math.cos(a_) * 400, c.y - math.sin(a_) * 400), (c.x + math.cos(a_) * 400, c.y + math.sin(a_) * 400)]).intersection(cy_.buffer(-1))
        for seg in getattr(ln, "geoms", [ln]):
            if not seg.is_empty and seg.geom_type == "LineString":
                dr.line(to_px(seg.coords), fill=(168, 152, 122), width=2)
# fields
FCOL = {"athletics": (168, 78, 58), "soccer": (78, 138, 58), "hockey": (60, 128, 72), "cricket": (86, 140, 60),
        "basketball": (150, 150, 146), "tennis": (58, 112, 96), "volleyball": (176, 140, 100), "park": (98, 142, 66),
        "ground": (96, 136, 62)}
for f in fields:
    poly = Polygon(f["p"])
    fill_poly(poly, FCOL.get(f["kind"], (96, 136, 62)))
    if f["kind"] == "athletics":
        inner = poly.buffer(-7.5)
        fill_poly(inner, (80, 140, 58))
        ex = inner.buffer(-1.5)
        for p in polys_of(ex):
            dr.line(to_px(p.exterior.coords), fill=(236, 236, 228), width=1)
    elif f["kind"] in ("soccer", "hockey", "basketball", "tennis", "volleyball"):
        ex = poly.buffer(-2 if f["kind"] in ("soccer", "hockey") else -0.8)
        for p in polys_of(ex):
            dr.line(to_px(p.exterior.coords), fill=(236, 236, 228), width=1)
        if f.get("gen"):
            c = poly.centroid
            a_ = f["angle"]
            hw = f["wid"] / 2 - 0.8
            dr.line(to_px([(c.x - math.sin(a_) * hw, c.y + math.cos(a_) * hw), (c.x + math.sin(a_) * hw, c.y - math.cos(a_) * hw)]), fill=(236, 236, 228), width=1)
    elif f["kind"] == "cricket":
        c = poly.centroid
        a = f["angle"]
        dx, dy = math.cos(a), math.sin(a)
        nx_, ny_ = -dy, dx
        strip = [(c.x + dx * 10 + nx_ * 1.5, c.y + dy * 10 + ny_ * 1.5), (c.x - dx * 10 + nx_ * 1.5, c.y - dy * 10 + ny_ * 1.5),
                 (c.x - dx * 10 - nx_ * 1.5, c.y - dy * 10 - ny_ * 1.5), (c.x + dx * 10 - nx_ * 1.5, c.y + dy * 10 - ny_ * 1.5)]
        dr.polygon(to_px(strip), fill=(190, 170, 120))
# water + shores
for w in water:
    poly = Polygon(w["p"], w["holes"])
    if w["kind"] != "pool":
        fill_poly(poly.buffer(3.5), (104, 96, 70))
    fill_poly(poly, (46, 76, 72) if w["kind"] != "pool" else (70, 170, 200))
# road beds (the 3D road meshes sit on top of these)
for r in sorted(roads, key=lambda r: r["w"]):
    pts = to_px(r["pts"])
    if r["kind"] in ("footway", "path", "steps", "track"):
        dr.line(pts, fill=(158, 140, 108), width=max(2, int(r["w"] + 1)), joint="curve")
    else:
        dr.line(pts, fill=(84, 83, 80), width=int(r["w"] + 2.5), joint="curve")
img = img.filter(ImageFilter.GaussianBlur(0.6))
img.save(os.path.join(OUT, "ground.jpg"), quality=84, optimize=True)

mask = Image.new("L", (GW // 2, GH // 2), 0)
md = ImageDraw.Draw(mask)
md.polygon([((x - minx) / (2 * GROUND_RES), (maxy - y) / (2 * GROUND_RES)) for x, y in boundary.exterior.coords], fill=255)
for w in water:   # swimming pools: cut the ground away so the tiled basin shows
    if w["kind"] == "pool":
        md.polygon([((x - minx) / (2 * GROUND_RES), (maxy - y) / (2 * GROUND_RES)) for x, y in Polygon(w["p"]).buffer(0.8, join_style=2).exterior.coords], fill=0)
mask.save(os.path.join(OUT, "mask.png"), optimize=True)
print(f"  ground {GW}x{GH}px, mask {GW // 2}x{GH // 2}px")

# --------------------------------------------------------------------------- write
hq = np.round(H * 10).astype(np.int16)
for st in sites:
    st.pop("compound", None)
out = {
    "meta": {
        "name": "IIT Guwahati",
        "origin": [LON0, LAT0],
        "bounds": [r1(minx), r1(miny), r1(maxx), r1(maxy)],
        "areaHa": round(boundary.area / 1e4, 1),
        "hmin": r1(float(H[contains_xy(boundary, GX, GY)].min())),
        "hmax": r1(float(H[contains_xy(boundary, GX, GY)].max())),
        "sources": [
            "Map data (c) OpenStreetMap contributors, ODbL",
            "Buildings: Overture Maps Foundation (OpenStreetMap, Google Open Buildings, Microsoft ML Buildings), ODbL",
            "Places: Overture Maps Foundation, CDLA-Permissive-2.0",
            "Elevation: AWS Terrain Tiles (SRTM / NASADEM)",
            "Land cover: ESA WorldCover 2021 v200, CC BY 4.0",
            "Imagery: Sentinel-2 cloudless 2024 by EOX IT Services GmbH (contains modified Copernicus Sentinel data), CC BY-NC-SA 4.0",
        ],
    },
    "boundary": ring_out(boundary.exterior.coords),
    "terrain": {"minx": r1(minx), "miny": r1(miny), "cell": TERRAIN_CELL, "nx": NX, "ny": NY,
                "data": base64.b64encode(hq.tobytes()).decode()},
    "ground": {"bounds": [r1(minx), r1(miny), r1(maxx), r1(maxy)], "w": GW, "h": GH},
    "buildings": buildings,
    "roads": roads,
    "graph": {"nodes": net.nodes, "edges": net.edges},
    "water": water,
    "fields": fields,
    "trees": trees_b64,
    "landmarks": landmarks,
    "pois": pois,
    "gates": gates,
    "sites": sites,
    "plazas": plazas,
    "sitouts": sitouts,
}
with open(os.path.join(OUT, "campus.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, separators=(",", ":"), ensure_ascii=False)
print(f"Wrote data/campus.json ({os.path.getsize(os.path.join(OUT, 'campus.json')) / 1e6:.2f} MB)")
