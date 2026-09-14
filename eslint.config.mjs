// The lint is Expo's, plus the one rule this repository adds: the layers
// import in one direction. Core knows nothing of React; effects know nothing
// of the UI; the UI is props in and elements out and never reaches for the
// shell or a transport; routes compose and render nothing of their own, and
// the dispatcher they share (src/route.tsx) composes screens without an
// effect of its own.
import expo from "eslint-config-expo/flat.js";
import { builtinModules } from "node:module";

// forbid is the no-restricted-imports entry for one layer: the patterns it
// may not import, each with the sentence a reader needs.
const forbid = (files, patterns) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns: [
      { group: [...builtinModules, "node:*", "**/scripts/**", "platformkit-mobile/tools/**"], message: "build tools run in Node; native runtime code consumes their generated source." },
      ...patterns,
    ] }],
    // no-restricted-imports does not see import(); this does.
    "no-restricted-syntax": [
      "error",
      { selector: "ImportExpression", message: "Import statically; the layer rule reads imports." },
    ],
  },
});

const react = ["react", "react-native", "react-native/*", "expo", "expo/*", "expo-*", "@expo/*"];
// Effects may use the secure store and nothing else of Expo: the bare package,
// its subpaths, every expo-* module and the @expo scope are one list, so a
// bare `import from "expo"` is refused like the rest.
const expoButSecureStore = ["expo", "expo/*", "expo-*", "!expo-secure-store", "@expo/*"];
const uiBoundary = [{
  group: [
    "**/effects/**",
    "**/screens/**",
    "**/shell",
    "**/shell.tsx",
    "**/renderers",
    "expo-router",
    "expo-secure-store",
    "expo-haptics",
  ],
  message: "the UI is props in and elements out; effects arrive as callbacks from src/screens.",
}];

// A layer-specific rule replaces no-restricted-imports in flat config, so it
// must retain the UI effect boundary. Templates here are layout primitives:
// they accept children or render callbacks; organisms compose them with rows.
const uiLayer = (files, above) => forbid(files, [
  ...uiBoundary,
  {
    group: [
      ...above.flatMap((layer) => [`**/${layer}`, `**/${layer}/**`]),
      "**/gallery", "**/gallery.*", "**/gallery/**",
    ],
    message: "compose this UI layer from its primitives; organisms and the gallery belong above it.",
  },
]);

export default [
  ...expo,
  { ignores: ["node_modules/", ".expo/", "dist/", "android/", "ios/", "e2e/out/"] },
  forbid(["src/**", "app/**"], []),
  forbid(["src/core/**"], [
    { group: [...react, "**/effects/**", "**/ui/**", "**/shell", "**/shell.tsx", "**/screens/**"], message: "core is plain functions; it imports nothing outside src/core." },
  ]),
  forbid(["src/effects/**"], [
    { group: ["react", "react-native", "react-native/*", "**/ui/**", "**/shell", "**/shell.tsx", "**/screens/**"], message: "effects know the network and the store, not React or the UI." },
    { group: expoButSecureStore, message: "effects may use the secure store and nothing else of Expo." },
  ]),
  forbid(["src/ui/**"], uiBoundary),
  uiLayer(["src/ui/atoms/**"], ["molecules", "templates", "organisms"]),
  uiLayer(["src/ui/molecules/**"], ["templates", "organisms"]),
  uiLayer(["src/ui/templates/**"], ["organisms"]),
  uiLayer(["src/ui/organisms/**"], []),
  {
    ...uiLayer(["src/ui/*.{ts,tsx}"], ["atoms", "molecules", "templates", "organisms"]),
    ignores: ["src/ui/gallery.tsx"],
  },
  forbid(["app/**"], [
    { group: ["**/effects/**", "**/core/**"], message: "a route composes a screen; it holds no rule and no effect." },
    { group: ["**/ui/**", "!**/ui/theme", "!**/ui/gallery"], message: "a route composes a screen; the theme provider and the gallery are the composition root's two exceptions." },
  ]),
  // src/route.tsx is the dispatcher every resource route delegates to: it
  // finds the entry, keys the renderer pack and names the sheets from the
  // catalog, so it reads core by design where an app route may not. What it
  // shares with a route is that it performs no effect: everything it needs
  // arrives through useShell, and an effect becomes a prop in src/screens.
  forbid(["src/route.tsx"], [
    { group: ["**/effects/**"], message: "the route dispatcher composes screens and names them from the catalog; an effect becomes a prop in src/screens." },
  ]),
  // Transport is an effect. src/effects/api.ts is the one module that names
  // the platform's fetch, as the default it composes an Api around, so the
  // shell, the screens and the routes speak to a server only through an Api
  // and can be handed a fake one. The shell used to name fetch once, to pass
  // it beside a restored cookie; that was the default repeated, not a
  // decision, and a second place to change when the transport does (a
  // deadline, a proxy, a test). This makes the single place permanent;
  // XMLHttpRequest and WebSocket are the other two doors to the network.
  {
    files: ["src/**", "app/**"],
    ignores: ["src/effects/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["fetch", "XMLHttpRequest", "WebSocket"].map((name) => ({
          name,
          message: "the transport is named once, in src/effects/api.ts; compose an Api and pass it on.",
        })),
      ],
    },
  },
];
