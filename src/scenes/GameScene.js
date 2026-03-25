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

import { TILE, WORLD_W, WORLD_H, LAYER, TILE_ID, ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT, ZOOM_SMOOTH, REACH } from '../config.js';
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

    // 4. Create colonist animations
    this.anims.create({
      key: 'colonist-idle',
      frames: [{ key: 'colonist', frame: 0 }],
      frameRate: 1,
      repeat: 0,
    });
    this.anims.create({
      key: 'colonist-walk',
      frames: this.anims.generateFrameNumbers('colonist', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'colonist-run',
      frames: this.anims.generateFrameNumbers('colonist', { start: 8, end: 15 }),
      frameRate: 14,
      repeat: -1,
    });

    // 5. Spawn colonist
    const { x: sx, y: sy } = tileToWorld(spawnCol, spawnRow);
    this.colonists = [new Colonist(this, sx, sy, map, wanderLeftCol, wanderRightCol)];

    // 6. HUD
    this.needsUI = new NeedsUI(this, this.colonists);

    // 7. Camera setup
    this.cameras.main.setBounds(0, 0, WORLD_PX_W, WORLD_PX_H);
    this.cameras.main.centerOn(sx, sy);

    // 8. Touch drag camera
    this._setupTouchCamera();

    // 9. Touch-to-mine input (three-tap system)
    this._setupMineInput();

    // 10. Sky gradient backdrop
    this._drawSkyBackdrop();

    // 11. Depth label
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
    this._updateReachFlashes(dt);

    const cam = this.cameras.main;
    const viewW = this.scale.width  / cam.zoom;
    const viewH = this.scale.height / cam.zoom;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, WORLD_PX_W - viewW));
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, WORLD_PX_H - viewH));
  }

  // ── Touch camera drag + pinch-to-zoom ────────────────────
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

    // Pinch-to-zoom state
    this._pinch = {
      active:       false,
      startDist:    0,
      startZoom:    ZOOM_DEFAULT,
      prevMidX:     0,
      prevMidY:     0,
    };
    // Track whether a pinch occurred during this touch sequence so the
    // mine-input handler can reject false taps after a pinch ends.
    this._wasPinching = false;
    this._zoomTarget  = ZOOM_DEFAULT;
    this._zoomCurrent = ZOOM_DEFAULT;

    this.input.on('pointerdown', (ptr) => {
      // Check if two pointers are now down — start pinch
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        this._startPinch(p1, p2);
        this._drag.active = false; // cancel drag when pinch starts
        return;
      }

      this._drag.active = true;
      this._drag.startX = ptr.x;
      this._drag.startY = ptr.y;
      this._drag.prevX  = ptr.x;
      this._drag.prevY  = ptr.y;
      this._drag.velX   = 0;
      this._drag.velY   = 0;
    });

    this.input.on('pointermove', (ptr) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      // Pinch in progress
      if (this._pinch.active && p1.isDown && p2.isDown) {
        this._updatePinch(p1, p2);
        return;
      }

      // Single-finger drag
      if (!this._drag.active || !ptr.isDown || this._pinch.active) return;
      const dx = ptr.x - this._drag.prevX;
      const dy = ptr.y - this._drag.prevY;
      const cam = this.cameras.main;
      this._drag.velX = -dx;
      this._drag.velY = -dy;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      this._drag.prevX = ptr.x;
      this._drag.prevY = ptr.y;
    });

    this.input.on('pointerup', () => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (!p1.isDown || !p2.isDown) {
        this._pinch.active = false;
      }
      if (!p1.isDown && !p2.isDown) {
        this._drag.active  = false;
        this._wasPinching  = false; // only clear after ALL fingers are up
      }
    });
  }

  _startPinch(p1, p2) {
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    this._pinch.active    = true;
    this._wasPinching     = true; // persists until all fingers lift
    this._pinch.startDist = dist;
    this._pinch.startZoom = this._zoomTarget;
    this._pinch.prevMidX  = (p1.x + p2.x) / 2;
    this._pinch.prevMidY  = (p1.y + p2.y) / 2;
  }

  _updatePinch(p1, p2) {
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    if (this._pinch.startDist < 1) return;

    const ratio = dist / this._pinch.startDist;
    this._zoomTarget = Phaser.Math.Clamp(
      this._pinch.startZoom * ratio,
      ZOOM_MIN,
      ZOOM_MAX,
    );

    // Pan camera so the midpoint stays stable
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const cam = this.cameras.main;
    const dx = midX - this._pinch.prevMidX;
    const dy = midY - this._pinch.prevMidY;
    cam.scrollX -= dx / cam.zoom;
    cam.scrollY -= dy / cam.zoom;
    this._pinch.prevMidX = midX;
    this._pinch.prevMidY = midY;
  }

  _applyTouchCameraVelocity(dt) {
    // Smooth zoom interpolation
    const cam = this.cameras.main;
    this._zoomCurrent = Phaser.Math.Linear(this._zoomCurrent, this._zoomTarget, ZOOM_SMOOTH);
    if (Math.abs(this._zoomCurrent - this._zoomTarget) < 0.001) {
      this._zoomCurrent = this._zoomTarget;
    }
    cam.setZoom(this._zoomCurrent);

    // Inertia drag
    if (this._drag.active || this._pinch.active) return;
    this._drag.velX *= 0.88;
    this._drag.velY *= 0.88;
    if (Math.abs(this._drag.velX) < 0.1) this._drag.velX = 0;
    if (Math.abs(this._drag.velY) < 0.1) this._drag.velY = 0;
    cam.scrollX += this._drag.velX / cam.zoom;
    cam.scrollY += this._drag.velY / cam.zoom;
  }

  // ── Three-tap mine input ───────────────────────────────────
  _setupMineInput() {
    this._tapStart = { x: 0, y: 0, moved: false };

    // Graphics layer for out-of-reach flash
    this._reachFlashGfx = this.add.graphics().setDepth(6);
    this._reachFlashes = []; // { col, row, timer }

    this.input.on('pointerdown', (ptr) => {
      this._tapStart.x     = ptr.x;
      this._tapStart.y     = ptr.y;
      this._tapStart.moved = false;

      // Don't show hover during pinch
      if (this._pinch.active) return;

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

      if (this._tapStart.moved) return;                      // was a drag
      if (this._pinch.active || this._wasPinching) return;   // was a pinch

      // Convert screen coords to world coords (accounting for zoom)
      const cam = this.cameras.main;
      const wx  = ptr.x / cam.zoom + cam.scrollX;
      const wy  = ptr.y / cam.zoom + cam.scrollY;
      const col = Math.floor(wx / TILE);
      const row = Math.floor(wy / TILE);

      // Bounds check
      if (col < 0 || col >= WORLD_W || row < 0 || row >= WORLD_H) return;

      const tileId = this.worldMap[row][col];

      // Only respond to mineable tiles
      if (!this.jobSystem.isMineable(tileId)) return;

      // Three-tap logic (reach is validated when the colonist arrives,
      // not here — tap 1 must be able to target any visible tile)
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
   * Check if a tile is within a colonist's mining reach.
   */
  _isWithinReach(colonist, col, row) {
    // Colonist feet position (bottom of sprite) → tile row
    const feetY   = colonist.y + colonist.h / 2;
    const feetRow = Math.floor(feetY / TILE);
    const bodyCol = Math.floor(colonist.x / TILE);

    // Horizontal check: same column or ±REACH.SIDE
    const colDist = Math.abs(col - bodyCol);
    if (colDist > REACH.SIDE) return false;

    // Vertical check: tile can be at feet level down to REACH.DOWN,
    // or up to REACH.UP tiles above feet
    const rowDiff = feetRow - row; // positive means tile is above feet
    if (rowDiff < -REACH.DOWN) return false; // tile is too far below
    if (rowDiff > REACH.UP) return false;    // tile is too far above

    return true;
  }

  /**
   * Show a brief red flash on an out-of-reach tile.
   */
  _showOutOfReachFlash(col, row) {
    this._reachFlashes.push({ col, row, timer: 0.5 });
  }

  /**
   * Update and draw out-of-reach flashes.
   */
  _updateReachFlashes(dt) {
    if (this._reachFlashes.length === 0) return;

    this._reachFlashGfx.clear();

    for (let i = this._reachFlashes.length - 1; i >= 0; i--) {
      const f = this._reachFlashes[i];
      f.timer -= dt;
      if (f.timer <= 0) {
        this._reachFlashes.splice(i, 1);
        continue;
      }
      const alpha = f.timer / 0.5; // fade out
      this._reachFlashGfx.fillStyle(0xff0000, 0.4 * alpha);
      this._reachFlashGfx.fillRect(f.col * TILE, f.row * TILE, TILE, TILE);
      this._reachFlashGfx.lineStyle(2, 0xff2222, 0.8 * alpha);
      this._reachFlashGfx.strokeRect(f.col * TILE, f.row * TILE, TILE, TILE);
    }
  }

  /**
   * Show hover highlight when touching a mineable tile.
   */
  _showHoverAtPointer(ptr) {
    const cam = this.cameras.main;
    const wx  = ptr.x / cam.zoom + cam.scrollX;
    const wy  = ptr.y / cam.zoom + cam.scrollY;
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
