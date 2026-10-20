#!/usr/bin/env python3
"""Turn the OSM extract in tools/data into the JSON the app loads.

Source: OpenStreetMap, ODbL 1.0. Extract bounds 12.9707,77.5898 to
12.9819,77.6112 (central Bengaluru: Cubbon Park, MG Road, Brigade Road).
Metro station coordinates and line order come from the public OSM snapshot
kept in tools/data/metro_source.json (also OSM derived).

Output (app/data/):
  meta.json    bounds, counts, attribution
  roads.json   polylines by class
  areas.json   parks, water, pitches, buildings
  places.json  named points of interest with OSM tags
  graph.json   routing graph: junction nodes and edges, per mode flags
  metro.json   metro lines and stations

Run: python3 tools/build_dataset.py
"""

import json
import math
import os
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "data", "sample_bengaluru.osm")
OUT = os.path.join(ROOT, "app", "data")

DRIVE = {"motorway", "trunk", "primary", "secondary", "tertiary",
         "unclassified", "residential", "living_street", "service",
         "motorway_link", "trunk_link", "primary_link", "secondary_link",
         "tertiary_link"}
BIKE = {"primary", "secondary", "tertiary", "unclassified", "residential",
        "living_street", "service", "pedestrian", "path", "track",
        "footway", "bridleway", "primary_link", "secondary_link",
        "tertiary_link"}
WALK = DRIVE | {"pedestrian", "footway", "steps", "path", "track",
                "bridleway", "corridor"}

CLASS = {
    "motorway": "primary", "trunk": "primary", "primary": "primary",
    "primary_link": "primary", "motorway_link": "primary", "trunk_link": "primary",
    "secondary": "secondary", "secondary_link": "secondary",
    "tertiary": "tertiary", "tertiary_link": "tertiary",
    "unclassified": "residential", "residential": "residential",
    "living_street": "residential",
    "service": "service",
    "pedestrian": "path", "footway": "path", "steps": "path",
    "path": "path", "track": "path", "bridleway": "path", "corridor": "path",
}
CLASSES = ["primary", "secondary", "tertiary", "residential", "service", "path"]
CLS_IX = {c: i for i, c in enumerate(CLASSES)}
# mode bits
M_DRIVE, M_BIKE, M_WALK = 1, 2, 4
NOISY = {"primary": 78, "secondary": 62, "tertiary": 46, "residential": 30,
         "service": 22, "path": 12}

FOOD = {"restaurant", "fast_food", "cafe", "pub", "bar", "food_court",
        "ice_cream", "bakery", "biergarten"}
CIVIC = {"bank", "atm", "post_office", "police", "courthouse", "embassy",
         "government", "townhall", "fire_station", "prison", "fuel",
         "parking", "toilets", "community_centre", "arts_centre"}
HEALTH = {"hospital", "pharmacy", "clinic", "doctors", "dentist",
          "veterinary", "nursing_home"}
CULTURE = {"museum", "theatre", "cinema", "library", "arts_centre",
           "planetarium", "gallery", "archive"}
EDU = {"school", "university", "college", "kindergarten", "language_school",
       "driving_school", "music_school"}
WORSHIP = {"place_of_worship"}
STAY = {"hotel", "hostel", "guest_house", "motel", "apartment"}
SHOP_KEEP = {"mall", "department_store", "books", "clothes", "shoes",
             "jewelry", "electronics", "computers", "gift", "art",
             "craft", "music", "sports", "toys", "bag", "watches",
             "cosmetics", "convenience", "supermarket", "bakery",
             "car", "motorcycle", "bicycle", "furniture", "hardware",
             "optician", "photo", "stationery", "travel_agency"}
LEISURE = {"park", "garden", "pitch", "sports_centre", "swimming_pool",
           "stadium", "playground", "fitness_centre", "track"}

KEEP_TAGS = {"opening_hours", "wheelchair", "cuisine", "phone",
             "contact:phone", "website", "contact:website", "housenumber",
             "street", "suburb", "postcode", "outdoor_seating", "takeaway",
             "delivery", "brand", "level", "operator", "religion",
             "denomination", "sport", "shop", "amenity", "tourism",
             "leisure", "historic", "railway", "public_transport",
             "healthcare", "office", "building", "smoking", "air_conditioning",
             "internet_access", "payment:cards", "diet:vegetarian",
             "step_free", "elevator"}


def tags_of(el):
    return {t.get("k"): t.get("v") for t in el.findall("tag")}


def haversine(a_lon, a_lat, b_lon, b_lat):
    r = 6371008.8
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = p2 - p1
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def lonlat_m(lat):
    return 111320.0 * math.cos(math.radians(lat)), 110540.0


def simplify(pts, tol_m):
    """Douglas-Peucker in metres, keeps endpoints."""
    if len(pts) < 3:
        return pts
    mx, my = lonlat_m(pts[0][1])
    xy = [((p[0]) * mx, (p[1]) * my) for p in pts]

    def rec(i, j, keep):
        if j <= i + 1:
            return
        ax, ay = xy[i]
        bx, by = xy[j]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)
        best, bi = -1.0, -1
        for k in range(i + 1, j):
            px, py = xy[k]
            if norm == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, bi = d, k
        if best > tol_m:
            keep.add(bi)
            rec(i, bi, keep)
            rec(bi, j, keep)

    keep = {0, len(pts) - 1}
    rec(0, len(pts) - 1, keep)
    return [pts[k] for k in sorted(keep)]


def ring_area_m2(pts):
    if len(pts) < 3:
        return 0.0
    mx, my = lonlat_m(pts[0][1])
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i][0] * mx, pts[i][1] * my
        x2, y2 = pts[(i + 1) % len(pts)][0] * mx, pts[(i + 1) % len(pts)][1] * my
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def bbox_center(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def classify(t):
    """Return (cat, subcat) for display, or None."""
    a, s, tou, lei, his, rai = (t.get("amenity"), t.get("shop"),
                                t.get("tourism"), t.get("leisure"),
                                t.get("historic"), t.get("railway"))
    pt = t.get("public_transport")
    if rai in ("station", "subway", "halt") or pt == "station":
        return "transit", "metrostation" if rai in ("subway", "station") else "station"
    if rai == "subway_entrance":
        return "transit", "entrance"
    if t.get("highway") == "bus_stop":
        return "transit", "bus"
    if a == "cafe":
        return "cafe", "cafe"
    if a in FOOD:
        return "food", a
    if a in CIVIC:
        return "civic", a
    if a in HEALTH:
        return "health", a
    if a in CULTURE or tou in ("museum", "attraction", "gallery", "artwork", "zoo"):
        return "culture", a or tou
    if a in EDU:
        return "edu", a
    if a in WORSHIP:
        return "worship", "temple"
    if tou == "hotel" or a in STAY:
        return "stay", "hotel"
    if lei in LEISURE:
        return "park", lei
    if s in SHOP_KEEP:
        return "shop", s
    if s:
        return "shop", "shop"
    if his:
        return "culture", his
    if tou:
        return "culture", tou
    if t.get("office"):
        return "office", t["office"]
    return None


def main():
    tree = ET.parse(SRC)
    root = tree.getroot()
    b = root.find("bounds")
    bounds = [float(b.get("minlon")), float(b.get("minlat")),
              float(b.get("maxlon")), float(b.get("maxlat"))]

    nodes, node_tags = {}, {}
    for n in root.findall("node"):
        nid = n.get("id")
        nodes[nid] = (float(n.get("lon")), float(n.get("lat")))
        t = tags_of(n)
        if t:
            node_tags[nid] = t

    ways = []
    for w in root.findall("way"):
        refs = [nd.get("ref") for nd in w.findall("nd")]
        refs = [r for r in refs if r in nodes]
        if len(refs) < 2:
            continue
        ways.append((w.get("id"), refs, tags_of(w)))

    # ---- roads and the routing graph ----
    roads, edges, name_ix, names = [], [], {}, []
    edge_nodes = {}
    refcount = {}
    road_ways = []
    for wid, refs, t in ways:
        hw = t.get("highway")
        if hw not in CLASS or t.get("area") == "yes":
            continue
        cls = CLASS[hw]
        road_ways.append((wid, refs, t, cls, hw))
        for r in refs:
            refcount[r] = refcount.get(r, 0) + 1

    edge_meta = []
    parks_pts = []
    for wid, refs, t in ways:
        if t.get("leisure") in ("park", "garden") or t.get("landuse") == "forest":
            parks_pts.extend(nodes[r] for r in refs)

    for wid, refs, t, cls, hw in road_ways:
        pts = [nodes[r] for r in refs]
        name = t.get("name") or ""
        if name and name not in name_ix:
            name_ix[name] = len(names)
            names.append(name)
        oneway = t.get("oneway", "")
        if t.get("junction") == "roundabout":
            oneway = "yes"
        ow = 1 if oneway in ("yes", "true", "1") else (-1 if oneway == "-1" else 0)
        access = t.get("access", "")
        foot = t.get("foot", "")
        bike = t.get("bicycle", "")
        drive_ok = hw in DRIVE and access not in ("private", "no")
        walk_ok = hw in WALK and access not in ("no",) and foot != "no"
        bike_ok = hw in BIKE and access not in ("private", "no") and bike != "no"
        if cls == "path" and hw == "steps":
            bike_ok = False
        modes = (M_DRIVE if drive_ok else 0) | (M_BIKE if bike_ok else 0) | (M_WALK if walk_ok else 0)
        if not modes:
            continue
        simple = simplify(pts, 1.2 if cls != "path" else 0.8)
        roads.append({
            "i": wid, "c": CLS_IX[cls], "n": name_ix.get(name, -1),
            "p": [[round(x, 5), round(y, 5)] for x, y in simple],
        })

        # graph: split the way at junctions (nodes shared by 2+ ways) and ends
        seg_start = 0
        for i in range(1, len(refs)):
            r = refs[i]
            is_end = i == len(refs) - 1
            is_junction = refcount.get(r, 0) > 1
            if not (is_end or is_junction):
                continue
            seg = refs[seg_start:i + 1]
            if len(seg) >= 2:
                length = sum(haversine(nodes[seg[k]][0], nodes[seg[k]][1],
                                       nodes[seg[k + 1]][0], nodes[seg[k + 1]][1])
                             for k in range(len(seg) - 1))
                if length >= 0.5:
                    edge_meta.append((wid, CLS_IX[cls]))
                    edges.append([seg[0], seg[-1], round(length, 1),
                                  CLS_IX[cls], name_ix.get(name, -1), modes, ow,
                                  1 if hw == "steps" else 0])
            seg_start = i

    # compact node ids, keep only nodes used by edges
    used = {}
    for e in edges:
        for r in (e[0], e[1]):
            if r not in used:
                used[r] = len(used)
    for e in edges:
        e[0] = used[e[0]]
        e[1] = used[e[1]]
    graph_nodes = [[round(nodes[r][0], 5), round(nodes[r][1], 5)] for r in used]

    # noise and shade per edge: class base, a discount near parks
    park_boxes = []
    for north in [None]:
        pass
    pxs = [p[0] for p in parks_pts]
    pys = [p[1] for p in parks_pts]
    if pxs:
        park_boxes = [(min(pxs), min(pys), max(pxs), max(pys))]
    for e in edges:
        x1, y1 = graph_nodes[e[0]]
        x2, y2 = graph_nodes[e[1]]
        base = NOISY[CLASSES[e[3]]]
        midx, midy = (x1 + x2) / 2, (y1 + y2) / 2
        near_park = any(bx0 - 0.004 <= midx <= bx1 + 0.004 and
                        by0 - 0.004 <= midy <= by1 + 0.004
                        for bx0, by0, bx1, by1 in park_boxes)
        noise = max(5, base - (22 if near_park else 0) + (6 if e[4] >= 0 and e[3] <= 1 else 0))
        e.append(int(noise))
    # per way noise: the average of its edges, weighted by length
    way_noise = {}
    for e, (wid, cls) in zip(edges, edge_meta):
        acc = way_noise.setdefault(wid, [0.0, 0.0])
        acc[0] += e[8] * e[2]
        acc[1] += e[2]
    for road in roads:
        acc = way_noise.get(road["i"])
        if acc and acc[1] > 0:
            road["z"] = int(round(acc[0] / acc[1]))

    # ---- areas ----
    parks, water, pitches, buildings = [], [], [], []
    for wid, refs, t in ways:
        if len(refs) < 3 or refs[0] != refs[-1]:
            continue
        pts = [nodes[r] for r in refs[:-1]]
        if len(pts) < 3:
            continue
        tagset = (t.get("leisure"), t.get("natural"), t.get("landuse"), t.get("waterway"))
        kind = None
        bucket = None
        if tagset[1] in ("water", "river", "lake", "pond") or tagset[3] == "riverbank" or t.get("water"):
            bucket, kind = water, "water"
        elif tagset[0] in ("park", "garden", "playground", "stadium", "sports_centre"):
            bucket, kind = parks, tagset[0]
        elif tagset[0] == "pitch" or t.get("sport"):
            bucket, kind = pitches, "pitch"
        elif tagset[1] == "wood" or tagset[2] in ("forest", "grass", "grassland", "meadow"):
            bucket, kind = parks, "green"
        elif t.get("building"):
            bucket, kind = buildings, t.get("building")
        if bucket is None:
            continue
        area = ring_area_m2(pts)
        if bucket is buildings and area < 30:
            continue
        if bucket is not buildings and area < 120:
            continue
        simple = simplify(pts + [pts[0]], 1.5 if bucket is buildings else 3.0)
        if simple[0] == simple[-1]:
            simple = simple[:-1]
        if len(simple) < 3:
            continue
        feature = {
            "i": wid, "p": [[round(x, 5), round(y, 5)] for x, y in simple],
        }
        if bucket is buildings:
            feature["k"] = kind if kind in ("commercial", "residential", "retail", "office", "hotel", "mall", "train_station", "public", "apartments") else "yes"
            feature["a"] = int(round(area))
        else:
            feature["k"] = kind
            if t.get("name"):
                feature["n"] = t["name"]
        bucket.append(feature)

    # ---- places ----
    places = []
    seen = set()
    candidates = []
    for nid, t in node_tags.items():
        if t.get("name"):
            candidates.append((nid, nodes[nid], t, "n"))
    for wid, refs, t in ways:
        if not t.get("name"):
            continue
        if t.get("highway") or t.get("building") and len(refs) < 4:
            continue
        pts = [nodes[r] for r in refs]
        candidates.append((wid, bbox_center(pts), t, "w"))
    for oid, (lon, lat), t, kind in candidates:
        got = classify(t)
        if not got:
            continue
        cat, sub = got
        name = t["name"].strip()
        if not name or len(name) > 80:
            continue
        key = (name.lower(), round(lon, 4), round(lat, 4))
        if key in seen:
            continue
        seen.add(key)
        tags = {k: v for k, v in t.items() if k in KEEP_TAGS}
        place = {
            "id": kind + oid, "n": name, "c": cat, "s": sub,
            "x": round(lon, 5), "y": round(lat, 5),
        }
        if tags:
            place["t"] = tags
        places.append(place)

    # popular-looking places first: named buildings, culture, food, transit
    weight = {"food": 6, "culture": 8, "transit": 7, "park": 5, "shop": 4,
              "stay": 3, "civic": 2, "health": 2, "edu": 2, "worship": 3,
              "office": 1}
    places.sort(key=lambda p: (-weight.get(p["c"], 1), p["n"]))

    # ---- metro (from the public OSM snapshot) ----
    metro_src = os.path.join(ROOT, "tools", "data", "metro_source.json")
    metro = {"lines": [], "stations": []}
    if os.path.exists(metro_src):
        with open(metro_src, encoding="utf-8") as fh:
            raw = json.load(fh)
        order = {}
        for st in raw["stations"]:
            order.setdefault(st["line"], []).append(st)
            metro["stations"].append({
                "n": st["name"], "x": st["coordinates"][0], "y": st["coordinates"][1],
                "l": st["line"].lower(),
            })
        for line, sts in order.items():
            metro["lines"].append({
                "id": line.lower(),
                "name": line.title() + " Line",
                "stops": [s["name"] for s in sts],
            })

    meta = {
        "app": "Chowk",
        "area": "Central Bengaluru",
        "bounds": [round(v, 5) for v in bounds],
        "center": [round((bounds[0] + bounds[2]) / 2, 5), round((bounds[1] + bounds[3]) / 2, 5)],
        "counts": {
            "roads": len(roads), "edges": len(edges), "nodes": len(graph_nodes),
            "places": len(places), "buildings": len(buildings),
            "parks": len(parks), "water": len(water), "metro": len(metro["stations"]),
        },
        "classes": CLASSES,
        "edge_fields": ["a", "b", "metres", "class", "name", "modes", "oneway", "steps", "noise"],
        "mode_bits": {"drive": 1, "bike": 2, "walk": 4},
        "source": "OpenStreetMap contributors, ODbL 1.0",
        "extract": "tools/data/sample_bengaluru.osm",
        "built": "2026-10-20",
    }

    os.makedirs(OUT, exist_ok=True)

    def dump(name, obj, compact=True):
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as fh:
            if compact:
                json.dump(obj, fh, separators=(",", ":"), ensure_ascii=False)
            else:
                json.dump(obj, fh, indent=1, ensure_ascii=False)
        print("%-14s %7.1f KB" % (name, os.path.getsize(path) / 1024))

    dump("meta.json", meta, False)
    dump("roads.json", {"names": names, "roads": roads})
    dump("areas.json", {"parks": parks, "water": water, "pitches": pitches,
                        "buildings": buildings})
    dump("places.json", {"places": places})
    dump("graph.json", {"nodes": graph_nodes, "edges": edges})
    dump("metro.json", metro)

    print("\nroads %d  edges %d  nodes %d  places %d  buildings %d  parks %d  water %d"
          % (len(roads), len(edges), len(graph_nodes), len(places),
             len(buildings), len(parks), len(water)))
    print("bounds", bounds)


if __name__ == "__main__":
    main()
