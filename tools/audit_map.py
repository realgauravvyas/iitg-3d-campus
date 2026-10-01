"""Logic audit of the processed campus: road connectivity, dead ends, building access,
trees crowding buildings. Prints a report; does not modify anything."""
import json, math, os, base64
from collections import defaultdict
import numpy as np
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union
from shapely import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(ROOT, "data", "campus.json"), encoding="utf-8"))

nodes = D["graph"]["nodes"]
edges = D["graph"]["edges"]
deg = defaultdict(int)
adj = defaultdict(set)
for e in edges:
    deg[e["a"]] += 1; deg[e["b"]] += 1
    adj[e["a"]].add(e["b"]); adj[e["b"]].add(e["a"])

# components of the whole network
seen, comps = set(), []
for s in range(len(nodes)):
    if s in seen or not adj[s]:
        continue
    comp, st = set(), [s]
    while st:
        u = st.pop()
        if u in comp:
            continue
        comp.add(u); st.extend(adj[u])
    seen |= comp
    comps.append(comp)
comps.sort(key=len, reverse=True)
print(f"network: {len(nodes)} nodes, {len(edges)} edges, {len(comps)} components, sizes {[len(c) for c in comps[:12]]}")
for c in comps[1:]:
    xs = [nodes[i] for i in c]
    cx = sum(p[0] for p in xs) / len(xs); cy = sum(p[1] for p in xs) / len(xs)
    kinds = {e["kind"] for e in edges if e["a"] in c}
    L = sum(e["len"] for e in edges if e["a"] in c)
    print(f"   island {len(c)} nodes at ({cx:.0f},{cy:.0f}) kinds={kinds} length={L:.0f} m")

B = [Polygon(b["p"]) for b in D["buildings"]]
tree = STRtree(B)
dead = [i for i in range(len(nodes)) if deg[i] == 1]
print(f"dead ends: {len(dead)}")
bnd = Polygon(D["boundary"])
nowhere = []
dest = unary_union([Polygon(f["p"]) for f in D["fields"]] + [Polygon(p["p"]) for p in D.get("plazas", [])] +
                   [Point(s["x"], s["y"]).buffer(5) for s in D.get("sitouts", [])])
for i in dead:
    p = Point(nodes[i])
    j = tree.nearest(p)
    d = B[j].distance(p)
    db = bnd.exterior.distance(p)
    e = next(e for e in edges if e["a"] == i or e["b"] == i)
    if d > 25 and db > 12 and dest.distance(p) > 8:
        nowhere.append((i, d, e["kind"], e["len"]))
print(f"dead ends not near a building (>25 m) nor the wall: {len(nowhere)}")
for i, d, k, L in nowhere[:40]:
    print(f"   node {i} at ({nodes[i][0]:.0f},{nodes[i][1]:.0f}) {k} len={L:.0f} nearest building {d:.0f} m")

roads = [LineString(r["pts"]) for r in D["roads"]]
car_roads = [LineString(r["pts"]) for r in D["roads"] if r["kind"] in ("primary", "secondary", "tertiary", "unclassified", "residential", "service", "living_street")]
R = unary_union(roads); RC = unary_union(car_roads)
print("\nnamed buildings -> distance to nearest road / drivable road")
far = 0
for b, p in zip(D["buildings"], B):
    if not b["name"]:
        continue
    d, dc = p.distance(R), p.distance(RC)
    flag = "  <-- no access" if dc > 25 else ""
    print(f"   {b['name'][:34]:34s} {b['kind']:10s} any {d:5.0f} m  car {dc:5.0f} m{flag}")
un = [p.distance(R) for b, p in zip(D["buildings"], B) if not b["name"]]
un = np.array(un)
print(f"unnamed buildings: {len(un)}, >40 m from any road: {(un > 40).sum()}, >80 m: {(un > 80).sum()}")

road_surf = unary_union([LineString(r["pts"]).buffer(r["w"] / 2) for r in D["roads"]])
water = unary_union([Polygon(w["p"]) for w in D["water"]])
fields = unary_union([Polygon(f["p"]) for f in D["fields"] if f["kind"] != "park"])
ov_r = [(b, p.intersection(road_surf).area) for b, p in zip(D["buildings"], B)]
ov_r = [(b, a) for b, a in ov_r if a > 4]
print(f"\nbuildings overlapping road surface: {len(ov_r)}")
for b, a in sorted(ov_r, key=lambda t: -t[1])[:15]:
    print(f"   {b['name'] or b['id']} {b['kind']} src={b['src']} overlap {a:.0f} m2")
ov_w = [(b, p.intersection(water).area) for b, p in zip(D["buildings"], B) if p.intersects(water)]
print(f"buildings overlapping water: {len(ov_w)} {[ (b['id'], round(a)) for b, a in ov_w][:10]}")
ov_f = [(b, p.intersection(fields).area) for b, p in zip(D["buildings"], B) if p.intersects(fields)]
print(f"buildings overlapping sports fields: {len(ov_f)} {[ (b['id'], round(a)) for b, a in ov_f if a > 5][:10]}")
dup = 0
for i, p in enumerate(B):
    for j in tree.query(p):
        if j <= i:
            continue
        a = p.intersection(B[j]).area
        if a > 0.3 * min(p.area, B[j].area):
            dup += 1
print(f"overlapping building pairs (>30% of smaller): {dup}")

raw = np.frombuffer(base64.b64decode(D["trees"]), dtype=np.int16).reshape(-1, 3)
tx, ty = raw[:, 0] / 4, raw[:, 1] / 4
print(f"\ntrees: {len(tx)}")
for lm in D["landmarks"]:
    if lm["id"] not in ("brahmaputra", "lohit", "dihing", "manas", "umiam", "barak", "kameng", "gaurang", "siang",
                        "kapili", "dibang", "disang", "subansiri", "dhansiri", "msh", "academic", "lhc", "library"):
        continue
    pt = Point(lm["x"], lm["y"])
    j = tree.nearest(pt)
    poly = B[j]
    ring = poly.buffer(25).difference(poly)
    a = ring.area
    from shapely import contains_xy
    n = contains_xy(ring, tx, ty).sum()
    print(f"   {lm['name'][:24]:24s} trees within 25 m of walls: {n:4d}  ({n / a * 1000:.1f} per 1000 m2)")
