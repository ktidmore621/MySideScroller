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
  RUIN_WALL:   9,  // crumbling concrete — remnants of the old world (generic fill)
  // Building-specific tile positions
  BLDG_CORNER_TL:  10, // outer corner top-left
  BLDG_CORNER_TR:  11, // outer corner top-right
  BLDG_CORNER_BR:  12, // outer corner bottom-right
  BLDG_CORNER_BL:  13, // outer corner bottom-left
  BLDG_TOP_CAP:    14, // roof line / top cap
  BLDG_LEFT_CAP:   15, // left outer wall column
  BLDG_RIGHT_CAP:  16, // right outer wall column
  BLDG_INTERIOR:   17, // interior wall fill (plain panel)
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
  // Building tiles — rendered from sprite sheet, color is fallback only
  [TILE_ID.BLDG_CORNER_TL]: { color: 0x3a3a3e, hardness: 5 },
  [TILE_ID.BLDG_CORNER_TR]: { color: 0x3a3a3e, hardness: 5 },
  [TILE_ID.BLDG_CORNER_BR]: { color: 0x3a3a3e, hardness: 5 },
  [TILE_ID.BLDG_CORNER_BL]: { color: 0x3a3a3e, hardness: 5 },
  [TILE_ID.BLDG_TOP_CAP]:   { color: 0x3a3a3e, hardness: 5 },
  [TILE_ID.BLDG_LEFT_CAP]:  { color: 0x3a3a3e, hardness: 5 },
  [TILE_ID.BLDG_RIGHT_CAP]: { color: 0x3a3a3e, hardness: 5 },
  [TILE_ID.BLDG_INTERIOR]:  { color: 0x3a3a3e, hardness: 5 },
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
  // Y pushed down +18 px to crop past label text ("Grass No Edges" etc.)
  grassTop: [
    { x: 42,  y: 286, w: 183, h: 178 },
    { x: 244, y: 286, w: 184, h: 178 },
    { x: 447, y: 285, w: 183, h: 179 },
    { x: 650, y: 315, w: 173, h: 149 },
  ],
  // Row 1 — corner tiles (grass on top + side)
  grassCornerTL: { x: 852,  y: 285, w: 179, h: 179 },
  grassCornerTR: { x: 1055, y: 286, w: 183, h: 178 },
  // Row 2 — side edge tiles
  // Y pushed down +18 px to crop past label text
  grassLeft:  { x: 42,  y: 506, w: 172, h: 161 },
  grassRight: { x: 244, y: 503, w: 184, h: 164 },
};

// ── Building tile source rectangles in building-walls.png (1408×767) ─────
// Image has alpha transparency. Tiles detected from non-transparent regions.
// Row 0 = tiles 1–9 (y ≈ 65–318), Row 1 = tiles 10–20 (y ≈ 428–689).
export const BUILDING_TILE_SRC = {
  // Row 0
  outerWallFull:   { x:  60, y:  65, w: 190, h: 189 }, // T1  patchwork metal
  outerWallStd:    { x: 270, y:  65, w: 157, h: 190 }, // T2  plain concrete panel
  outerWallTopCap: { x: 447, y:  65, w: 190, h: 190 }, // T3  top lip cap
  outerRightCap:   { x: 659, y:  65, w:  38, h: 189 }, // T4  right finished edge
  outerLeftCap:    { x: 847, y:  65, w:  38, h: 190 }, // T5  left finished edge
  cornerTL:        { x: 928, y:  65, w: 122, h: 119 }, // T6  top-left corner
  cornerTR:        { x:1096, y:  65, w: 118, h: 119 }, // T7  top-right corner
  cornerBR:        { x:1095, y: 205, w: 119, h: 114 }, // T8  bottom-right corner
  cornerBL:        { x: 928, y: 205, w: 122, h: 114 }, // T9  bottom-left corner
  // Row 1
  wallVariant:     { x:  61, y: 428, w: 184, h: 203 }, // T10 corrugated panels
  wallInsetPanel:  { x: 265, y: 429, w: 165, h: 202 }, // T11 inset panel detail
  wallMeshGrate:   { x: 458, y: 428, w: 169, h: 203 }, // T12 mesh/grate upper
  rightCapVar:     { x: 680, y: 429, w:  22, h: 201 }, // T13 right cap variant
  leftCapVar:      { x: 853, y: 430, w:  22, h: 197 }, // T14 left cap variant
  insetCornerTop:  { x: 953, y: 430, w:  97, h: 108 }, // T15 inset corner mesh (top)
  insetCornerBot:  { x: 953, y: 563, w:  97, h: 127 }, // T15 inset corner mesh (bot)
  woodPlankTop:    { x:1107, y: 430, w: 107, h: 108 }, // T16 wooden plank (top)
  woodPlankBot:    { x:1106, y: 563, w: 107, h: 126 }, // T16 wooden plank (bot)
  meshPanelTop:    { x:1257, y: 429, w: 108, h: 109 }, // T17 mesh panel (top)
  meshPanelBot:    { x:1257, y: 563, w: 119, h: 127 }, // T17 mesh panel (bot)
};

// Map building TILE_IDs → source rect keys
export const BLDG_TILE_TO_SRC = {
  [TILE_ID.BLDG_CORNER_TL]: 'cornerTR',     // T7 — finished top + left edges
  [TILE_ID.BLDG_CORNER_TR]: 'cornerTL',     // T6 — finished top + right edges
  [TILE_ID.BLDG_CORNER_BR]: 'cornerBL',     // T9 — finished bottom + right edges
  [TILE_ID.BLDG_CORNER_BL]: 'cornerBR',     // T8 — finished bottom + left edges
  [TILE_ID.BLDG_TOP_CAP]:   'outerWallTopCap',
  [TILE_ID.BLDG_LEFT_CAP]:  'outerLeftCap',    // T5 — left finished edge
  [TILE_ID.BLDG_RIGHT_CAP]: 'outerRightCap',   // T4 — right finished edge
  [TILE_ID.BLDG_INTERIOR]:  'outerWallStd',
  [TILE_ID.RUIN_WALL]:      'outerWallStd',  // fallback for any remaining generic wall
};

// Pinch-to-zoom
export const ZOOM_MIN     = 0.5;
export const ZOOM_MAX     = 2.0;
export const ZOOM_DEFAULT = 1.0;
export const ZOOM_SMOOTH  = 1.0; // instant (no lerp) — temporary for debugging
