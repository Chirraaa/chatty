const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add polyfills to the resolution
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'stream': require.resolve('readable-stream'),
  'buffer': require.resolve('buffer'),
};

module.exports = withNativeWind(config, { input: './global.css' });