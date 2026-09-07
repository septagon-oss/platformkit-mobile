// The lint is Expo's, plus the one rule this repository adds: the layers
// import in one direction. Core knows nothing of React; effects know nothing
// of the UI; the UI is props in and elements out and never reaches for the
// shell or a transport; routes compose and render nothing of their own.
import expo from "eslint-config-expo/flat.js";

// forbid is the no-restricted-imports entry for one layer: the patterns it
// may not import, each with the sentence a reader needs.
const forbid = (files, patterns) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns }],
    // no-restricted-imports does not see import(); this does.
    "no-restricted-syntax": [
      "error",
      { selector: "ImportExpression", message: "Import statically; the layer rule reads imports." },
    ],
  },
});

const react = ["react", "react-native", "react-native/*", "expo", "expo-*", "@expo/*"];

export default [
  ...expo,
  { ignores: ["node_modules/", ".expo/", "dist/", "android/", "ios/", "e2e/out/"] },
  forbid(["src/core/**"], [
    { group: [...react, "**/effects/*", "**/ui/**", "**/shell", "**/screens/*"], message: "core is plain functions; it imports nothing outside src/core." },
  ]),
  forbid(["src/effects/**"], [
    { group: [...react.filter((p) => p !== "expo-*" && p !== "expo"), "**/ui/**", "**/shell", "**/screens/*"], message: "effects know the network and the store, not React or the UI." },
    { group: ["expo-*", "!expo-secure-store"], message: "effects may use the secure store and nothing else of Expo." },
  ]),
  forbid(["src/ui/**"], [
    { group: ["**/effects/*", "**/shell", "expo-router", "expo-secure-store"], message: "the UI is props in and elements out; effects arrive as callbacks from src/screens." },
  ]),
  forbid(["app/**"], [
    { group: ["**/effects/*", "**/core/*"], message: "a route composes a screen; it holds no rule and no effect." },
    { group: ["**/ui/**", "!**/ui/theme", "!**/ui/gallery"], message: "a route composes a screen; the theme provider and the gallery are the composition root's two exceptions." },
  ]),
];
