"""Download building footprints + named places for IITG from Overture Maps.

Overture merges OpenStreetMap with Microsoft and Google's satellite-derived
(ML) building footprints, so it covers the many campus buildings that
nobody has traced in OSM yet. Queried straight from the public S3 bucket
with DuckDB; only row groups overlapping the campus bbox are read.

Licences: buildings ODbL, places CDLA-Permissive-2.0.

Usage:  python tools/fetch_overture.py   (after fetch_data.py)
"""
import json
import os

import duckdb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
RELEASE = "2026-09-23.1"
BASE = f"s3://overturemaps-us-west-2/release/{RELEASE}"


def campus_bbox(pad=0.001):
    osm = json.load(open(os.path.join(RAW, "osm_campus.json"), encoding="utf-8"))
    b = next(e for e in osm["elements"] if e["type"] == "way" and e["id"] == 52435139)
    lats = [p["lat"] for p in b["geometry"]]
    lons = [p["lon"] for p in b["geometry"]]
    return min(lons) - pad, min(lats) - pad, max(lons) + pad, max(lats) + pad


def main():
    w, s, e, n = campus_bbox()
    con = duckdb.connect()
    for ext in ("httpfs", "spatial"):
        con.execute(f"INSTALL {ext}; LOAD {ext};")
    con.execute("SET s3_region='us-west-2';")
    where = f"bbox.xmin < {e} AND bbox.xmax > {w} AND bbox.ymin < {n} AND bbox.ymax > {s}"

    print("Querying Overture buildings (reads only matching row groups) ...")
    rows = con.execute(f"""
        SELECT id, ST_AsGeoJSON(geometry) AS geom, height, num_floors,
               names.primary AS name, class, subtype, roof_shape,
               list_transform(sources, x -> x.dataset) AS sources
        FROM read_parquet('{BASE}/theme=buildings/type=building/*', hive_partitioning=1)
        WHERE {where}
    """).fetchall()
    cols = ["id", "geom", "height", "num_floors", "name", "class", "subtype",
            "roof_shape", "sources"]
    feats = [dict(zip(cols, r)) for r in rows]
    for f in feats:
        f["geom"] = json.loads(f["geom"])
    with open(os.path.join(RAW, "overture_buildings.json"), "w", encoding="utf-8") as fh:
        json.dump(feats, fh)
    print(f"  {len(feats)} buildings")

    print("Querying Overture places ...")
    rows = con.execute(f"""
        SELECT id, ST_X(geometry) AS lon, ST_Y(geometry) AS lat,
               names.primary AS name, basic_category AS category, confidence
        FROM read_parquet('{BASE}/theme=places/type=place/*', hive_partitioning=1)
        WHERE {where}
    """).fetchall()
    cols = ["id", "lon", "lat", "name", "category", "confidence"]
    places = [dict(zip(cols, r)) for r in rows]
    with open(os.path.join(RAW, "overture_places.json"), "w", encoding="utf-8") as fh:
        json.dump(places, fh)
    print(f"  {len(places)} places")


if __name__ == "__main__":
    main()
