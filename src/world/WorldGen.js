// ============================================================
//  WorldGen — Procedural Tile Map Generator
//  Produces a flat 2-D array [row][col] of TILE_IDs.
//
//  Layer layout (top → bottom):
//    0  – SKY_TOP        : open sky / vacuum
//    60 – SURFACE_TOP    : wasteland surface (ash-soil, rubble)
//   120 – UNDERGROUND_TOP: packed earth, clay veins
//   300 – DEEP_TOP       : hard stone, iron ore pockets
//   599 – BOTTOM row     : indestructible bedrock
// ============================================================

import {
  WORLD_W, WORLD_H, TILE_ID, LAYER, TILE, STARTING_OUTPOST,
} from '../config.js';

// ── Tiny deterministic pseudo-random (mulberry32) ───────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Simple 1-D value noise (octave sum)
function makeNoise1D(rand, width) {
  const pts = new Float32Array(width + 1);
  for (let i = 0; i <= width; i++) pts[i] = rand();
  return (x, scale) => {
    const xi = Math.floor(x / scale) % (width + 1);
    const xf = (x / scale) - Math.floor(x / scale);
    const a  = pts[xi];
    const b  = pts[(xi + 1) % (width + 1)];
    return a + (b - a) * (xf * xf * (3 - 2 * xf)); // smoothstep
  };
}

// ── Main export ─────────────────────────────────────────────
export function generateWorld(seed = 42) {
  const rand  = mulberry32(seed);
  const noise = makeNoise1D(rand, WORLD_W);

  // Allocate flat world — default AIR everywhere
  const map = Array.from({ length: WORLD_H }, () =>
    new Uint8Array(WORLD_W).fill(TILE_ID.AIR)
  );

  // ── Surface height map ────────────────────────────────────
  // Base height sits at SURFACE_TOP; noise adds ±20 tiles
  const surfaceRow = new Int16Array(WORLD_W);
  for (let x = 0; x < WORLD_W; x++) {
    const n  = noise(x, 40) * 0.5
             + noise(x, 15) * 0.3
             + noise(x, 6)  * 0.2;
    surfaceRow[x] = Math.floor(LAYER.SURFACE_TOP + (n - 0.5) * 40);
  }

  // ── Fill tiles row by row ─────────────────────────────────
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {

      // Indestructible bedrock at very bottom
      if (y >= WORLD_H - 1) {
        map[y][x] = TILE_ID.BEDROCK;
        continue;
      }

      const surface = surfaceRow[x];

      // Above ground → AIR
      if (y < surface) continue;

      // ── Surface layer ────────────────────────────────────
      if (y < LAYER.UNDERGROUND_TOP) {
        // Sparse rubble rocks on the surface cap row
        if (y === surface) {
          map[y][x] = rand() < 0.15 ? TILE_ID.SURFACE_ROCK : TILE_ID.SURFACE_DIRT;
        } else {
          map[y][x] = TILE_ID.SURFACE_DIRT;
        }
        continue;
      }

      // ── Underground layer ────────────────────────────────
      if (y < LAYER.DEEP_TOP) {
        // Clay veins: vertical streaks using noise
        const clayChance = noise(x, 8) * noise(y / 10, 6);
        if (clayChance > 0.72) {
          map[y][x] = TILE_ID.CLAY;
        } else {
          map[y][x] = TILE_ID.EARTH;
        }
        continue;
      }

      // ── Deep rock layer ──────────────────────────────────
      {
        // Ore pockets
        const oreNoise = noise(x, 5) * noise(y / 8, 4);
        if (oreNoise > 0.78 && rand() < 0.4) {
          map[y][x] = TILE_ID.ORE_IRON;
        } else {
          map[y][x] = TILE_ID.STONE;
        }

        // Occasional deep-rock bands
        if (y > LAYER.DEEP_TOP + 80 && rand() < 0.6) {
          map[y][x] = TILE_ID.DEEP_ROCK;
        }
      }
    }
  }

  // ── Carve small surface caves / craters ───────────────────
  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(rand() * WORLD_W);
    const cy = surfaceRow[cx] + Math.floor(rand() * 12) + 2;
    const r  = Math.floor(rand() * 5) + 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const tx = cx + dx, ty = cy + dy;
          if (tx >= 0 && tx < WORLD_W && ty >= 0 && ty < WORLD_H - 1) {
            map[ty][tx] = TILE_ID.AIR;
          }
        }
      }
    }
  }

  // ================================================================
  //  STARTING OUTPOST — guaranteed safe spawn zone
  //
  //  Layout (left → right):
  //     ▲▲▲                    ████████████████
  //    ▲▲▲▲▲                   █              █
  //   ▲▲▲▲▲▲▲    [COLONIST]    █              █
  //  █████████████████████████████████████████████  ← solid plateau
  //  █████████████████████████████████████████████  ← solid below (10 deep)
  //
  //  1) Flat solid plateau ≥ 40 tiles wide, 10 tiles deep
  //  2) Natural hill on left acts as wall
  //  3) Building sits ON ground to the right (not floating)
  //  4) Colonist spawns between hill and building
  // ================================================================
  const {
    PLATEAU_W, PLATEAU_DEPTH, HILL_W, HILL_H,
    SHELTER_W, WALL_THICK, WALL_H, ROOF_THICK,
    HILL_GAP, BUILDING_GAP,
  } = STARTING_OUTPOST;

  // ── Compute key column positions ───────────────────────────
  const outpostCol   = Math.floor(WORLD_W / 2);      // world centre
  const flatSurface  = surfaceRow[outpostCol];        // canonical ground row

  // Colonist placed near the middle of the plateau
  const spawnCol     = outpostCol;

  // Hill on the left edge of the plateau
  const hillRight    = spawnCol - HILL_GAP;           // 3 tiles left of colonist
  const hillLeft     = hillRight - HILL_W + 1;        // 8 tiles wide

  // Building to the right
  const buildingLeft = spawnCol + BUILDING_GAP;       // 10 tiles right of colonist
  const buildingRight= buildingLeft + SHELTER_W - 1;  // 16 tiles total

  // Plateau spans from hill left edge to past building, with buffer
  const plateauLeft  = hillLeft - 2;                  // 2-tile buffer left
  const plateauRight = Math.max(buildingRight + 4, plateauLeft + PLATEAU_W - 1);

  // ── 1. Flatten & fill solid plateau ────────────────────────
  //  Clear everything above, make surface solid, fill PLATEAU_DEPTH below
  for (let x = plateauLeft; x <= plateauRight; x++) {
    if (x < 0 || x >= WORLD_W) continue;
    surfaceRow[x] = flatSurface;

    // Clear sky above the surface
    for (let y = 0; y < flatSurface; y++) {
      map[y][x] = TILE_ID.AIR;
    }

    // Solid surface row
    map[flatSurface][x] = TILE_ID.SURFACE_DIRT;

    // Fill solid ground beneath the plateau (no caves, no gaps)
    for (let y = flatSurface + 1; y < flatSurface + PLATEAU_DEPTH && y < WORLD_H; y++) {
      map[y][x] = TILE_ID.SURFACE_DIRT;
    }
  }

  // ── 2. Build the natural hill on the left ──────────────────
  //  Triangular / stepped hill rising HILL_H tiles above surface.
  //  Fully solid underneath — no caves or hollows.
  const hillCentre = (hillLeft + hillRight) / 2;
  const hillHalfW  = HILL_W / 2;

  for (let dy = 0; dy < HILL_H; dy++) {
    // Each row narrows as we go up (pyramidal shape)
    const rowY      = flatSurface - 1 - dy;          // from just above surface upward
    const fraction  = 1 - dy / HILL_H;               // 1 at base, 0 at peak
    const halfSpan  = Math.ceil(hillHalfW * fraction);
    const rowLeft   = Math.floor(hillCentre - halfSpan + 0.5);
    const rowRight  = Math.floor(hillCentre + halfSpan - 0.5);

    for (let x = rowLeft; x <= rowRight; x++) {
      if (x >= 0 && x < WORLD_W && rowY >= 0) {
        map[rowY][x] = TILE_ID.SURFACE_ROCK;         // rocky hill material
      }
    }
  }

  // Fill hill columns solid all the way down through the plateau depth
  for (let x = hillLeft; x <= hillRight; x++) {
    if (x < 0 || x >= WORLD_W) continue;
    for (let y = flatSurface - 1; y >= flatSurface - HILL_H && y >= 0; y--) {
      // Fill under each hill row solidly (no internal gaps)
      if (map[y][x] === TILE_ID.AIR) {
        map[y][x] = TILE_ID.SURFACE_ROCK;
      }
    }
  }

  // ── 3. Place building ON the plateau surface (to the right) ─
  //  Bottom wall tiles sit directly ON flatSurface row.
  //  Left wall has open doorway facing colonist.
  //  Right wall is solid.
  const interiorBot  = flatSurface - 1;               // bottom interior row
  const interiorTop  = flatSurface - WALL_H;          // top interior row
  const roofBot      = interiorTop - 1;               // bottom of roof slab
  const roofTop      = roofBot - ROOF_THICK + 1;      // top of roof slab

  // 3a. Roof — solid concrete slab
  for (let y = roofTop; y <= roofBot; y++) {
    for (let x = buildingLeft; x <= buildingRight; x++) {
      if (x >= 0 && x < WORLD_W) map[y][x] = TILE_ID.RUIN_WALL;
    }
  }

  // 3b. Left wall (doorway facing colonist — open for full interior height)
  for (let y = roofTop; y <= interiorBot; y++) {
    for (let x = buildingLeft; x < buildingLeft + WALL_THICK; x++) {
      const inDoorway = y >= interiorTop && y <= interiorBot;
      if (!inDoorway) {
        if (x >= 0 && x < WORLD_W) map[y][x] = TILE_ID.RUIN_WALL;
      }
    }
  }

  // 3c. Right wall (solid, full height from roof to ground)
  for (let y = roofTop; y <= interiorBot; y++) {
    for (let x = buildingRight - WALL_THICK + 1; x <= buildingRight; x++) {
      if (x >= 0 && x < WORLD_W) map[y][x] = TILE_ID.RUIN_WALL;
    }
  }

  // 3d. Back wall (bottom row — sits ON the surface, connecting left & right walls)
  for (let x = buildingLeft; x <= buildingRight; x++) {
    if (x >= 0 && x < WORLD_W) map[flatSurface][x] = TILE_ID.RUIN_WALL;
  }

  // 3e. Clear interior air space
  for (let y = interiorTop; y <= interiorBot; y++) {
    for (let x = buildingLeft + WALL_THICK; x <= buildingRight - WALL_THICK; x++) {
      if (x >= 0 && x < WORLD_W) map[y][x] = TILE_ID.AIR;
    }
  }

  // 3f. Clear sky above the building
  for (let y = 0; y < roofTop; y++) {
    for (let x = buildingLeft; x <= buildingRight; x++) {
      if (x >= 0 && x < WORLD_W) map[y][x] = TILE_ID.AIR;
    }
  }

  // ── 4. Ensure NO caves/craters exist within the plateau zone ─
  //  Re-fill any holes that the earlier cave carving may have punched
  //  into the plateau depth zone.
  for (let x = plateauLeft; x <= plateauRight; x++) {
    if (x < 0 || x >= WORLD_W) continue;
    for (let y = flatSurface + 1; y < flatSurface + PLATEAU_DEPTH && y < WORLD_H; y++) {
      if (map[y][x] === TILE_ID.AIR) {
        map[y][x] = TILE_ID.SURFACE_DIRT;
      }
    }
  }

  // ── 5. Record spawn point ──────────────────────────────────
  const spawnRow = flatSurface - 2;                   // standing on ground

  // Export wander bounds so colonist stays in the safe zone
  const wanderLeftCol  = hillRight + 1;               // just right of the hill
  const wanderRightCol = buildingLeft - 1;            // just left of the building

  return { map, surfaceRow, spawnCol, spawnRow, wanderLeftCol, wanderRightCol };
}

// ── Utility: pixel coords for tile ──────────────────────────
export function tileToWorld(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

export function worldToTile(px, py) {
  return { col: Math.floor(px / TILE), row: Math.floor(py / TILE) };
}

// Find the surface row at a given column (first non-air from top)
export function surfaceAt(map, col) {
  for (let row = 0; row < WORLD_H; row++) {
    if (map[row][col] !== TILE_ID.AIR) return row;
  }
  return WORLD_H - 1;
}
