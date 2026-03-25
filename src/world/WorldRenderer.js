// ============================================================
//  WorldRenderer — Chunked tile renderer
//
//  The world is 100×200 = 20,000 tiles.  Drawing every tile
//  every frame would be too slow.  Strategy: divide the world
//  into CHUNK_W×CHUNK_H sections, pre-render each to a
//  CanvasTexture, and just blit.  Only dirty chunks redraw.
//
//  Dirt / grass tiles are cropped from the tiles-dirt-grass
//  image using drawImage with explicit source rectangles.
//  Other tile types remain coloured placeholders.
// ============================================================

import { TILE, WORLD_W, WORLD_H, TILE_ID, TILE_DEF, TILE_SRC } from '../config.js';

const CHUNK_W = 10; // tiles wide
const CHUNK_H = 10; // tiles tall

const COLS = Math.ceil(WORLD_W / CHUNK_W);
const ROWS = Math.ceil(WORLD_H / CHUNK_H);

// Tile IDs rendered with the dirt/grass tile image
const DIRT_TILE_IDS = new Set([
  TILE_ID.SURFACE_DIRT,
  TILE_ID.EARTH,
  TILE_ID.CLAY,
]);

export default class WorldRenderer {
  /**
   * @param {Phaser.Scene} scene
   * @param {Uint8Array[]} map
   */
  constructor(scene, map) {
    this.scene = scene;
    this.map   = map;

    // Get the raw HTMLImageElement from the loaded texture
    this._srcImg = scene.textures.get('tiles-dirt-grass').getSourceImage();

    // Pre-render each tile variant to its own TILE×TILE canvas so
    // we can stamp them quickly into chunk canvases.
    this._tileCanvases = this._buildTileCanvases();

    // One CanvasTexture per chunk
    this.chunks = []; // [chunkRow][chunkCol] = { ct, dirty }

    this._buildAllChunks();
  }

  // ── Create pre-scaled TILE×TILE canvases for each tile variant ──
  _buildTileCanvases() {
    const src = this._srcImg;
    const canvases = {};

    // dirt_0 — plain underground dirt (first tile, top-left of sheet)
    const d = TILE_SRC.dirt[0];
    canvases.dirt = this._cropToCanvas(src, d.x, d.y, d.w, d.h);

    // grass_top_0 — top surface tile with grass edge
    const g = TILE_SRC.grassTop[0];
    canvases.grassTop = this._cropToCanvas(src, g.x, g.y, g.w, g.h);

    // Corner tiles (grass on top + side)
    const ctl = TILE_SRC.grassCornerTL;
    canvases.grassCornerTL = this._cropToCanvas(src, ctl.x, ctl.y, ctl.w, ctl.h);
    const ctr = TILE_SRC.grassCornerTR;
    canvases.grassCornerTR = this._cropToCanvas(src, ctr.x, ctr.y, ctr.w, ctr.h);

    // Side edge tiles (grass on left/right side only)
    const gl = TILE_SRC.grassLeft;
    canvases.grassLeft = this._cropToCanvas(src, gl.x, gl.y, gl.w, gl.h);
    const gr = TILE_SRC.grassRight;
    canvases.grassRight = this._cropToCanvas(src, gr.x, gr.y, gr.w, gr.h);

    return canvases;
  }

  // Crop a region from srcImg and scale it to TILE×TILE on a new canvas
  _cropToCanvas(srcImg, sx, sy, sw, sh) {
    const canvas = document.createElement('canvas');
    canvas.width  = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, TILE, TILE);
    return canvas;
  }

  // ── Check if a neighbor tile is air (exposed) ──
  _isAir(col, row) {
    if (row < 0 || col < 0 || col >= WORLD_W) return true; // out of bounds = air
    if (row >= WORLD_H) return false; // below world = solid
    return this.map[row][col] === TILE_ID.AIR;
  }

  // ── Decide which pre-rendered canvas to use for a dirt/grass tile ──
  _pickTileCanvas(col, row) {
    const airAbove = this._isAir(col, row - 1);
    const airLeft  = this._isAir(col - 1, row);
    const airRight = this._isAir(col + 1, row);

    // Top-left corner: air above AND to the left
    if (airAbove && airLeft) return this._tileCanvases.grassCornerTL;
    // Top-right corner: air above AND to the right
    if (airAbove && airRight) return this._tileCanvases.grassCornerTR;
    // Top surface only: air above
    if (airAbove) return this._tileCanvases.grassTop;
    // Left exposed edge: air to the left (but not above)
    if (airLeft) return this._tileCanvases.grassLeft;
    // Right exposed edge: air to the right (but not above)
    if (airRight) return this._tileCanvases.grassRight;
    // Fully underground: no air exposure
    return this._tileCanvases.dirt;
  }

  _buildAllChunks() {
    for (let cr = 0; cr < ROWS; cr++) {
      this.chunks[cr] = [];
      for (let cc = 0; cc < COLS; cc++) {
        const pxW = CHUNK_W * TILE;
        const pxH = CHUNK_H * TILE;

        // Create a CanvasTexture for this chunk
        const key = `chunk_${cr}_${cc}`;
        const ct = this.scene.textures.createCanvas(key, pxW, pxH);

        // Display it as an image in the scene
        const img = this.scene.add.image(
          cc * pxW, cr * pxH,
          key
        );
        img.setOrigin(0, 0);
        img.setDepth(0);

        this.chunks[cr][cc] = { ct, img, dirty: true };
      }
    }
    this._renderDirtyChunks();
  }

  _renderChunk(cr, cc) {
    const { ct } = this.chunks[cr][cc];
    const ctx = ct.getContext();
    const startCol = cc * CHUNK_W;
    const startRow = cr * CHUNK_H;

    // Clear the chunk canvas
    ctx.clearRect(0, 0, CHUNK_W * TILE, CHUNK_H * TILE);

    for (let row = startRow; row < startRow + CHUNK_H && row < WORLD_H; row++) {
      for (let col = startCol; col < startCol + CHUNK_W && col < WORLD_W; col++) {
        const id  = this.map[row][col];
        const def = TILE_DEF[id];
        if (!def || def.color === null) continue; // AIR

        const lx = (col - startCol) * TILE;
        const ly = (row - startRow) * TILE;

        if (DIRT_TILE_IDS.has(id)) {
          // Draw pre-cropped tile canvas (drawImage with source rect)
          const tileCanvas = this._pickTileCanvas(col, row);
          ctx.drawImage(tileCanvas, lx, ly);
        } else {
          // Coloured rectangle placeholder (rock, bedrock, ruin wall, etc.)
          ctx.fillStyle = '#' + def.color.toString(16).padStart(6, '0');
          ctx.fillRect(lx, ly, TILE - 1, TILE - 1);

          // Subtle top-edge highlight
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(lx, ly, TILE - 1, Math.max(2, Math.round(TILE * 0.08)));
        }
      }
    }

    ct.refresh();
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

  // ── Mark a tile and its neighbors dirty (e.g. after mining) ──
  // Neighbors must redraw because edge detection depends on adjacency.
  dirtyTile(col, row) {
    const mark = (c, r) => {
      const cc = Math.floor(c / CHUNK_W);
      const cr = Math.floor(r / CHUNK_H);
      if (this.chunks[cr] && this.chunks[cr][cc]) {
        this.chunks[cr][cc].dirty = true;
      }
    };
    mark(col, row);
    mark(col - 1, row);
    mark(col + 1, row);
    mark(col, row - 1);
    mark(col, row + 1);
  }

  // ── Call once per frame (only redraws dirty chunks) ───────
  update() {
    this._renderDirtyChunks();
  }

  destroy() {
    for (const row of this.chunks) {
      for (const chunk of row) {
        chunk.img.destroy();
        chunk.ct.destroy();
      }
    }
  }
}
