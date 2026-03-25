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
  WALL_H:         3,   // interior height in tiles (colonist=2 + 1 headroom)
  INTERIOR_W:     4,   // interior floor width
  DOORWAY_W:      1,   // doorway opening width
  ROOF_THICK:     1,   // roof thickness in tiles (solid slab)
  SPAWN_OFFSET:   5,   // colonist spawn column offset from plateau left edge
  BUILDING_GAP:   3,   // tiles from colonist spawn to building left wall
};

// Physics
export const GRAVITY      = 2400; // px/s² (scaled with tile size for consistent feel)
export const COLONIST_SPD = 240;  // px/s walk speed (scaled with tile size)

// Needs decay rates (units per second, max = 100)
export const HUNGER_DECAY = 1.5;
export const REST_DECAY   = 1.0;

// Camera drag sensitivity (touch)
export const DRAG_FACTOR = 1.0;
