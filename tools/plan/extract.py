"""Pull useful facts out of the registered master plan, in map coordinates (x east, y north, m):
roundabout circles, lake outlines, text labels (quarter types, bus stands, facilities, hostels).
Writes tools/plan/plan_features.json. Uses tools/plan/transform.json from register.py."""
import json
import os

import fitz
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PDF = os.path.join(ROOT, "Master plan with contour_original Plan _ 2011.pdf")
T = json.load(open(os.path.join(HERE, "transform.json")))
S, R, TT = T["s"], np.array(T["R"]), np.array(T["t"])


def to_map(p):
    p = np.asarray(p, float).reshape(-1, 2) * np.array([1.0, -1.0])
    return (S * (R @ p.T)).T + TT


def bez(p0, p1, p2, p3, n=12):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def paths(colour, tol=0.02):
    """each drawing (AutoCAD object) of one stroke colour as one list of point runs"""
    d = fitz.open(PDF)
    out = []
    for x in d[0].get_drawings():
        c = x.get("color")
        if not c or any(abs(a - b) > tol for a, b in zip(c, colour)):
            continue
        run, runs = [], []
        for it in x["items"]:
            if it[0] == "l":
                seg = np.array([[it[1].x, it[1].y], [it[2].x, it[2].y]])
            elif it[0] == "c":
                seg = bez(*[np.array([q.x, q.y]) for q in it[1:5]])
            else:
                continue
            if run and np.linalg.norm(run[-1] - seg[0]) < 0.05:
                run += list(seg[1:])
            else:
                if len(run) > 1:
                    runs.append(np.array(run))
                run = list(seg)
        if len(run) > 1:
            runs.append(np.array(run))
        out.append({"runs": runs, "width": x.get("width"), "fill": x.get("fill")})
    return out


def circle_fit(P):
    """least-squares circle: centre, radius, rms"""
    A = np.c_[2 * P, np.ones(len(P))]
    b = (P ** 2).sum(1)
    c, *_ = np.linalg.lstsq(A, b, rcond=None)
    cx, cy = c[0], c[1]
    r = np.sqrt(c[2] + cx ** 2 + cy ** 2)
    rms = np.sqrt(((np.linalg.norm(P - [cx, cy], axis=1) - r) ** 2).mean())
    return np.array([cx, cy]), r, rms


def main():
    feats = {"roundabouts": [], "lakes": [], "labels": []}
    # ---- roundabouts: closed, near-perfect circles of 2-8 m radius in the road layer
    cands = []
    for d in paths((0, 0, 0)):
        for run in d["runs"]:
            M = to_map(run)
            if len(M) < 8:
                continue
            closed = np.linalg.norm(M[0] - M[-1]) < 1.5
            L = np.linalg.norm(np.diff(M, axis=0), axis=1).sum()
            if not closed or L < 12:
                continue
            c, r, rms = circle_fit(M)
            if 2.0 < r < 16 and rms < 0.35:
                cands.append((c, r))
    # group concentric circles (island + outer ring)
    groups = []
    for c, r in cands:
        for g in groups:
            if np.linalg.norm(g["c"] - c) < 4:
                g["r"].append(r)
                break
        else:
            groups.append({"c": c, "r": [r]})
    for g in groups:
        feats["roundabouts"].append({"x": round(float(g["c"][0]), 1), "y": round(float(g["c"][1]), 1), "radii": sorted(round(float(v), 1) for v in g["r"])})
    # ---- lakes: large closed blue outlines
    for d in paths((0, 0, 1)):
        for run in d["runs"]:
            M = to_map(run)
            if len(M) < 10 or np.linalg.norm(M[0] - M[-1]) > 3:
                continue
            x, y = M[:, 0], M[:, 1]
            area = 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
            if area < 800:
                continue
            feats["lakes"].append({"area": round(float(area)), "c": [round(float(x.mean()), 1), round(float(y.mean()), 1)], "p": [[round(float(a), 1), round(float(b), 1)] for a, b in M[:: max(1, len(M) // 120)]]})
    # ---- text labels
    d = fitz.open(PDF)
    words = []
    for b in d[0].get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            txt = " ".join(s["text"].strip() for s in ln["spans"] if s["text"].strip())
            if not txt:
                continue
            x0, y0, x1, y1 = ln["bbox"]
            m = to_map([((x0 + x1) / 2, (y0 + y1) / 2)])[0]
            words.append({"text": txt, "x": round(float(m[0]), 1), "y": round(float(m[1]), 1), "size": round(ln["spans"][0]["size"], 1)})
    feats["labels"] = words
    json.dump(feats, open(os.path.join(HERE, "plan_features.json"), "w"), indent=1)
    print("roundabouts", len(feats["roundabouts"]))
    for r in feats["roundabouts"]:
        print("  ", r)
    print("lakes", len(feats["lakes"]))
    for l in sorted(feats["lakes"], key=lambda q: -q["area"])[:20]:
        print("  area", l["area"], "centre", l["c"])
    print("labels", len(words))


if __name__ == "__main__":
    main()
