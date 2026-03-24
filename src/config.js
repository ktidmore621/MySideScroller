// ============================================================
//  Crawler Craft World — Master Config
//  All tuneable constants live here. Tweak freely.
// ============================================================

export const TILE = 16; // px per tile (world unit)

// World dimensions in tiles
export const WORLD_W = 300;  // columns
export const WORLD_H = 600;  // rows  — tall like Terraria

// Layer boundaries (row indices, top = 0)
export const LAYER = {
  SKY_TOP:        0,
  SURFACE_TOP:    60,   // wasteland dirt begins
  UNDERGROUND_TOP:120,  // dense earth begins
  DEEP_TOP:       300,  // hard bedrock / deep rock begins
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
  FLAT_RADIUS:   13,   // half-width of flat spawn zone (26 tiles = 5 beyond each side)
  SHELTER_W:     16,   // total shelter width  (2 wall + 12 interior + 2 wall)
  WALL_THICK:     2,   // wall thickness in tiles
  WALL_H:         6,   // interior height in tiles (colonist=2 + 4 headroom)
  INTERIOR_W:    12,   // interior floor width
  DOORWAY_W:      2,   // doorway opening width (matches wall thickness)
  ROOF_THICK:     2,   // roof thickness in tiles (solid slab)
};

// Physics
export const GRAVITY      = 800;  // px/s²
export const COLONIST_SPD = 80;   // px/s walk speed

// Needs decay rates (units per second, max = 100)
export const HUNGER_DECAY = 1.5;
export const REST_DECAY   = 1.0;

// Camera drag sensitivity (touch)
export const DRAG_FACTOR = 1.0;
