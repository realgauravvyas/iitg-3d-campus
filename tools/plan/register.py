"""Register the 2011 IITG master plan (PDF, AutoCAD vector export) onto the game's map coordinates.

The plan is used only as a *reference* (it is IIT Guwahati's document and is not shipped with the
game). This script:
  1. reads the plan's road layer (black strokes = road edges, incl. the roundabout circles),
  2. draws the game's road edges (OSM centre lines offset by half the road width),
  3. fits a similarity transform plan-pt -> map metres (start from a rough guess, refine with ICP),
  4. writes tools/plan/transform.json and an overlay image to check the fit by eye.
Map coordinates: x east, y north, metres (as in data/campus.json).
"""
import json
import os

import fitz
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PDF = os.path.join(ROOT, "Master plan with contour_original Plan _ 2011.pdf")


def bez(p0, p1, p2, p3, n=8):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def plan_polylines(colour, tol=0.02, min_len=0.0):
    """all stroked paths of one colour as lists of points (pt units)"""
    d = fitz.open(PDF)
    out = []
    for x in d[0].get_drawings():
        c = x.get("color")
        if not c or any(abs(a - b) > tol for a, b in zip(c, colour)):
            continue
        for it in x["items"]:
            if it[0] == "l":
                a, b = it[1], it[2]
                seg = np.array([[a.x, a.y], [b.x, b.y]])
            elif it[0] == "c":
                seg = bez(*[np.array([q.x, q.y]) for q in it[1:5]])
            else:
                continue
            L = np.linalg.norm(np.diff(seg, axis=0), axis=1).sum()
            if L >= min_len:
                out.append(seg)
    return out


def sample(polys, step):
    pts = []
    for P in polys:
        for a, b in zip(P[:-1], P[1:]):
            L = np.linalg.norm(b - a)
            n = max(1, int(L / step))
            for t in np.arange(n) / n:
                pts.append(a + (b - a) * t)
    return np.array(pts)


def game_edges(data):
    """road *edges* (centre line +- half width) of the drivable roads, map coords"""
    polys = []
    for r in data["roads"]:
        if r["kind"] in ("footway", "path", "steps", "pedestrian", "track", "cycleway", "service"):
            continue
        P = np.array(r["pts"], float)
        if len(P) < 2:
            continue
        hw = r["w"] / 2
        t = np.gradient(P, axis=0)
        t /= np.linalg.norm(t, axis=1, keepdims=True) + 1e-9
        n = np.stack([-t[:, 1], t[:, 0]], 1)
        polys += [P + n * hw, P - n * hw]
    return polys


def umeyama(src, dst):
    """similarity (s, R, t) minimising |s R src + t - dst|"""
    ms, md = src.mean(0), dst.mean(0)
    A, B = src - ms, dst - md
    U, S, Vt = np.linalg.svd(B.T @ A / len(src))
    D = np.eye(2)
    if np.linalg.det(U @ Vt) < 0:
        D[1, 1] = -1
    R = U @ D @ Vt
    s = np.trace(np.diag(S) @ D) / (A ** 2).sum(1).mean()
    t = md - s * R @ ms
    return s, R, t


def main():
    data = json.load(open(os.path.join(ROOT, "data", "campus.json"), encoding="utf-8"))
    # plan road edges (black), ignore tiny strokes (text)
    black = plan_polylines((0, 0, 0), min_len=2.0)
    P = sample(black, 1.0)                                     # pt
    # keep only the campus part of the sheet (drop the frame / legend area)
    P = P[(P[:, 0] > 60) & (P[:, 0] < 580) & (P[:, 1] > 60) & (P[:, 1] < 640)]
    G = sample(game_edges(data), 3.0)                          # m
    tree = cKDTree(G)
    # the sheet's y axis points down: flip it, then fit a proper similarity (scale, rotation, shift)
    F = np.array([1.0, -1.0])
    Pf = P * F
    # rough start: 100 m per grid cell (26.76 pt), north up, anchored on the View Point hill top
    s = 100 / 26.76
    R = np.eye(2)
    t = np.array([-218.6, 538.5]) - s * (np.array([244.1, 311.8]) * F)
    for it, thr in enumerate([80, 60, 45, 35, 25, 20, 15, 12, 10, 8, 8, 8, 6, 6]):
        Q = (s * (R @ Pf.T)).T + t
        d, idx = tree.query(Q)
        ok = d < thr
        s, R, t = umeyama(Pf[ok], G[idx[ok]])
        print(f"iter {it:2d} thr {thr:3d}  used {ok.mean() * 100:5.1f}%  median {np.median(d[ok]):5.2f} m  scale {s:.4f} m/pt  rot {np.degrees(np.arctan2(R[1, 0], R[0, 0])):7.3f} deg")
    Rf = R
    Q = (s * (R @ Pf.T)).T + t
    d, _ = tree.query(Q)
    tr = {"s": s, "R": Rf.tolist(), "t": t.tolist(), "flipY": True, "note": "map = s * R @ [x_pt, -y_pt] + t", "median_err_m": float(np.median(d[d < 15])), "inliers": float((d < 8).mean())}
    json.dump(tr, open(os.path.join(HERE, "transform.json"), "w"), indent=1)
    print(json.dumps(tr))

    # overlay: plan roads (grey) + game roads (red) + game water (blue) + buildings
    x0, y0, x1, y1 = -1000, -950, 1150, 1500
    k = 0.6
    W, H = int((x1 - x0) * k), int((y1 - y0) * k)
    im = Image.new("RGB", (W, H), "white")
    g = ImageDraw.Draw(im)
    X = lambda p: ((p[0] - x0) * k, (y1 - p[1]) * k)
    for b in data["buildings"]:
        g.polygon([X(q) for q in b["p"]], fill=(225, 222, 210))
    for w in data["water"]:
        g.polygon([X(q) for q in w["p"]], fill=(150, 190, 235))
    for poly in black:
        Qp = (s * (Rf @ (poly * F).T)).T + t
        g.line([X(q) for q in Qp], fill=(90, 90, 90), width=1)
    for r in data["roads"]:
        if r["kind"] in ("footway", "path", "steps", "pedestrian", "track", "cycleway"):
            continue
        g.line([X(q) for q in r["pts"]], fill=(220, 30, 30), width=1)
    im.save(os.path.join(HERE, "overlay.png"))
    print("overlay", W, H)


if __name__ == "__main__":
    main()
