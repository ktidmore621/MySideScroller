// ============================================================
//  WorldGen — Procedural Tile Map Generator
//  Produces a flat 2-D array [row][col] of TILE_IDs.
//
//  Layer layout (top → bottom):
//    0  – SKY_TOP        : open sky / vacuum
//    20 – SURFACE_TOP    : wasteland surface (ash-soil, rubble)
//    40 – UNDERGROUND_TOP: packed earth, clay veins
//   100 – DEEP_TOP       : hard stone, iron ore pockets
//   199 – BOTTOM row     : indestructible bedrock
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
    const n  = noise(x, 13) * 0.5
             + noise(x, 5)  * 0.3
             + noise(x, 2)  * 0.2;
    surfaceRow[x] = Math.floor(LAYER.SURFACE_TOP + (n - 0.5) * 13);
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
        if (y > LAYER.DEEP_TOP + 27 && rand() < 0.6) {
          map[y][x] = TILE_ID.DEEP_ROCK;
        }
      }
    }
  }

  // ── Carve small surface caves / craters ───────────────────
  //  Compute plateau bounds early so caves never carve into spawn zone.
  const _plateauLeft  = Math.floor(WORLD_W / 2) - Math.floor(STARTING_OUTPOST.PLATEAU_W / 2);
  const _plateauRight = _plateauLeft + STARTING_OUTPOST.PLATEAU_W - 1;

  for (let i = 0; i < 14; i++) {
    const cx = Math.floor(rand() * WORLD_W);
    // Skip caves that would overlap the spawn plateau
    if (cx >= _plateauLeft - 2 && cx <= _plateauRight + 2) continue;
    const cy = surfaceRow[cx] + Math.floor(rand() * 4) + 1;
    const r  = Math.floor(rand() * 3) + 1;
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
  //  STARTING_OUTPOST — guaranteed flat plateau with hill + shelter
  //
  //  Layout (left → right):
  //    ▲▲▲ HILL ▲▲▲   [COLONIST]   ████ BUILDING ████
  //    ███████████████████████████████████████████████  ← solid plateau
  //    ███████████████████████████████████████████████  ← solid below
  // ================================================================
  const {
    PLATEAU_W, PLATEAU_DEPTH, HILL_W, HILL_H,
    SHELTER_W, WALL_THICK, WALL_H, ROOF_THICK,
    SPAWN_OFFSET, BUILDING_GAP,
  } = STARTING_OUTPOST;

  const outpostCol   = Math.floor(WORLD_W / 2);
  const flatSurface  = surfaceRow[outpostCol];     // canonical ground level

  // Plateau spans centred on the world midpoint
  const plateauLeft  = outpostCol - Math.floor(PLATEAU_W / 2);
  const plateauRight = plateauLeft + PLATEAU_W - 1;

  // ── 1. Create solid flat plateau ──────────────────────────────
  //  Clear sky above, solid surface + PLATEAU_DEPTH rows below.
  for (let x = plateauLeft; x <= plateauRight; x++) {
    surfaceRow[x] = flatSurface;
    // Clear everything above the surface
    for (let y = 0; y < flatSurface; y++) {
      map[y][x] = TILE_ID.AIR;
    }
    // Solid surface row
    map[flatSurface][x] = TILE_ID.SURFACE_DIRT;
    // Fill solid below the surface (no caves, no gaps)
    for (let y = flatSurface + 1; y <= flatSurface + PLATEAU_DEPTH && y < WORLD_H - 1; y++) {
      if (map[y][x] === TILE_ID.AIR) {
        map[y][x] = TILE_ID.SURFACE_DIRT;
      }
    }
  }

  // ── 2. Natural hill on the left ───────────────────────────────
  //  Solid terrain hill, 8 tiles wide, rising 6 above the plateau.
  const hillLeft  = plateauLeft;
  const hillRight = hillLeft + HILL_W - 1;

  for (let x = hillLeft; x <= hillRight; x++) {
    // Triangular/trapezoidal shape: taller in the middle
    const distFromCentre = Math.abs(x - (hillLeft + hillRight) / 2);
    const maxDist = HILL_W / 2;
    // Rounded hill profile: full height in the middle, tapers at edges
    const h = Math.round(HILL_H * Math.cos((distFromCentre / maxDist) * Math.PI * 0.4));
    for (let dy = 1; dy <= h; dy++) {
      const y = flatSurface - dy;
      if (y >= 0) {
        map[y][x] = TILE_ID.SURFACE_DIRT;
      }
    }
    // Fill solid below hill tiles too
    for (let y = flatSurface + 1; y <= flatSurface + PLATEAU_DEPTH && y < WORLD_H - 1; y++) {
      if (map[y][x] === TILE_ID.AIR) {
        map[y][x] = TILE_ID.SURFACE_DIRT;
      }
    }
  }

  // ── 3. Colonist spawn point ───────────────────────────────────
  //  Between the hill and the building, on flat ground.
  const spawnCol = plateauLeft + SPAWN_OFFSET;
  const spawnRow = flatSurface - 2;               // standing on the ground

  // ── 4. Building to the right of the colonist ──────────────────
  //  Left exterior wall sits BUILDING_GAP tiles to the right of spawn.
  //  Bottom wall tiles sit directly ON the plateau surface (flatSurface row).
  const shelterLeft  = spawnCol + BUILDING_GAP;
  const shelterRight = shelterLeft + SHELTER_W - 1;

  // Building sits ON the surface: walls go from flatSurface upward
  const wallBot      = flatSurface;                // bottom wall row = surface
  const interiorBot  = wallBot - 1;                // bottom interior row
  const interiorTop  = wallBot - WALL_H;           // top interior row
  const roofBot      = interiorTop - 1;            // bottom of roof slab
  const roofTop      = roofBot - ROOF_THICK + 1;   // top of roof slab

  // Clear sky above the building
  for (let y = 0; y < roofTop; y++) {
    for (let x = shelterLeft; x <= shelterRight; x++) {
      map[y][x] = TILE_ID.AIR;
    }
  }

  // 4a. Place roof — solid concrete slab
  for (let y = roofTop; y <= roofBot; y++) {
    for (let x = shelterLeft; x <= shelterRight; x++) {
      map[y][x] = TILE_ID.RUIN_WALL;
    }
  }

  // 4b. Place LEFT wall (doorway facing colonist — open interior height)
  for (let y = roofTop; y <= wallBot; y++) {
    for (let x = shelterLeft; x < shelterLeft + WALL_THICK; x++) {
      const inDoorway = y >= interiorTop && y <= interiorBot;
      if (!inDoorway) {
        map[y][x] = TILE_ID.RUIN_WALL;
      } else {
        map[y][x] = TILE_ID.AIR;
      }
    }
  }

  // 4c. Place RIGHT wall (solid, no doorway)
  for (let y = roofTop; y <= wallBot; y++) {
    for (let x = shelterRight - WALL_THICK + 1; x <= shelterRight; x++) {
      map[y][x] = TILE_ID.RUIN_WALL;
    }
  }

  // 4d. Clear interior
  for (let y = interiorTop; y <= interiorBot; y++) {
    for (let x = shelterLeft + WALL_THICK; x <= shelterRight - WALL_THICK; x++) {
      map[y][x] = TILE_ID.AIR;
    }
  }

  // 4e. Bottom wall row (floor of building) sits on the surface
  for (let x = shelterLeft; x <= shelterRight; x++) {
    map[wallBot][x] = TILE_ID.RUIN_WALL;
  }

  // ── 5. Record safe wander bounds for the colonist ─────────────
  const wanderLeftCol  = hillRight + 1;   // just past the hill
  const wanderRightCol = shelterLeft - 1; // just before building wall

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
