# Real campus map data

`shared/campus.geojson` is Roosevelt High School (1410 NE 66th St, Seattle) and its 400 m surroundings, exported once from OpenStreetMap (Overpass, 2026-09-12) and bundled. No runtime map API. Attribution line required wherever it renders: "Map data © OpenStreetMap contributors".

## Coordinates

- Local metres. `x` east, `y` south (SVG-style, y grows downward). Origin = centroid of the school parcel (lat 47.677008, lon -122.314226).
- Features: `kind` ∈ building | pitch | track | park | playground | parking | road | campus. `on_campus` true for the 6 features inside the school parcel. `levels` = OSM `building:levels` when present (main building: 3). Roads carry `highway` class.
- SVG mapping used by `CampusMap` (viewBox 0 0 1000 700): `sx = 500 + x * 2.5`, `sy = 350 + y * 2.5` (400 m wide). World mapping for R3F: `wx = x / 10`, `wz = y / 10` (1 unit = 10 m), building height = `levels * 0.35` (default 1 level), portables 0.3.

## Campus features (metres)

| Feature | Centre (x, y) | Notes |
|---|---|---|
| Main building (3 levels) | 66, -71 | L-shaped, bbox x −15..147, y −102..20. Long wing runs north (top) at y≈−60..−100; east wing runs south along x≈78..146 down to y≈20. |
| Football field (pitch) | −27, −9 | west of the building |
| Parking | −60, −78 | north-west |
| Portable 1/2 | −40, −68 | |
| Portable 3/4 | −41, −58 | |
| Parcel | 0, 0 | outline |

## Node placement (real positions, replaces the old 0–1000 grid guesses)

| id | label | x, y (m) | map_x, map_y (SVG) | why |
|---|---|---|---|---|
| hub | Main Hall (office gateway) | 100, −78 | 750, 155 | office wing, north side, has mains + ethernet |
| library | Library | 20, −80 | 550, 150 | west end of north wing |
| science | Science Wing | 130, −20 | 825, 300 | east wing, mid |
| cafeteria | Cafeteria | 60, −60 | 650, 200 | inner corner of the L |
| arts | Arts Building | 115, 5 | 787, 362 | south end of east wing |
| gym | Gymnasium | 138, −85 | 845, 137 | north-east block (big roof span) |
| field | Athletic Field | −27, −9 | 432, 327 | pitch centre, outdoor, solar |
| parking | South Lot | −60, −78 | 350, 155 | parking lot, outdoor |

Links stay as in topology.json (adjacency does not change). Keep lat/lng in topology.json consistent: `lat = 47.677008 − y/110540`, `lng = −122.314226 + x/(111320·cos 47.677°)`.

## Rendering intent

Dark, lit, real. Extruded footprints with soft top light and a faint ambient occlusion at the base; neighbourhood houses low, dim, desaturated; campus buildings slightly lighter; field a muted green-grey with the yard lines from the pitch outline; roads as faint solid ribbons; no dotted or dashed strokes anywhere; node discs sit on rooftops (building top height) or on the ground for field/parking; links are solid, thin, low-alpha, and hop pulses travel along them. The SVG `CampusMap` keeps the same props and draws the same footprints flat for the phone and for reduced-motion.
