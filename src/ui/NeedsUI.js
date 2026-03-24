// ============================================================
//  NeedsUI — Fixed HUD bars for colonist needs
//
//  Hunger bar (red-orange) and Rest bar (blue).
//  Drawn in screen-space (setScrollFactor(0)) so they stay
//  fixed while the camera scrolls the world.
// ============================================================

const BAR_W   = 100;
const BAR_H   = 10;
const PADDING = 12;
const ICON_W  = 14;

export default class NeedsUI {
  /**
   * @param {Phaser.Scene} scene
   * @param {Colonist[]} colonists  — array so we can show multiple later
   */
  constructor(scene, colonists) {
    this.scene     = scene;
    this.colonists = colonists;

    // Root container fixed to top-left
    this.container = scene.add.container(PADDING, PADDING);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);

    // Background panel
    this.panel = scene.add.rectangle(
      0, 0,
      BAR_W + ICON_W + PADDING * 2 + 8,
      70,
      0x000000, 0.6
    ).setOrigin(0, 0);
    this.container.add(this.panel);

    // Title
    this.title = scene.add.text(PADDING, 6, 'SURVIVOR #001', {
      fontFamily: 'monospace',
      fontSize:   '9px',
      color:      '#cc4400',
    });
    this.container.add(this.title);

    // ── Hunger bar ───────────────────────────────────────────
    this._hungerLabel = this._makeLabel(PADDING, 24, 'FOOD');
    this._hungerBg    = this._makeBarBg(PADDING + ICON_W + 2, 24);
    this._hungerFill  = this._makeBarFill(PADDING + ICON_W + 2, 24, 0xcc3300);

    // ── Rest bar ─────────────────────────────────────────────
    this._restLabel   = this._makeLabel(PADDING, 42, 'REST');
    this._restBg      = this._makeBarBg(PADDING + ICON_W + 2, 42);
    this._restFill    = this._makeBarFill(PADDING + ICON_W + 2, 42, 0x2266cc);

    this.container.add([
      this._hungerLabel, this._hungerBg, this._hungerFill,
      this._restLabel,   this._restBg,   this._restFill,
    ]);

    // Status text (STATE label)
    this._statusText = scene.add.text(PADDING, 56, '', {
      fontFamily: 'monospace',
      fontSize:   '8px',
      color:      '#888888',
    });
    this.container.add(this._statusText);
  }

  _makeLabel(x, y, text) {
    return this.scene.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize:   '8px',
      color:      '#aaaaaa',
    });
  }

  _makeBarBg(x, y) {
    return this.scene.add.rectangle(x, y, BAR_W, BAR_H, 0x333333).setOrigin(0, 0);
  }

  _makeBarFill(x, y, color) {
    return this.scene.add.rectangle(x, y, BAR_W, BAR_H, color).setOrigin(0, 0);
  }

  update() {
    if (!this.colonists.length) return;
    const c = this.colonists[0];

    // Scale bar widths
    this._hungerFill.width = (c.hunger / 100) * BAR_W;
    this._restFill.width   = (c.rest   / 100) * BAR_W;

    // Color flash when critical
    this._hungerFill.fillColor = c.hunger < 20 ? 0xff0000 : 0xcc3300;
    this._restFill.fillColor   = c.rest   < 20 ? 0x0099ff : 0x2266cc;

    this._statusText.setText(`[${c.state}]`);
  }

  destroy() {
    this.container.destroy();
  }
}
