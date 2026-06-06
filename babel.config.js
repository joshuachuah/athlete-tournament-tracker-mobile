module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: ["babel-plugin-react-compiler", "react-native-reanimated/plugin"],
  };
};
