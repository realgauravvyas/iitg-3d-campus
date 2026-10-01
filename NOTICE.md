# Notices: data, assets and licences

IITG 3D is an unofficial fan project and is not affiliated with IIT Guwahati.
The game's own code is under the [MIT licence](LICENSE). Everything below keeps its own licence.

## Map data (in `data/`, and embedded in `dist/IITG_Campus_3D.html`)

| What | Source | Licence |
|---|---|---|
| Boundary, roads, footpaths, lakes, sports grounds, names | © OpenStreetMap contributors | ODbL 1.0 (https://www.openstreetmap.org/copyright) |
| Building footprints and places | Overture Maps Foundation, including Google Open Buildings and Microsoft Building Footprints | ODbL / CDLA-Permissive-2.0 |
| Tree cover | © ESA WorldCover project 2021, contains modified Copernicus Sentinel data (2021) processed by the ESA WorldCover consortium | CC BY 4.0 |
| Ground picture (`data/ground.jpg`, `data/raw/s2cloudless.jpg`) | Sentinel-2 cloudless, https://s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024) | **CC BY-NC-SA 4.0: non-commercial, share-alike** |
| Terrain | AWS Terrain Tiles (Mapzen; SRTM, NASADEM) | see https://registry.opendata.aws/terrain-tiles/ |

Because the ground picture is non-commercial and share-alike, the built game (`dist/`) that contains it is for non-commercial use.
If you want a commercial version, replace the ground picture and rebuild.

## Software and fonts

- [three.js](https://threejs.org): © three.js authors, MIT licence (its notice is kept at the end of the built file).
- Fonts Hind and Teko: SIL Open Font License 1.1, loaded from Google Fonts.
- Build and test tools (esbuild, puppeteer-core): MIT and Apache-2.0, used only in development.

## Made for the game

The models, murals, signs, the campus crest, the music and all the sound effects were made for this game
(the sound is generated in the browser; there are no audio files). The crest is an original design,
not the institute's emblem, and no company logos are used. Three outlet names, Cafe Coffee Day, Domino's Pizza and KFC, appear as plain-text signs where those
outlets stand in real life, as asked for by the author. They are trademarks of their owners, are used only to say what the place is, and are not
endorsed by or connected with those companies. Remove them from `src/scene/stalls.js` and `tools/landmarks.json` for a version without them.

## Films

The films on the auditorium and Conference Centre screens are IIT Guwahati's own videos, played through
YouTube's embedded player. They are not copied into this repository.

## The institute's documents

The 2011 master plan and the printed campus map were used only to check positions of a few roundabouts,
bus stands and buildings. They are not included in this repository (`*.pdf` is ignored).
