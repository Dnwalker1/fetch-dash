// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The web game's files (see scripts/bundle-game.mjs) ship as plain assets.
config.resolver.assetExts.push('gamefile');

module.exports = config;
