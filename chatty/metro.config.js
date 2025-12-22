const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force all modules to use the same polyfilled instances
const nodeModulesPath = path.resolve(__dirname, 'node_modules');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'buffer': path.resolve(nodeModulesPath, 'buffer'),
  'stream': path.resolve(nodeModulesPath, 'readable-stream'),
  'process': path.resolve(nodeModulesPath, 'process'),
};

// Ensure we resolve to our polyfills first
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = withNativeWind(config, { input: './global.css' });