# Map data

- Country polygons: [world-atlas 2 / Natural Earth 4.1.0](https://github.com/topojson/world-atlas), `countries-50m.json`. Natural Earth data is public domain; world-atlas code is ISC licensed.
- Country identifiers, flags and coordinates: [world-countries](https://github.com/mledoze/countries), ODbL 1.0. `countries.json` is a compact subset with Ukrainian names from `Intl.DisplayNames`.
- Locally bundled SVG flag images: [flag-icons](https://github.com/lipis/flag-icons), MIT license. Flags load with the application and do not require a third-party image service.
- Ukraine boundary: [geoBoundaries gbOpen UKR ADM0](https://www.geoboundaries.org/api/current/gbOpen/UKR/ADM0/), boundary `UKR-ADM0-60985579`, represented year 2017, source OpenStreetMap / Wambacher, ODbL 1.0. Geometry is the simplified GeoJSON from commit `9469f09` of [wmgeolab/geoBoundaries](https://github.com/wmgeolab/geoBoundaries). Attribution: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright.

The Ukraine geometry overrides the corresponding Natural Earth outline and masks overlapping geometry. Source geometries remain unmodified in their stored files. The interactive display adapts winding to D3's spherical projection.

Country associations for ingredients describe culinary usage, not agricultural origin, production location, or exclusive ownership by a country. See `scripts/nutrition/country-associations.json` for the curated association data and references. A zero count means no matching annotations in this catalog under the active filters.
