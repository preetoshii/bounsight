const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add WASM support for CanvasKit
config.resolver.assetExts.push('wasm');

module.exports = config;
