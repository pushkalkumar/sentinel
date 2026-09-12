/// <reference types="vite/client" />

// Minimal ambient GeoJSON namespace so CONTRACT §8.1 types compile without @types/geojson.
declare namespace GeoJSON {
  type Position = number[]
  interface Polygon { type: 'Polygon'; coordinates: Position[][] }
}
