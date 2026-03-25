// ============================================================
//  BootScene
//  Minimal boot / preload scene.  Shows a loading bar, loads
//  tile assets, then hands off to GameScene.
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

    // ── Load tile images (single images, no spritesheet) ─────
    this.load.image('tiles-dirt-grass', 'assets/tiles/dirt-grass.png');
    this.load.image('tiles-building', 'assets/tiles/building-walls.png');
  }

  create() {
    // No frame registration — WorldRenderer handles source
    // rectangles directly via canvas drawImage.
    this.scene.start('GameScene');
  }
}
