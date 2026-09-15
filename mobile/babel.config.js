/**
 * babel-preset-expo already wires Reanimated 4 (via react-native-worklets) and
 * expo-router, so there is nothing to add. The file exists because a project
 * without one falls back to Babel's own resolution, which finds no preset.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
