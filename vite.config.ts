import { defineConfig, type Plugin } from 'vite';

// The phone app (mobile/) opens the game from files on the device (file://).
// Browsers won't run module scripts from file://, so `vite build --mode app`
// makes one classic script and loads it with `defer` instead.
const classicScript = (): Plugin => ({
  name: 'fetch-dash-classic-script',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html.replace(/<script type="module" crossorigin/g, '<script defer'),
  },
});

// Relative base so the built game works from any page path,
// e.g. a Fetch Dash page on goodwookie.com.
export default defineConfig(({ mode }) => ({
  base: './',
  // Phaser itself is ~1.5 MB minified, and the game's code adds the rest;
  // that's expected for a game engine.
  build:
    mode === 'app'
      ? {
          chunkSizeWarningLimit: 1800,
          outDir: 'dist-app',
          modulePreload: false,
          rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
        }
      : { chunkSizeWarningLimit: 1800 },
  plugins: mode === 'app' ? [classicScript()] : [],
}));
