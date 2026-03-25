// ============================================================
//  WorldRenderer — Chunked tile renderer
//
//  The world is 100×200 = 20,000 tiles.  Drawing every tile
//  every frame as individual Graphics calls would be too slow.
//  Strategy: divide the world into CHUNK_W×CHUNK_H sections.
//  Each chunk is pre-rendered to a RenderTexture once, then
//  just blitted.  Only dirty chunks are redrawn (e.g. after
//  mining a tile).
//
//  Dirt / grass tiles are drawn from the tiles-dirt-grass
//  spritesheet.  Other tile types (rock, bedrock, ruin wall)
//  remain coloured rectangles for now.
// ============================================================

import { TILE, WORLD_W, WORLD_H, TILE_ID, TILE_DEF } from '../config.js';

const CHUNK_W = 10; // tiles wide
const CHUNK_H = 10; // tiles tall

const COLS = Math.ceil(WORLD_W / CHUNK_W);
const ROWS = Math.ceil(WORLD_H / CHUNK_H);

// Tile IDs that should be rendered with the dirt/grass spritesheet
const DIRT_TILE_IDS = new Set([
  TILE_ID.SURFACE_DIRT,
  TILE_ID.EARTH,
  TILE_ID.CLAY,
]);

// Simple deterministic hash for consistent random tile variant selection
function tileHash(col, row) {
  let h = col * 374761393 + row * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

export default class WorldRenderer {
  /**
   * @param {Phaser.Scene} scene
   * @param {Uint8Array[]} map
   */
  constructor(scene, map) {
    this.scene   = scene;
    this.map     = map;

    // One RenderTexture per chunk
    this.chunks  = []; // [chunkRow][chunkCol] = { rt, dirty }

    // Temp graphics used to paint non-dirt tiles into RenderTextures
    this._brush  = scene.add.graphics();
    this._brush.setVisible(false);

    // Temp image used to stamp tile sprites into RenderTextures
    this._tileImg = scene.make.image({
      key: 'tiles-dirt-grass',
      frame: 'dirt_0',
      add: false,
    });
    this._tileImg.setOrigin(0, 0);
    this._tileImg.setDisplaySize(TILE, TILE);

    this._buildAllChunks();
  }

  // ── Determine which sprite frame to use for a dirt/grass tile ──
  _pickTileFrame(col, row) {
    const above = row > 0 ? this.map[row - 1][col] : TILE_ID.AIR;
    const left  = col > 0 ? this.map[row][col - 1] : TILE_ID.AIR;
    const right = col < WORLD_W - 1 ? this.map[row][col + 1] : TILE_ID.AIR;

    const airAbove = above === TILE_ID.AIR;
    const airLeft  = left  === TILE_ID.AIR;
    const airRight = right === TILE_ID.AIR;

    if (airAbove && airLeft) return 'grass_corner_tl';
    if (airAbove && airRight) return 'grass_corner_tr';
    if (airAbove) {
      const idx = tileHash(col, row) % 4;
      return `grass_top_${idx}`;
    }
    if (airLeft) return 'grass_left';
    if (airRight) return 'grass_right';

    // Underground — pick a random dirt variant
    const idx = tileHash(col, row) % 6;
    return `dirt_${idx}`;
  }

  _buildAllChunks() {
    for (let cr = 0; cr < ROWS; cr++) {
      this.chunks[cr] = [];
      for (let cc = 0; cc < COLS; cc++) {
        const px = cc * CHUNK_W * TILE;
        const py = cr * CHUNK_H * TILE;

        const rt = this.scene.add.renderTexture(
          px, py,
          CHUNK_W * TILE,
          CHUNK_H * TILE,
        );
        rt.setOrigin(0, 0);
        rt.setDepth(0);

        this.chunks[cr][cc] = { rt, dirty: true };
      }
    }
    this._renderDirtyChunks();
  }

  _renderChunk(cr, cc) {
    const { rt } = this.chunks[cr][cc];
    const startCol = cc * CHUNK_W;
    const startRow = cr * CHUNK_H;

    this._brush.clear();

    // Collect dirt/grass tile draws to batch after the brush
    const tileToDraw = [];

    for (let row = startRow; row < startRow + CHUNK_H && row < WORLD_H; row++) {
      for (let col = startCol; col < startCol + CHUNK_W && col < WORLD_W; col++) {
        const id   = this.map[row][col];
        const def  = TILE_DEF[id];
        if (!def || def.color === null) continue; // AIR

        const lx = (col - startCol) * TILE;
        const ly = (row - startRow) * TILE;

        if (DIRT_TILE_IDS.has(id)) {
          // Queue for sprite rendering
          tileToDraw.push({ frame: this._pickTileFrame(col, row), lx, ly });
        } else {
          // Coloured rectangle (rock, bedrock, ruin wall, etc.)
          this._brush.fillStyle(def.color, 1);
          this._brush.fillRect(lx, ly, TILE - 1, TILE - 1);

          // Subtle top-edge highlight (fake lighting)
          this._brush.fillStyle(0xffffff, 0.07);
          this._brush.fillRect(lx, ly, TILE - 1, Math.max(2, Math.round(TILE * 0.08)));
        }
      }
    }

    rt.clear();

    // Draw coloured-rectangle tiles first
    rt.draw(this._brush, 0, 0);

    // Draw dirt/grass sprite tiles
    for (const { frame, lx, ly } of tileToDraw) {
      this._tileImg.setFrame(frame);
      rt.draw(this._tileImg, lx, ly);
    }

    this.chunks[cr][cc].dirty = false;
  }

  _renderDirtyChunks() {
    for (let cr = 0; cr < ROWS; cr++) {
      for (let cc = 0; cc < COLS; cc++) {
        if (this.chunks[cr][cc].dirty) {
          this._renderChunk(cr, cc);
        }
      }
    }
  }

  // ── Mark a tile dirty (e.g. after mining) ────────────────
  dirtyTile(col, row) {
    const cc = Math.floor(col / CHUNK_W);
    const cr = Math.floor(row / CHUNK_H);
    if (this.chunks[cr] && this.chunks[cr][cc]) {
      this.chunks[cr][cc].dirty = true;
    }
  }

  // ── Call once per frame (only redraws dirty chunks) ───────
  update() {
    this._renderDirtyChunks();
  }

  destroy() {
    for (const row of this.chunks) {
      for (const chunk of row) {
        chunk.rt.destroy();
      }
    }
    this._brush.destroy();
    this._tileImg.destroy();
  }
}
