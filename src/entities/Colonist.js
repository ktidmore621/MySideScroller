// ============================================================
//  Colonist — the first survivor dragged out of the ruins.
//
//  Represented as a colored rectangle (placeholder art).
//  Has two needs: hunger and rest.
//  States: WANDER → SEEK_JOB → EXECUTE_JOB → IDLE/REST
//
//  Communicates with JobSystem via scene.jobSystem reference.
// ============================================================

import {
  TILE, WORLD_W, WORLD_H,
  COLONIST_SPD, GRAVITY,
  HUNGER_DECAY, REST_DECAY,
} from '../config.js';
import { worldToTile, tileToWorld, surfaceAt } from '../world/WorldGen.js';

// ── Internal state machine labels ───────────────────────────
const STATE = {
  WANDER:      'WANDER',
  WALK_TO_JOB: 'WALK_TO_JOB',
  EXECUTE_JOB: 'EXECUTE_JOB',
  REST:        'REST',
};

export default class Colonist {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x  world-pixel x
   * @param {number} y  world-pixel y
   * @param {number[][]} map  tile map reference
   * @param {number} [wanderLeftCol]  leftmost wander column
   * @param {number} [wanderRightCol] rightmost wander column
   */
  constructor(scene, x, y, map, wanderLeftCol, wanderRightCol) {
    this.scene = scene;
    this.map   = map;

    // Safe wander zone (tile columns)
    this.wanderLeftCol  = wanderLeftCol  ?? 2;
    this.wanderRightCol = wanderRightCol ?? (WORLD_W - 3);

    // ── Physics body (manual arcade) ───────────────────────
    this.vx = 0;
    this.vy = 0;
    this.x  = x;
    this.y  = y;
    this.w  = TILE * 1.2;
    this.h  = TILE * 2;
    this.grounded = false;

    // ── Visual ─────────────────────────────────────────────
    // Dull olive-green hazmat suit silhouette
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(10);
    this._drawSprite();

    // ── Needs (0–100) ──────────────────────────────────────
    this.hunger = 80;  // how full they are (drops over time)
    this.rest   = 90;  // how rested  (drops over time)

    // ── Behaviour ──────────────────────────────────────────
    this.state      = STATE.WANDER;
    this.targetX    = x;          // walk destination px
    this.job        = null;       // { col, row, type }
    this.jobTimer   = 0;          // work progress counter
    this.wanderTimer = 0;

    // Wander direction
    this._pickWanderTarget();
  }

  // ── Main update tick ──────────────────────────────────────
  update(dt) {
    this._decayNeeds(dt);
    this._applyGravity(dt);
    this._runState(dt);
    this._moveAndCollide(dt);
    this._drawSprite();
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
    // Rest overrides everything when critical
    if (this.rest <= 5 && this.state !== STATE.REST) {
      this.state = STATE.REST;
      this.vx    = 0;
    }

    switch (this.state) {
      case STATE.WANDER:
        this._doWander(dt);
        break;
      case STATE.WALK_TO_JOB:
        this._doWalkToJob(dt);
        break;
      case STATE.EXECUTE_JOB:
        this._doExecuteJob(dt);
        break;
      case STATE.REST:
        this._doRest(dt);
        break;
    }
  }

  _doWander(dt) {
    // Check if a job has been queued via JobSystem
    const job = this.scene.jobSystem?.claimJob();
    if (job) {
      this.job   = job;
      this.state = STATE.WALK_TO_JOB;
      const dest = tileToWorld(job.col, job.row);
      this.targetX = dest.x;
      return;
    }

    // Walk toward wander target
    this.wanderTimer -= dt;
    const dx = this.targetX - this.x;
    if (Math.abs(dx) < 4 || this.wanderTimer <= 0) {
      this._pickWanderTarget();
    } else {
      this.vx = Math.sign(dx) * COLONIST_SPD * 0.6;
    }
  }

  _doWalkToJob(dt) {
    const dx = this.targetX - this.x;
    if (Math.abs(dx) < TILE) {
      // Arrived
      this.vx    = 0;
      this.state = STATE.EXECUTE_JOB;
      this.jobTimer = 1.5; // seconds to mine one tile
    } else {
      this.vx = Math.sign(dx) * COLONIST_SPD;
    }
  }

  _doExecuteJob(dt) {
    this.jobTimer -= dt;
    if (this.jobTimer <= 0) {
      // Remove the tile from the map
      const { col, row } = this.job;
      if (col >= 0 && col < WORLD_W && row >= 0 && row < WORLD_H) {
        this.map[row][col] = 0; // AIR
        this.scene.worldRenderer?.dirtyTile(col, row);
      }
      this.job   = null;
      this.state = STATE.WANDER;
      this._pickWanderTarget();
    } else {
      // Wiggle animation while working
      this.x += Math.sin(this.jobTimer * 20) * 0.3;
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

  // ── Movement & tile collision ─────────────────────────────
  _moveAndCollide(dt) {
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    this.grounded = false;

    // ── Vertical (gravity / landing) ──────────────────────
    const resolvedY = this._resolveAxis(this.x, nextY, false);
    if (resolvedY !== nextY) {
      if (this.vy > 0) this.grounded = true;
      this.vy = 0;
    }
    this.y = resolvedY;

    // ── Horizontal ────────────────────────────────────────
    const resolvedX = this._resolveAxis(nextX, this.y, true);
    if (resolvedX !== nextX) {
      this.vx = 0;
      // Hit a wall — pick new wander target
      if (this.state === STATE.WANDER) this._pickWanderTarget();
    }
    this.x = resolvedX;
  }

  /**
   * Sweep a single axis and return the resolved coordinate.
   * isHorizontal = true  → test left/right edges
   * isHorizontal = false → test top/bottom edges
   */
  _resolveAxis(nx, ny, isHorizontal) {
    const hw = this.w / 2;
    const hh = this.h / 2;

    if (isHorizontal) {
      // Check leading edge columns
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
      // Check leading edge rows
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

  // ── World boundary clamp ──────────────────────────────────
  _enforceWorldBounds() {
    const hw = this.w / 2, hh = this.h / 2;
    this.x = Phaser.Math.Clamp(this.x, hw, WORLD_W * TILE - hw);
    this.y = Phaser.Math.Clamp(this.y, hh, WORLD_H * TILE - hh);
  }

  // ── Pick a random surface wander target (within safe zone) ──
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

    // Body: dull green hazmat
    this.gfx.fillStyle(
      this.state === STATE.REST ? 0x334422 :
      this.state === STATE.EXECUTE_JOB ? 0xddaa00 : 0x3a5c2a,
      1
    );
    this.gfx.fillRect(this.x - hw, this.y - hh, this.w, this.h);

    // Visor strip
    this.gfx.fillStyle(0x88ccdd, 0.8);
    this.gfx.fillRect(this.x - hw + 2, this.y - hh + 2, this.w - 4, 5);

    // Legs (two rects)
    this.gfx.fillStyle(0x2a3c1a, 1);
    this.gfx.fillRect(this.x - hw,          this.y + hh - 5, this.w / 2 - 1, 5);
    this.gfx.fillRect(this.x + 1,           this.y + hh - 5, this.w / 2 - 1, 5);
  }

  // ── Assign a job externally (called by JobSystem) ─────────
  assignJob(job) {
    this.job   = job;
    this.state = STATE.WALK_TO_JOB;
    const dest = tileToWorld(job.col, job.row);
    this.targetX = dest.x;
  }

  destroy() {
    this.gfx.destroy();
  }
}
