// ============================================================
//  JobSystem — Stub
//
//  Receives "mine" orders from the player (tap on a tile),
//  queues them, and hands them out to idle colonists.
//
//  Phase-1 scope:
//    • Single job type: MINE
//    • FIFO queue
//    • One colonist can claim one job at a time
//
//  Extend later:
//    • Priority queues, job types (build, haul, farm…)
//    • Multi-colonist assignment
//    • Job cancellation
// ============================================================

export const JOB_TYPE = {
  MINE: 'MINE',
};

export default class JobSystem {
  constructor() {
    /** @type {Array<{col:number, row:number, type:string}>} */
    this.queue = [];

    // Highlight graphics layer — rendered in GameScene
    /** @type {Phaser.GameObjects.Graphics|null} */
    this.overlayGfx = null;
  }

  // Call this from GameScene.create() after adding graphics
  setOverlay(gfx) {
    this.overlayGfx = gfx;
  }

  // ── Enqueue a new mine order ──────────────────────────────
  /**
   * @param {number} col
   * @param {number} row
   */
  addMineJob(col, row) {
    // Avoid duplicate orders for the same tile
    const exists = this.queue.some(j => j.col === col && j.row === row);
    if (!exists) {
      this.queue.push({ col, row, type: JOB_TYPE.MINE });
      this._redrawOverlay();
    }
  }

  // ── Colonist polls this to grab the next available job ────
  /** @returns {{col:number, row:number, type:string}|null} */
  claimJob() {
    if (this.queue.length === 0) return null;
    const job = this.queue.shift();
    this._redrawOverlay();
    return job;
  }

  // ── Remove a specific job (e.g. tile already destroyed) ───
  cancelJob(col, row) {
    this.queue = this.queue.filter(j => !(j.col === col && j.row === row));
    this._redrawOverlay();
  }

  // ── Visual: draw yellow outlines on queued tiles ──────────
  _redrawOverlay() {
    if (!this.overlayGfx) return;
    const TILE = 16; // avoid circular import; mirror config value
    this.overlayGfx.clear();
    this.overlayGfx.lineStyle(2, 0xffdd00, 0.8);
    for (const job of this.queue) {
      this.overlayGfx.strokeRect(
        job.col * TILE,
        job.row * TILE,
        TILE,
        TILE,
      );
    }
  }
}
