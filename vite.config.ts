import { defineConfig } from 'vite';

// Relative base so the built game works from any page path,
// e.g. a Fetch Dash page on goodwookie.com.
export default defineConfig({
  base: './',
  // Phaser itself is ~1.5 MB minified, and the game's code adds the rest;
  // that's expected for a game engine.
  build: { chunkSizeWarningLimit: 1800 },
});
