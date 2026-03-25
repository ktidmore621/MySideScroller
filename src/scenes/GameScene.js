// ============================================================
//  GameScene — Main scene, wires everything together.
//
//  Clean world: terrain, starting structure, and camera.
//  Touch controls: single-finger drag + pinch-to-zoom.
// ============================================================

import { TILE, WORLD_W, WORLD_H, LAYER, ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT, ZOOM_SMOOTH } from '../config.js';
import { generateWorld, tileToWorld } from '../world/WorldGen.js';
import WorldRenderer from '../world/WorldRenderer.js';

const WORLD_PX_W = WORLD_W * TILE;
const WORLD_PX_H = WORLD_H * TILE;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ── create ─────────────────────────────────────────────────
  create() {
    // 1. Generate world data
    const { map, spawnCol, spawnRow } =
      generateWorld(Date.now() & 0xffffffff);
    this.worldMap = map;

    // 2. Render world chunks
    this.worldRenderer = new WorldRenderer(this, map);

    // 3. Camera setup — center on spawn point
    const { x: cx, y: cy } = tileToWorld(spawnCol, spawnRow);
    // NOTE: cam.setBounds() removed — conflicts with setZoom in Phaser 3.
    // Bounds are enforced manually in update() instead.
    this.cameras.main.centerOn(cx, cy);

    // 4. Touch drag + pinch-to-zoom camera
    this._setupTouchCamera();

    // 5. Zoom debug readout (top-right, below depth HUD)
    this._createZoomHUD();

    // 6. Sky gradient backdrop
    this._drawSkyBackdrop();

    // 6. Depth label
    this._createDepthHUD();
  }

  // ── update ─────────────────────────────────────────────────
  update(time, delta) {
    const dt = delta / 1000;

    this.worldRenderer.update();
    this._updateDepthHUD();
    this._updateZoomHUD();
    this._applyTouchCameraSmooth(dt);

    // Clamp camera to world bounds
    const cam = this.cameras.main;
    const viewW = this.scale.width  / cam.zoom;
    const viewH = this.scale.height / cam.zoom;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, WORLD_PX_W - viewW));
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, WORLD_PX_H - viewH));
  }

  // ── Touch camera: single-finger drag + pinch-to-zoom ──────
  _setupTouchCamera() {
    console.log('touch camera setup');

    // Drag state
    this._drag = {
      active: false,
      prevX:  0,
      prevY:  0,
      velX:   0,
      velY:   0,
    };

    // Pinch-to-zoom state
    this._pinch = {
      active:    false,
      startDist: 0,
      startZoom: ZOOM_DEFAULT,
      prevMidX:  0,
      prevMidY:  0,
    };

    this._zoomTarget  = ZOOM_DEFAULT;
    this._zoomCurrent = ZOOM_DEFAULT;

    // ── pointer down ──
    this.input.on('pointerdown', (ptr) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      // Two fingers down — start pinch, cancel any drag
      if (p1.isDown && p2.isDown) {
        this._startPinch(p1, p2);
        this._drag.active = false;
        return;
      }

      // Single finger — start drag
      this._drag.active = true;
      this._drag.prevX  = ptr.x;
      this._drag.prevY  = ptr.y;
      this._drag.velX   = 0;
      this._drag.velY   = 0;
    });

    // ── pointer move ──
    this.input.on('pointermove', (ptr) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      // Two-finger pinch in progress
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

    // ── pointer up ──
    this.input.on('pointerup', () => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      // End pinch when fewer than two fingers remain
      if (!p1.isDown || !p2.isDown) {
        this._pinch.active = false;
      }

      // End drag when all fingers are up
      if (!p1.isDown && !p2.isDown) {
        this._drag.active = false;
      }
    });
  }

  _startPinch(p1, p2) {
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    this._pinch.active    = true;
    this._pinch.startDist = dist;
    this._pinch.startZoom = this._zoomTarget;
    this._pinch.prevMidX  = (p1.x + p2.x) / 2;
    this._pinch.prevMidY  = (p1.y + p2.y) / 2;
  }

  _updatePinch(p1, p2) {
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    if (this._pinch.startDist < 1) return;

    // Scale zoom proportionally to finger distance change
    const ratio = dist / this._pinch.startDist;
    this._zoomTarget = Phaser.Math.Clamp(
      this._pinch.startZoom * ratio,
      ZOOM_MIN,
      ZOOM_MAX,
    );

    // Pan camera so the midpoint between fingers stays stable
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

  _applyTouchCameraSmooth(dt) {
    // Smooth zoom interpolation
    const cam = this.cameras.main;
    this._zoomCurrent = Phaser.Math.Linear(this._zoomCurrent, this._zoomTarget, ZOOM_SMOOTH);
    if (Math.abs(this._zoomCurrent - this._zoomTarget) < 0.001) {
      this._zoomCurrent = this._zoomTarget;
    }
    cam.setZoom(this._zoomCurrent);

    // Inertia drag (only when no fingers are touching)
    if (this._drag.active || this._pinch.active) return;
    this._drag.velX *= 0.88;
    this._drag.velY *= 0.88;
    if (Math.abs(this._drag.velX) < 0.1) this._drag.velX = 0;
    if (Math.abs(this._drag.velY) < 0.1) this._drag.velY = 0;
    cam.scrollX += this._drag.velX / cam.zoom;
    cam.scrollY += this._drag.velY / cam.zoom;
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

  _createZoomHUD() {
    this._zoomText = this.add.text(
      this.scale.width - 8, 24,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#66aa66',
        align: 'right',
      }
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
  }

  _updateZoomHUD() {
    const cam = this.cameras.main;
    this._zoomText.setText(`ZOOM: ${cam.zoom.toFixed(2)} (target: ${this._zoomTarget.toFixed(2)})`);
  }

  _updateDepthHUD() {
    const cam     = this.cameras.main;
    const centreY = cam.scrollY + this.scale.height / 2;
    const tileRow = Math.floor(centreY / TILE);
    const depthM  = Math.max(0, tileRow - LAYER.SURFACE_TOP);
    this._depthText.setText(`DEPTH: ${depthM}m`);
  }
}
