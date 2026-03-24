// ============================================================
//  GameScene — Main scene, wires everything together.
//
//  Responsibilities:
//    1. Generate the world (WorldGen)
//    2. Render the world (WorldRenderer)
//    3. Touch-draggable camera clamped to world bounds
//    4. Spawn first colonist
//    5. HUD needs bars (NeedsUI)
//    6. Touch-to-assign-mine-job (JobSystem)
// ============================================================

import { TILE, WORLD_W, WORLD_H, LAYER } from '../config.js';
import { generateWorld, surfaceAt, tileToWorld } from '../world/WorldGen.js';
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
    const { map, surfaceRow } = generateWorld(Date.now() & 0xffffffff);
    this.worldMap = map;

    // 2. Render world chunks
    this.worldRenderer = new WorldRenderer(this, map);

    // 3. Job system + overlay graphics
    this.jobSystem = new JobSystem();
    const jobOverlay = this.add.graphics().setDepth(5);
    this.jobSystem.setOverlay(jobOverlay);

    // 4. Spawn colonist near the horizontal centre of the map
    const spawnCol = Math.floor(WORLD_W / 2);
    const spawnRow = surfaceAt(map, spawnCol) - 2; // just above ground
    const { x: sx, y: sy } = tileToWorld(spawnCol, spawnRow);
    this.colonists = [new Colonist(this, sx, sy, map)];

    // 5. HUD
    this.needsUI = new NeedsUI(this, this.colonists);

    // 6. Camera setup
    this.cameras.main.setBounds(0, 0, WORLD_PX_W, WORLD_PX_H);
    this.cameras.main.scrollX = sx - this.scale.width  / 2;
    this.cameras.main.scrollY = sy - this.scale.height / 2;

    // 7. Touch drag camera
    this._setupTouchCamera();

    // 8. Touch-to-mine input
    this._setupMineInput();

    // 9. Sky gradient backdrop (drawn behind world chunks)
    this._drawSkyBackdrop();

    // 10. Depth label
    this._createDepthHUD();
  }

  // ── update ─────────────────────────────────────────────────
  update(time, delta) {
    const dt = delta / 1000; // seconds

    for (const c of this.colonists) c.update(dt);
    this.worldRenderer.update();
    this.needsUI.update();
    this._updateDepthHUD();
    this._applyTouchCameraVelocity(dt);

    // Keep camera inside world
    const cam = this.cameras.main;
    cam.scrollX = Phaser.Math.Clamp(
      cam.scrollX, 0, WORLD_PX_W - this.scale.width
    );
    cam.scrollY = Phaser.Math.Clamp(
      cam.scrollY, 0, WORLD_PX_H - this.scale.height
    );
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
      // Ignore if it was a mine-tap (handled separately)
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
      // Inertia momentum is kept in velX/velY
    });
  }

  _applyTouchCameraVelocity(dt) {
    if (this._drag.active) return;
    // Dampen inertia
    this._drag.velX *= 0.88;
    this._drag.velY *= 0.88;
    this.cameras.main.scrollX += this._drag.velX;
    this.cameras.main.scrollY += this._drag.velY;
  }

  // ── Mine input: tap a tile → add mine job ─────────────────
  _setupMineInput() {
    // We need to distinguish a tap (no drag) from a drag gesture.
    // Track the total movement to filter taps vs drags.
    this._tapStart = { x: 0, y: 0, moved: false };

    this.input.on('pointerdown', (ptr) => {
      this._tapStart.x     = ptr.x;
      this._tapStart.y     = ptr.y;
      this._tapStart.moved = false;
    });

    this.input.on('pointermove', (ptr) => {
      if (!ptr.isDown) return;
      const dx = Math.abs(ptr.x - this._tapStart.x);
      const dy = Math.abs(ptr.y - this._tapStart.y);
      if (dx > 8 || dy > 8) this._tapStart.moved = true;
    });

    this.input.on('pointerup', (ptr) => {
      if (this._tapStart.moved) return; // was a drag

      // Convert screen coords to world coords
      const cam  = this.cameras.main;
      const wx   = ptr.x + cam.scrollX;
      const wy   = ptr.y + cam.scrollY;

      const col  = Math.floor(wx / TILE);
      const row  = Math.floor(wy / TILE);

      // Bounds check
      if (col < 0 || col >= WORLD_W || row < 0 || row >= WORLD_H) return;

      const id = this.worldMap[row][col];
      if (id === 0) return;   // AIR — nothing to mine
      if (id === 8) return;   // BEDROCK — indestructible

      this.jobSystem.addMineJob(col, row);

      // If no colonist currently has a job, assign immediately
      for (const c of this.colonists) {
        if (c.state === 'WANDER' || c.state === 'REST') {
          const job = this.jobSystem.claimJob();
          if (job) c.assignJob(job);
          break;
        }
      }
    });
  }

  // ── Sky backdrop ──────────────────────────────────────────
  _drawSkyBackdrop() {
    // Dark post-apocalyptic sky above surface layer
    const sky = this.add.graphics().setDepth(-1);
    sky.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a08, 0x1a0a08, 1);
    sky.fillRect(0, 0, WORLD_PX_W, LAYER.SURFACE_TOP * TILE);
  }

  // ── Depth HUD: shows how deep the camera centre is ────────
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
