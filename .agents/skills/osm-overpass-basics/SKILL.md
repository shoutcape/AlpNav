---
name: osm-overpass-basics
description: Use when querying OpenStreetMap ski piste data with Overpass API for AlpNav, especially when the task needs downhill piste geometry, route relations, and route-number matching against panorama artwork.
---

# OSM Overpass Basics

## Overview

For AlpNav v1, query downhill pistes only. The default goal is not just to fetch geometry - it is to fetch downhill piste geometry plus the identity tags needed to line OSM data up with numbered panorama SVG routes.

Keep the first query simple and repeatable:
- use `bbox` first for viewport-driven work
- query both `way` and `route=piste` `relation`
- collect `piste:ref` / `ref` before trusting names

Out of scope here: lifts, general POIs, non-downhill piste types, normalization, caching, persistence, export tooling, and ingestion pipeline design.

## When to use

Use this skill when an AlpNav task needs a first-pass Overpass query for downhill ski pistes, especially when the result must be compared with numbered panorama artwork.

Do not use this as the final word on:
- lift querying
- POI querying
- full OSM-to-domain mapping
- live status reliability

## Default AlpNav Piste Query Recipe

Use `bbox` as the default spatial filter. AlpNav is viewport-driven, and `bbox` keeps queries easy to reuse.

Query both element types:
- `way` catches simple pistes mapped directly as ways
- `route=piste` `relation` catches grouped or signposted pistes

Do not query only ways or only relations:
- ways-only misses grouped/signposted pistes
- relations-only misses simple pistes mapped only as ways

Treat semicolon-safe matching as the default rule:

```ql
["piste:type"~"(^|;)downhill(;|$)"]
```

Default render-ready query:

```ql
[out:json][timeout:25];
(
  way["piste:type"~"(^|;)downhill(;|$)"]({{bbox}});
  rel["type"="route"]["route"="piste"]["piste:type"~"(^|;)downhill(;|$)"]({{bbox}});
);
out geom({{bbox}}) qt;
```

Use this as the default because it balances coverage and simplicity for AlpNav.

Raw-structure query for downstream processing:

```ql
[out:json][timeout:25];
(
  way["piste:type"~"(^|;)downhill(;|$)"]({{bbox}});
  rel["type"="route"]["route"="piste"]["piste:type"~"(^|;)downhill(;|$)"]({{bbox}});
);
out body qt;
>;
out skel qt;
```

## Tag Checklist for Panorama Matching

Primary match keys for AlpNav:
- `piste:ref`
- `ref`

Secondary fallback identity signals:
- `piste:name`
- `name`

Useful supporting metadata:
- `piste:difficulty`
- `piste:grooming`
- `piste:lit`
- `piste:oneway`
- `piste:status`

For numbered panorama SVG routes, route numbers are the primary join signal. Names are fallback signals, not the first choice.

## Output Mode Quick Reference

- `out geom({{bbox}})` - use when you need render-ready geometry fast
- `out body` + `>` + `out skel` - use when you need raw members and node structure for downstream processing

## Common Mistakes

- Querying only `way` and missing grouped piste relations
- Querying only `relation` and missing simple way-mapped pistes
- Fetching geometry without `piste:ref`, `ref`, `piste:name`, or `name`
- Treating `piste:status` as reliable live data by default
- Defaulting to area queries for v1 basics
- Forgetting that some resorts use `name` while others use `piste:name`
- Forgetting that some resorts use `ref` while others use `piste:ref`

Area-mapped pistes exist, but they are not part of the default v1 query recipe.
