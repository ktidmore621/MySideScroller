// ============================================================
//  Crawler Craft World — Entry Point
//  Boots Phaser and registers all scenes.
// ============================================================

import { TILE, WORLD_W, WORLD_H } from './config.js';
import BootScene  from './scenes/BootScene.js';
import GameScene  from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width:  window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0a12',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }, // we apply gravity manually per entity
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
  // Pixel-perfect rendering for tile art
  render: {
    pixelArt: true,
    antialias: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    orientation: Phaser.Scale.LANDSCAPE,
  },
  input: {
    activePointers: 2, // support two-finger gestures
  },
};

const game = new Phaser.Game(config);

// Hot-resize support (browser / dev tools)
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
