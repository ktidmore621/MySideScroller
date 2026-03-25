// ============================================================
//  Crawler Craft World — Master Config
//  All tuneable constants live here. Tweak freely.
// ============================================================

export const TILE = 48; // px per tile (world unit) — 48 px for comfortable mobile tap targets

// World dimensions in tiles (scaled down to keep ~same pixel dimensions as before)
export const WORLD_W = 100;  // columns  (100 × 48 = 4800 px)
export const WORLD_H = 200;  // rows     (200 × 48 = 9600 px)

// Layer boundaries (row indices, top = 0)
export const LAYER = {
  SKY_TOP:        0,
  SURFACE_TOP:    20,   // wasteland dirt begins
  UNDERGROUND_TOP:40,   // dense earth begins
  DEEP_TOP:       100,  // hard bedrock / deep rock begins
  BOTTOM:         WORLD_H,
};

// Tile type IDs
export const TILE_ID = {
  AIR:         0,
  SURFACE_DIRT:1,  // cracked ash-soil
  SURFACE_ROCK:2,  // rubble chunks on surface
  EARTH:       3,  // packed earth
  CLAY:        4,
  STONE:       5,
  DEEP_ROCK:   6,
  ORE_IRON:    7,
  BEDROCK:     8,  // indestructible bottom row
  RUIN_WALL:   9,  // crumbling concrete — remnants of the old world
};

// Tile visual properties (color, hardness)
export const TILE_DEF = {
  [TILE_ID.AIR]:          { color: null,     hardness: 0 },
  [TILE_ID.SURFACE_DIRT]: { color: 0x5c3d1e, hardness: 1 },
  [TILE_ID.SURFACE_ROCK]: { color: 0x7a6a55, hardness: 2 },
  [TILE_ID.EARTH]:        { color: 0x4a3010, hardness: 2 },
  [TILE_ID.CLAY]:         { color: 0x8b4513, hardness: 2 },
  [TILE_ID.STONE]:        { color: 0x555566, hardness: 3 },
  [TILE_ID.DEEP_ROCK]:    { color: 0x222233, hardness: 4 },
  [TILE_ID.ORE_IRON]:     { color: 0xaa7744, hardness: 3 },
  [TILE_ID.BEDROCK]:      { color: 0x111111, hardness: 999 },
  [TILE_ID.RUIN_WALL]:    { color: 0x3a3a3e, hardness: 5 },  // dark concrete
};

// ── Starting Outpost layout constants ────────────────────────
export const STARTING_OUTPOST = {
  PLATEAU_W:     15,   // total flat plateau width in tiles
  PLATEAU_DEPTH:  3,   // solid fill depth below surface
  HILL_W:         3,   // hill width in tiles
  HILL_H:         2,   // hill height above plateau surface
  SHELTER_W:      6,   // total shelter width  (1 wall + 4 interior + 1 wall)
  WALL_THICK:     1,   // wall thickness in tiles
  WALL_H:         3,   // interior height in tiles
  INTERIOR_W:     4,   // interior floor width
  DOORWAY_W:      1,   // doorway opening width
  ROOF_THICK:     1,   // roof thickness in tiles (solid slab)
  SPAWN_OFFSET:   5,   // spawn column offset from plateau left edge
  BUILDING_GAP:   3,   // tiles from spawn to building left wall
};

// ── Tile source rectangles in dirt-grass.png (1280×698) ─────────────
// Detected from actual pixel boundaries. Used by WorldRenderer via
// canvas drawImage(srcImg, sx, sy, sw, sh, dx, dy, dw, dh).
export const TILE_SRC = {
  // Row 0 — pure dirt underground variants (6)
  dirt: [
    { x: 42,   y: 51, w: 183, h: 179 },
    { x: 244,  y: 51, w: 184, h: 180 },
    { x: 447,  y: 51, w: 183, h: 179 },
    { x: 650,  y: 51, w: 183, h: 179 },
    { x: 852,  y: 51, w: 183, h: 179 },
    { x: 1055, y: 51, w: 183, h: 181 },
  ],
  // Row 1 — grass-top surface tiles (4 variants)
  grassTop: [
    { x: 42,  y: 268, w: 183, h: 196 },
    { x: 244, y: 268, w: 184, h: 196 },
    { x: 447, y: 267, w: 183, h: 197 },
    { x: 650, y: 297, w: 173, h: 167 },
  ],
  // Row 1 — corner tiles (grass on top + side)
  grassCornerTL: { x: 852,  y: 267, w: 179, h: 197 },
  grassCornerTR: { x: 1055, y: 268, w: 183, h: 196 },
  // Row 2 — side edge tiles
  grassLeft:  { x: 42,  y: 488, w: 172, h: 179 },
  grassRight: { x: 244, y: 485, w: 184, h: 182 },
};

// Pinch-to-zoom
export const ZOOM_MIN     = 0.5;
export const ZOOM_MAX     = 2.0;
export const ZOOM_DEFAULT = 1.0;
export const ZOOM_SMOOTH  = 1.0; // instant (no lerp) — temporary for debugging
