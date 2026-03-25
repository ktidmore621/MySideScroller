// ============================================================
//  BootScene
//  Minimal boot / preload scene.  Shows a loading bar, loads
//  tile assets, then hands off to GameScene.
// ============================================================

import { TILE_FRAMES } from '../config.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.scale;

    // ── Loading bar UI ──────────────────────────────────────
    const barBg = this.add.rectangle(width / 2, height / 2, 300, 20, 0x333333);
    const bar   = this.add.rectangle(
      width / 2 - 150, height / 2, 0, 18, 0xcc4400
    ).setOrigin(0, 0.5);

    const label = this.add.text(width / 2, height / 2 - 30, 'CRAWLER CRAFT WORLD', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#cc4400',
    }).setOrigin(0.5);

    const sub = this.add.text(width / 2, height / 2 + 30, 'Initialising wasteland…', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#666666',
    }).setOrigin(0.5);

    this.load.on('progress', (v) => {
      bar.width = 298 * v;
    });

    // ── Load tile spritesheet (PNG with alpha) ──────────────
    this.load.image('tiles-dirt-grass', 'assets/tiles/dirt-grass.png');
  }

  create() {
    // ── Register tile frames on the loaded texture ──────────
    const tex = this.textures.get('tiles-dirt-grass');

    // Dirt variants
    TILE_FRAMES.dirt.forEach((f, i) => {
      tex.add(`dirt_${i}`, 0, f.x, f.y, f.w, f.h);
    });

    // Grass-top variants
    TILE_FRAMES.grassTop.forEach((f, i) => {
      tex.add(`grass_top_${i}`, 0, f.x, f.y, f.w, f.h);
    });

    // Corner tiles
    const ctl = TILE_FRAMES.grassCornerTL;
    tex.add('grass_corner_tl', 0, ctl.x, ctl.y, ctl.w, ctl.h);
    const ctr = TILE_FRAMES.grassCornerTR;
    tex.add('grass_corner_tr', 0, ctr.x, ctr.y, ctr.w, ctr.h);

    // Side edge tiles
    const gl = TILE_FRAMES.grassLeft;
    tex.add('grass_left', 0, gl.x, gl.y, gl.w, gl.h);
    const gr = TILE_FRAMES.grassRight;
    tex.add('grass_right', 0, gr.x, gr.y, gr.w, gr.h);

    this.scene.start('GameScene');
  }
}
