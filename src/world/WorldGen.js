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
  //  STARTING_OUTPOST — flatten terrain & erect a ruined shelter
  //  "Home is wherever the rubble still has a roof." — Colonist proverb
  // ================================================================
  const {
    FLAT_RADIUS, SHELTER_W, WALL_THICK, WALL_H, DOORWAY_W, ROOF_THICK,
  } = STARTING_OUTPOST;

  const outpostCol   = Math.floor(WORLD_W / 2);   // centre of the world
  const flatLeft     = outpostCol - FLAT_RADIUS;
  const flatRight    = outpostCol + FLAT_RADIUS - 1;
  const flatSurface  = surfaceRow[outpostCol];     // canonical ground level

  // ── 1. Flatten landing zone (5 tiles beyond building each side) ──
  for (let x = flatLeft; x <= flatRight; x++) {
    surfaceRow[x] = flatSurface;
    for (let y = 0; y < flatSurface; y++) {
      map[y][x] = TILE_ID.AIR;                    // clear sky above
    }
    map[flatSurface][x] = TILE_ID.SURFACE_DIRT;   // solid ground
  }

  // ── 2. Compute shelter bounds ────────────────────────────────
  const shelterLeft  = outpostCol - Math.floor(SHELTER_W / 2);
  const shelterRight = shelterLeft + SHELTER_W - 1;
  const interiorBot  = flatSurface - 1;            // bottom interior row
  const interiorTop  = flatSurface - WALL_H;       // top interior row
  const roofBot      = interiorTop - 1;            // bottom of roof slab
  const roofTop      = roofBot - ROOF_THICK + 1;   // top of roof slab

  // ── 3. Place roof — solid concrete slab (2 tiles thick) ─────
  for (let y = roofTop; y <= roofBot; y++) {
    for (let x = shelterLeft; x <= shelterRight; x++) {
      map[y][x] = TILE_ID.RUIN_WALL;
    }
  }

  // ── 4. Place left wall (solid, full height from roof to ground) ──
  for (let y = roofTop; y <= interiorBot; y++) {
    for (let x = shelterLeft; x < shelterLeft + WALL_THICK; x++) {
      map[y][x] = TILE_ID.RUIN_WALL;
    }
  }

  // ── 5. Place right wall (doorway carved out, full interior height) ─
  //  Right wall is solid at roof level, open for the full interior
  //  height to create a natural-feeling entrance.
  for (let y = roofTop; y <= interiorBot; y++) {
    for (let x = shelterRight - WALL_THICK + 1; x <= shelterRight; x++) {
      const inDoorway = y >= interiorTop && y <= interiorBot;
      if (!inDoorway) {
        map[y][x] = TILE_ID.RUIN_WALL;
      }
    }
  }

  // ── 6. Clear interior (breathable air inside the ruin) ───────
  for (let y = interiorTop; y <= interiorBot; y++) {
    for (let x = shelterLeft + WALL_THICK; x <= shelterRight - WALL_THICK; x++) {
      map[y][x] = TILE_ID.AIR;
    }
  }
  // Also clear the air above the roof inside the flat zone
  for (let y = 0; y < roofTop; y++) {
    for (let x = shelterLeft; x <= shelterRight; x++) {
      map[y][x] = TILE_ID.AIR;
    }
  }

  // ── 7. Record spawn point for GameScene ──────────────────────
  //  Colonist materialises just outside the doorway, facing the entrance.
  const spawnCol = shelterRight + 1;
  const spawnRow = flatSurface - 2;               // standing on the ground

  return { map, surfaceRow, spawnCol, spawnRow };
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
