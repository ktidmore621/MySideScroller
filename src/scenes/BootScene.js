// ============================================================
//  BootScene
//  Minimal boot / preload scene.  Shows a loading bar, then
//  hands off to GameScene.  No real assets to load yet —
//  everything is drawn with Graphics primitives — but the
//  scene is here so adding real assets later is a one-liner.
// ============================================================

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

    // No real assets — but we could add spritesheets here later:
    // this.load.spritesheet('colonist', 'assets/colonist.png', { ... });
  }

  create() {
    this.scene.start('GameScene');
  }
}
