// ============================================================
//  JobSystem — Three-tap mining interaction
//
//  Tap 1: Walk toward tile (no highlight)
//  Tap 2: Queue for mining (orange highlight)
//  Tap 3: Cancel mining (remove highlight, colonist returns to wander)
//
//  Tracks per-tile tap state and active mining jobs.
// ============================================================

import { TILE, TILE_ID, TILE_DEF } from '../config.js';

export const JOB_TYPE = {
  MINE: 'MINE',
};

// Tap states per tile
const TAP_STATE = {
  NONE:     0,  // no interaction yet
  WALKING:  1,  // tap 1: colonist walking toward tile
  QUEUED:   2,  // tap 2: mining queued, highlight shown
};

export default class JobSystem {
  constructor() {
    // Map key = "col,row" → { state, col, row, assignedColonist }
    /** @type {Map<string, {state:number, col:number, row:number, assignedColonist:object|null}>} */
    this.tiles = new Map();

    /** @type {Phaser.GameObjects.Graphics|null} */
    this.overlayGfx = null;

    /** @type {Phaser.GameObjects.Graphics|null} */
    this.hoverGfx = null;
  }

  setOverlay(gfx) {
    this.overlayGfx = gfx;
  }

  setHoverOverlay(gfx) {
    this.hoverGfx = gfx;
  }

  _key(col, row) {
    return `${col},${row}`;
  }

  /**
   * Returns true if a tile type is mineable (not air, not bedrock).
   */
  isMineable(tileId) {
    if (tileId === TILE_ID.AIR || tileId === TILE_ID.BEDROCK) return false;
    const def = TILE_DEF[tileId];
    return def && def.hardness > 0 && def.hardness < 999;
  }

  /**
   * Get mining duration in seconds based on tile hardness.
   * Soft tiles (hardness 1) = 0.8s, hard tiles (hardness 5) = 2.5s
   */
  getMiningDuration(tileId) {
    const def = TILE_DEF[tileId];
    if (!def) return 1.5;
    const hardness = def.hardness;
    return 0.5 + hardness * 0.4; // 0.9s for dirt(1), 1.3s for earth(2), 1.7s for stone(3), 2.1s for deep(4), 2.5s for ruin(5)
  }

  /**
   * Handle a tap on a tile. Returns the action taken.
   * @returns {'walk'|'queue'|'cancel'|'ignore'}
   */
  handleTap(col, row, tileId) {
    if (!this.isMineable(tileId)) return 'ignore';

    const key = this._key(col, row);
    const entry = this.tiles.get(key);

    if (!entry) {
      // Tap 1: start walking
      this.tiles.set(key, {
        state: TAP_STATE.WALKING,
        col,
        row,
        assignedColonist: null,
      });
      this._redrawOverlay();
      return 'walk';
    }

    if (entry.state === TAP_STATE.WALKING) {
      // Tap 2: queue mining, show highlight
      entry.state = TAP_STATE.QUEUED;
      this._redrawOverlay();
      return 'queue';
    }

    if (entry.state === TAP_STATE.QUEUED) {
      // Tap 3: cancel
      this.tiles.delete(key);
      this._redrawOverlay();
      return 'cancel';
    }

    return 'ignore';
  }

  /**
   * Get tile entry for a given position.
   */
  getTileEntry(col, row) {
    return this.tiles.get(this._key(col, row)) || null;
  }

  /**
   * Check if a tile is queued for mining.
   */
  isQueued(col, row) {
    const entry = this.tiles.get(this._key(col, row));
    return entry && entry.state === TAP_STATE.QUEUED;
  }

  /**
   * Check if a tile is in walking state.
   */
  isWalking(col, row) {
    const entry = this.tiles.get(this._key(col, row));
    return entry && entry.state === TAP_STATE.WALKING;
  }

  /**
   * Assign a colonist to a tile entry.
   */
  assignColonist(col, row, colonist) {
    const entry = this.tiles.get(this._key(col, row));
    if (entry) entry.assignedColonist = colonist;
  }

  /**
   * Complete mining — remove tile entry.
   */
  completeMining(col, row) {
    this.tiles.delete(this._key(col, row));
    this._redrawOverlay();
  }

  /**
   * Cancel a tile job and clean up.
   */
  cancelTile(col, row) {
    this.tiles.delete(this._key(col, row));
    this._redrawOverlay();
  }

  /**
   * Show hover highlight on a specific tile (touch feedback).
   */
  showHover(col, row) {
    if (!this.hoverGfx) return;
    this.hoverGfx.clear();
    this.hoverGfx.fillStyle(0xffffff, 0.15);
    this.hoverGfx.fillRect(col * TILE, row * TILE, TILE, TILE);
  }

  /**
   * Clear hover highlight.
   */
  clearHover() {
    if (!this.hoverGfx) return;
    this.hoverGfx.clear();
  }

  // ── Visual: draw orange fill on queued tiles ────────────────
  _redrawOverlay() {
    if (!this.overlayGfx) return;
    this.overlayGfx.clear();

    for (const entry of this.tiles.values()) {
      if (entry.state === TAP_STATE.QUEUED) {
        // Orange/yellow tint overlay for queued tiles
        this.overlayGfx.fillStyle(0xffaa00, 0.35);
        this.overlayGfx.fillRect(
          entry.col * TILE,
          entry.row * TILE,
          TILE,
          TILE,
        );
        this.overlayGfx.lineStyle(2, 0xffdd00, 0.9);
        this.overlayGfx.strokeRect(
          entry.col * TILE,
          entry.row * TILE,
          TILE,
          TILE,
        );
      }
    }
  }
}
