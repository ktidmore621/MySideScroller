// ============================================================
//  GameScene — Main scene, wires everything together.
//
//  Three-tap mining interaction:
//    Tap 1 → colonist walks toward tile
//    Tap 2 → queue mining (orange highlight)
//    Tap 3 → cancel mining (colonist returns to wander)
//
//  Touch-only input. Distinguishes taps from camera drags.
// ============================================================

import { TILE, WORLD_W, WORLD_H, LAYER, TILE_ID } from '../config.js';
import { generateWorld, tileToWorld } from '../world/WorldGen.js';
import WorldRenderer  from '../world/WorldRenderer.js';
import Colonist       from '../entities/Colonist.js';
import JobSystem      from '../systems/JobSystem.js';
import NeedsUI        from '../ui/NeedsUI.js';

const WORLD_PX_W = WORLD_W * TILE;
const WORLD_PX_H = WORLD_H * TILE;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ── create ─────────────────────────────────────────────────
  create() {
    // 1. Generate world data
    const { map, spawnCol, spawnRow, wanderLeftCol, wanderRightCol } =
      generateWorld(Date.now() & 0xffffffff);
    this.worldMap = map;

    // 2. Render world chunks
    this.worldRenderer = new WorldRenderer(this, map);

    // 3. Job system + overlay graphics
    this.jobSystem = new JobSystem();
    const jobOverlay = this.add.graphics().setDepth(5);
    this.jobSystem.setOverlay(jobOverlay);
    const hoverOverlay = this.add.graphics().setDepth(4);
    this.jobSystem.setHoverOverlay(hoverOverlay);

    // 4. Spawn colonist
    const { x: sx, y: sy } = tileToWorld(spawnCol, spawnRow);
    this.colonists = [new Colonist(this, sx, sy, map, wanderLeftCol, wanderRightCol)];

    // 5. HUD
    this.needsUI = new NeedsUI(this, this.colonists);

    // 6. Camera setup
    this.cameras.main.setBounds(0, 0, WORLD_PX_W, WORLD_PX_H);
    this.cameras.main.centerOn(sx, sy);

    // 7. Touch drag camera
    this._setupTouchCamera();

    // 8. Touch-to-mine input (three-tap system)
    this._setupMineInput();

    // 9. Sky gradient backdrop
    this._drawSkyBackdrop();

    // 10. Depth label
    this._createDepthHUD();
  }

  // ── update ─────────────────────────────────────────────────
  update(time, delta) {
    const dt = delta / 1000;

    for (const c of this.colonists) c.update(dt);
    this.worldRenderer.update();
    this.needsUI.update();
    this._updateDepthHUD();
    this._applyTouchCameraVelocity(dt);

    const cam = this.cameras.main;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, WORLD_PX_W - this.scale.width);
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, WORLD_PX_H - this.scale.height);
  }

  // ── Touch camera drag ─────────────────────────────────────
  _setupTouchCamera() {
    this._drag = {
      active:  false,
      startX:  0,
      startY:  0,
      prevX:   0,
      prevY:   0,
      velX:    0,
      velY:    0,
    };

    this.input.on('pointerdown', (ptr) => {
      this._drag.active = true;
      this._drag.startX = ptr.x;
      this._drag.startY = ptr.y;
      this._drag.prevX  = ptr.x;
      this._drag.prevY  = ptr.y;
      this._drag.velX   = 0;
      this._drag.velY   = 0;
    });

    this.input.on('pointermove', (ptr) => {
      if (!this._drag.active || !ptr.isDown) return;
      const dx = ptr.x - this._drag.prevX;
      const dy = ptr.y - this._drag.prevY;
      this._drag.velX = -dx;
      this._drag.velY = -dy;
      this.cameras.main.scrollX -= dx;
      this.cameras.main.scrollY -= dy;
      this._drag.prevX = ptr.x;
      this._drag.prevY = ptr.y;
    });

    this.input.on('pointerup', () => {
      this._drag.active = false;
    });
  }

  _applyTouchCameraVelocity(dt) {
    if (this._drag.active) return;
    this._drag.velX *= 0.88;
    this._drag.velY *= 0.88;
    if (Math.abs(this._drag.velX) < 0.1) this._drag.velX = 0;
    if (Math.abs(this._drag.velY) < 0.1) this._drag.velY = 0;
    this.cameras.main.scrollX += this._drag.velX;
    this.cameras.main.scrollY += this._drag.velY;
  }

  // ── Three-tap mine input ───────────────────────────────────
  _setupMineInput() {
    this._tapStart = { x: 0, y: 0, moved: false };

    this.input.on('pointerdown', (ptr) => {
      this._tapStart.x     = ptr.x;
      this._tapStart.y     = ptr.y;
      this._tapStart.moved = false;

      // Show hover highlight on touch start (only for mineable tiles)
      this._showHoverAtPointer(ptr);
    });

    this.input.on('pointermove', (ptr) => {
      if (!ptr.isDown) return;
      const dx = Math.abs(ptr.x - this._tapStart.x);
      const dy = Math.abs(ptr.y - this._tapStart.y);
      if (dx > 8 || dy > 8) {
        this._tapStart.moved = true;
        this.jobSystem.clearHover();
      }
    });

    this.input.on('pointerup', (ptr) => {
      // Clear hover on release
      this.jobSystem.clearHover();

      if (this._tapStart.moved) return; // was a drag

      // Convert screen coords to world coords
      const cam = this.cameras.main;
      const wx  = ptr.x + cam.scrollX;
      const wy  = ptr.y + cam.scrollY;
      const col = Math.floor(wx / TILE);
      const row = Math.floor(wy / TILE);

      // Bounds check
      if (col < 0 || col >= WORLD_W || row < 0 || row >= WORLD_H) return;

      const tileId = this.worldMap[row][col];

      // Only respond to mineable tiles
      if (!this.jobSystem.isMineable(tileId)) return;

      // Three-tap logic
      const action = this.jobSystem.handleTap(col, row, tileId);

      switch (action) {
        case 'walk': {
          // Tap 1: send colonist walking toward this tile
          const colonist = this._findAvailableColonist(col, row);
          if (colonist) {
            colonist.sendToTile(col, row);
            this.jobSystem.assignColonist(col, row, colonist);
          }
          break;
        }
        case 'queue': {
          // Tap 2: mining queued, highlight shown
          // If colonist is already waiting at the tile, it will
          // detect the queue state on its next update tick
          break;
        }
        case 'cancel': {
          // Tap 3: cancel mining
          for (const c of this.colonists) {
            if (c.isTargeting(col, row)) {
              c.cancelJob();
              break;
            }
          }
          break;
        }
      }
    });
  }

  /**
   * Show hover highlight when touching a mineable tile.
   */
  _showHoverAtPointer(ptr) {
    const cam = this.cameras.main;
    const wx  = ptr.x + cam.scrollX;
    const wy  = ptr.y + cam.scrollY;
    const col = Math.floor(wx / TILE);
    const row = Math.floor(wy / TILE);

    if (col < 0 || col >= WORLD_W || row < 0 || row >= WORLD_H) return;

    const tileId = this.worldMap[row][col];
    if (this.jobSystem.isMineable(tileId)) {
      this.jobSystem.showHover(col, row);
    }
  }

  /**
   * Find a colonist that can take a job — prefer idle/wandering ones.
   */
  _findAvailableColonist(col, row) {
    // First look for one that's wandering or resting
    for (const c of this.colonists) {
      if (c.state === 'WANDER' || c.state === 'REST') {
        return c;
      }
    }
    // If all busy, redirect the first colonist
    if (this.colonists.length > 0) {
      return this.colonists[0];
    }
    return null;
  }

  // ── Sky backdrop ──────────────────────────────────────────
  _drawSkyBackdrop() {
    const sky = this.add.graphics().setDepth(-1);
    sky.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a08, 0x1a0a08, 1);
    sky.fillRect(0, 0, WORLD_PX_W, LAYER.SURFACE_TOP * TILE);
  }

  // ── Depth HUD ─────────────────────────────────────────────
  _createDepthHUD() {
    this._depthText = this.add.text(
      this.scale.width - 8, 8,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#888866',
        align: 'right',
      }
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
  }

  _updateDepthHUD() {
    const cam     = this.cameras.main;
    const centreY = cam.scrollY + this.scale.height / 2;
    const tileRow = Math.floor(centreY / TILE);
    const depthM  = Math.max(0, tileRow - LAYER.SURFACE_TOP);
    this._depthText.setText(`DEPTH: ${depthM}m`);
  }
}
