// ============================================================
//  WorldRenderer — Chunked tile renderer
//
//  The world is 300×600 = 180,000 tiles.  Drawing every tile
//  every frame as individual Graphics calls would be too slow.
//  Strategy: divide the world into CHUNK_W×CHUNK_H sections.
//  Each chunk is pre-rendered to a RenderTexture once, then
//  just blitted.  Only dirty chunks are redrawn (e.g. after
//  mining a tile).
// ============================================================

import { TILE, WORLD_W, WORLD_H, TILE_ID, TILE_DEF } from '../config.js';

const CHUNK_W = 20; // tiles wide
const CHUNK_H = 20; // tiles tall

const COLS = Math.ceil(WORLD_W / CHUNK_W);
const ROWS = Math.ceil(WORLD_H / CHUNK_H);

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

    // Temp graphics used to paint tiles into RenderTextures
    this._brush  = scene.add.graphics();
    this._brush.setVisible(false);

    this._buildAllChunks();
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

    for (let row = startRow; row < startRow + CHUNK_H && row < WORLD_H; row++) {
      for (let col = startCol; col < startCol + CHUNK_W && col < WORLD_W; col++) {
        const id   = this.map[row][col];
        const def  = TILE_DEF[id];
        if (!def || def.color === null) continue; // AIR

        const lx = (col - startCol) * TILE;
        const ly = (row - startRow) * TILE;

        this._brush.fillStyle(def.color, 1);
        this._brush.fillRect(lx, ly, TILE - 1, TILE - 1);

        // Subtle top-edge highlight (fake lighting)
        this._brush.fillStyle(0xffffff, 0.07);
        this._brush.fillRect(lx, ly, TILE - 1, 2);
      }
    }

    rt.clear();
    rt.draw(this._brush, 0, 0);
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

  // ── Called by Colonist after mining a tile ────────────────
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

  // ── Preload: only render chunks near the camera ───────────
  // (optional optimisation for later — currently renders all)

  destroy() {
    for (const row of this.chunks) {
      for (const chunk of row) {
        chunk.rt.destroy();
      }
    }
    this._brush.destroy();
  }
}
