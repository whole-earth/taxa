// Keep preview and release bundles on the same compiler settings.
export const bundleOptions = {
  bundle: true,
  format: "esm",
  target: ["es2022"],
  minify: true,
  alias: { tween: "@tweenjs/tween.js" },
  external: ["*.woff2"],
  assetNames: "assets/[name]-[hash]",
  entryNames: "[dir]/[name]",
  metafile: true,
};
