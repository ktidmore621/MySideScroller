// ============================================================
//  Colonist — the first survivor dragged out of the ruins.
//
//  State machine: WANDER → WALK_TO_TILE → MINING → back to WANDER
//
//  Three-tap mining flow:
//    Tap 1 → colonist walks toward tile (WALK_TO_TILE)
//    Tap 2 → tile queued for mining (colonist continues walking)
//    Tap 3 → cancel (colonist returns to WANDER)
//
//  On arrival at tile: if tile is queued, begin MINING.
//  If tile is NOT queued (only tap-1), colonist just stands,
//  waiting for tap-2 or returning to wander after timeout.
// ============================================================

import {
  TILE, WORLD_W, WORLD_H,
  COLONIST_SPD, GRAVITY,
  HUNGER_DECAY, REST_DECAY,
} from '../config.js';
import { worldToTile, tileToWorld, surfaceAt } from '../world/WorldGen.js';

const STATE = {
  WANDER:       'WANDER',
  WALK_TO_TILE: 'WALK_TO_TILE',
  WAITING:      'WAITING',     // arrived at tile, waiting for tap-2
  MINING:       'MINING',
  REST:         'REST',
};

export default class Colonist {
  constructor(scene, x, y, map, wanderLeftCol, wanderRightCol) {
    this.scene = scene;
    this.map   = map;

    this.wanderLeftCol  = wanderLeftCol  ?? 2;
    this.wanderRightCol = wanderRightCol ?? (WORLD_W - 3);

    // Physics
    this.vx = 0;
    this.vy = 0;
    this.x  = x;
    this.y  = y;
    this.w  = TILE * 1.2;
    this.h  = TILE * 2;
    this.grounded = false;

    // Visual
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(10);
    this._drawSprite();

    // Needs (0–100)
    this.hunger = 80;
    this.rest   = 90;

    // Behaviour
    this.state      = STATE.WANDER;
    this.targetX    = x;
    this.targetCol  = 0;
    this.targetRow  = 0;
    this.wanderTimer = 0;
    this.waitTimer   = 0;

    // Mining state
    this.miningProgress  = 0;
    this.miningDuration  = 0;

    // Progress bar graphics
    this._progressGfx = scene.add.graphics();
    this._progressGfx.setDepth(15);

    this._pickWanderTarget();
  }

  // ── Main update tick ──────────────────────────────────────
  update(dt) {
    this._decayNeeds(dt);
    this._applyGravity(dt);
    this._runState(dt);
    this._moveAndCollide(dt);
    this._drawSprite();
    this._drawProgressBar();
    this._enforceWorldBounds();
  }

  // ── Needs decay ──────────────────────────────────────────
  _decayNeeds(dt) {
    this.hunger = Math.max(0, this.hunger - HUNGER_DECAY * dt);
    this.rest   = Math.max(0, this.rest   - REST_DECAY   * dt);
  }

  // ── Gravity ──────────────────────────────────────────────
  _applyGravity(dt) {
    if (!this.grounded) {
      this.vy += GRAVITY * dt;
    }
  }

  // ── State machine ─────────────────────────────────────────
  _runState(dt) {
    if (this.rest <= 5 && this.state !== STATE.REST) {
      this._cancelCurrentJob();
      this.state = STATE.REST;
      this.vx    = 0;
    }

    switch (this.state) {
      case STATE.WANDER:
        this._doWander(dt);
        break;
      case STATE.WALK_TO_TILE:
        this._doWalkToTile(dt);
        break;
      case STATE.WAITING:
        this._doWaiting(dt);
        break;
      case STATE.MINING:
        this._doMining(dt);
        break;
      case STATE.REST:
        this._doRest(dt);
        break;
    }
  }

  _doWander(dt) {
    this.wanderTimer -= dt;
    const dx = this.targetX - this.x;
    if (Math.abs(dx) < 4 || this.wanderTimer <= 0) {
      this._pickWanderTarget();
    } else {
      this.vx = Math.sign(dx) * COLONIST_SPD * 0.6;
    }
  }

  _doWalkToTile(dt) {
    const destX = this.targetCol * TILE + TILE / 2;
    const dx = destX - this.x;

    if (Math.abs(dx) < TILE) {
      // Arrived adjacent to the tile
      this.vx = 0;

      const jobSystem = this.scene.jobSystem;
      if (jobSystem && jobSystem.isQueued(this.targetCol, this.targetRow)) {
        // Tap 2 already happened — start mining
        this._startMining();
      } else {
        // Only tap-1 so far — wait for tap-2
        this.state = STATE.WAITING;
        this.waitTimer = 8; // wait up to 8 seconds for tap-2
      }
    } else {
      this.vx = Math.sign(dx) * COLONIST_SPD;
    }
  }

  _doWaiting(dt) {
    this.vx = 0;
    this.waitTimer -= dt;

    const jobSystem = this.scene.jobSystem;
    if (jobSystem && jobSystem.isQueued(this.targetCol, this.targetRow)) {
      // Player tapped again — start mining
      this._startMining();
      return;
    }

    if (this.waitTimer <= 0) {
      // Timed out waiting — go back to wander
      this._cancelCurrentJob();
      this.state = STATE.WANDER;
      this._pickWanderTarget();
    }
  }

  _startMining() {
    const jobSystem = this.scene.jobSystem;
    const tileId = this.map[this.targetRow]?.[this.targetCol] ?? 0;
    this.miningDuration = jobSystem ? jobSystem.getMiningDuration(tileId) : 1.5;
    this.miningProgress = 0;
    this.state = STATE.MINING;
  }

  _doMining(dt) {
    this.vx = 0;
    this.miningProgress += dt;

    // Wiggle animation while working
    this.x += Math.sin(this.miningProgress * 20) * 0.3;

    if (this.miningProgress >= this.miningDuration) {
      // Mining complete — remove tile
      const { targetCol: col, targetRow: row } = this;
      if (col >= 0 && col < WORLD_W && row >= 0 && row < WORLD_H) {
        this.map[row][col] = 0; // AIR
        this.scene.worldRenderer?.dirtyTile(col, row);
      }

      // Clean up job system
      this.scene.jobSystem?.completeMining(col, row);

      this.miningProgress = 0;
      this.miningDuration = 0;
      this.state = STATE.WANDER;
      this._pickWanderTarget();
    }
  }

  _doRest(dt) {
    this.vx   = 0;
    this.rest = Math.min(100, this.rest + 15 * dt);
    if (this.rest >= 80) {
      this.state = STATE.WANDER;
      this._pickWanderTarget();
    }
  }

  // ── Cancel current job and notify job system ────────────────
  _cancelCurrentJob() {
    if (this.state === STATE.WALK_TO_TILE || this.state === STATE.WAITING || this.state === STATE.MINING) {
      this.scene.jobSystem?.cancelTile(this.targetCol, this.targetRow);
    }
    this.miningProgress = 0;
    this.miningDuration = 0;
  }

  // ── Called by GameScene when player taps tile (tap 1) ───────
  sendToTile(col, row) {
    // Cancel any existing job first
    this._cancelCurrentJob();

    this.targetCol = col;
    this.targetRow = row;
    this.targetX   = col * TILE + TILE / 2;
    this.state     = STATE.WALK_TO_TILE;
  }

  // ── Called by GameScene on tap-3 cancel ─────────────────────
  cancelJob() {
    this._cancelCurrentJob();
    this.state = STATE.WANDER;
    this._pickWanderTarget();
  }

  // ── Check if colonist is targeting a specific tile ──────────
  isTargeting(col, row) {
    return (this.state === STATE.WALK_TO_TILE ||
            this.state === STATE.WAITING ||
            this.state === STATE.MINING) &&
           this.targetCol === col && this.targetRow === row;
  }

  // ── Movement & tile collision ─────────────────────────────
  _moveAndCollide(dt) {
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    this.grounded = false;

    const resolvedY = this._resolveAxis(this.x, nextY, false);
    if (resolvedY !== nextY) {
      if (this.vy > 0) this.grounded = true;
      this.vy = 0;
    }
    this.y = resolvedY;

    const resolvedX = this._resolveAxis(nextX, this.y, true);
    if (resolvedX !== nextX) {
      this.vx = 0;
      if (this.state === STATE.WANDER) this._pickWanderTarget();
    }
    this.x = resolvedX;
  }

  _resolveAxis(nx, ny, isHorizontal) {
    const hw = this.w / 2;
    const hh = this.h / 2;

    if (isHorizontal) {
      const testX   = this.vx >= 0 ? nx + hw : nx - hw;
      const topRow  = Math.floor((ny - hh + 1) / TILE);
      const botRow  = Math.floor((ny + hh - 1) / TILE);
      const col     = Math.floor(testX / TILE);

      if (col >= 0 && col < WORLD_W) {
        for (let r = topRow; r <= botRow; r++) {
          if (r >= 0 && r < WORLD_H && this._solid(col, r)) {
            return this.vx >= 0
              ? col * TILE - hw
              : (col + 1) * TILE + hw;
          }
        }
      }
    } else {
      const testY   = this.vy >= 0 ? ny + hh : ny - hh;
      const leftCol = Math.floor((nx - hw + 1) / TILE);
      const rightCol= Math.floor((nx + hw - 1) / TILE);
      const row     = Math.floor(testY / TILE);

      if (row >= 0 && row < WORLD_H) {
        for (let c = leftCol; c <= rightCol; c++) {
          if (c >= 0 && c < WORLD_W && this._solid(c, row)) {
            return this.vy >= 0
              ? row * TILE - hh
              : (row + 1) * TILE + hh;
          }
        }
      }
    }

    return isHorizontal ? nx : ny;
  }

  _solid(col, row) {
    if (col < 0 || col >= WORLD_W || row < 0 || row >= WORLD_H) return true;
    return this.map[row][col] !== 0;
  }

  _enforceWorldBounds() {
    const hw = this.w / 2, hh = this.h / 2;
    this.x = Phaser.Math.Clamp(this.x, hw, WORLD_W * TILE - hw);
    this.y = Phaser.Math.Clamp(this.y, hh, WORLD_H * TILE - hh);
  }

  _pickWanderTarget() {
    const range  = this.wanderRightCol - this.wanderLeftCol;
    const spread = Math.min(range, 5 + Math.floor(Math.random() * 12));
    const dir    = Math.random() < 0.5 ? -1 : 1;
    const { col } = worldToTile(this.x, this.y);
    const newCol  = Phaser.Math.Clamp(
      col + dir * spread,
      this.wanderLeftCol,
      this.wanderRightCol,
    );
    this.targetX  = newCol * TILE + TILE / 2;
    this.wanderTimer = 3 + Math.random() * 4;
  }

  // ── Draw the colonist rectangle ───────────────────────────
  _drawSprite() {
    const hw = this.w / 2, hh = this.h / 2;
    this.gfx.clear();

    // Body color based on state
    let bodyColor = 0x3a5c2a; // default green hazmat
    if (this.state === STATE.REST)    bodyColor = 0x334422;
    if (this.state === STATE.MINING)  bodyColor = 0xddaa00;
    if (this.state === STATE.WAITING) bodyColor = 0x5a7c4a; // lighter green

    this.gfx.fillStyle(bodyColor, 1);
    this.gfx.fillRect(this.x - hw, this.y - hh, this.w, this.h);

    // Visor strip
    this.gfx.fillStyle(0x88ccdd, 0.8);
    this.gfx.fillRect(this.x - hw + 2, this.y - hh + 2, this.w - 4, 5);

    // Legs
    this.gfx.fillStyle(0x2a3c1a, 1);
    this.gfx.fillRect(this.x - hw,  this.y + hh - 5, this.w / 2 - 1, 5);
    this.gfx.fillRect(this.x + 1,   this.y + hh - 5, this.w / 2 - 1, 5);
  }

  // ── Draw mining progress bar above the tile being mined ────
  _drawProgressBar() {
    this._progressGfx.clear();

    if (this.state !== STATE.MINING || this.miningDuration <= 0) return;

    const tileX = this.targetCol * TILE;
    const tileY = this.targetRow * TILE;

    const barW = TILE;
    const barH = 3;
    const barX = tileX;
    const barY = tileY - barH - 2; // above the tile
    const progress = Math.min(1, this.miningProgress / this.miningDuration);

    // Background
    this._progressGfx.fillStyle(0x000000, 0.7);
    this._progressGfx.fillRect(barX, barY, barW, barH);

    // Fill — green to yellow as it progresses
    const color = progress < 0.5 ? 0x44cc44 : 0xcccc00;
    this._progressGfx.fillStyle(color, 1);
    this._progressGfx.fillRect(barX, barY, barW * progress, barH);
  }

  // Legacy compatibility — no longer used but kept for safety
  assignJob(job) {
    this.sendToTile(job.col, job.row);
  }

  destroy() {
    this.gfx.destroy();
    this._progressGfx.destroy();
  }
}
