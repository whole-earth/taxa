// Standard release checks use a fresh build on an isolated local port.
// Expensive reference-image sweeps remain separate, explicit commands.
import { spawn } from "node:child_process";
import { context } from "esbuild";

function run(script, args = [], environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: "inherit",
      env: { ...process.env, ...environment },
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed (${signal || code})`));
    });
  });
}

await run("node_modules/prettier/bin/prettier.cjs", [
  "--check",
  "index.html",
  "style.css",
  "js",
  "scripts",
  "tests",
  "playwright.config.js",
]);
await run("scripts/build.mjs");
await run("scripts/check-models.mjs");
await run("scripts/preview-webflow.mjs");
const server = await context({ outdir: "dist" });
try {
  const { port } = await server.serve({
    servedir: "dist",
    host: "127.0.0.1",
    port: 0,
  });
  for (const browser of ["chromium", "webkit"]) {
    const environment = {
      PREVIEW_URL: `http://127.0.0.1:${port}`,
      BROWSER: browser,
    };
    await run(
      "node_modules/@playwright/test/cli.js",
      ["test", "--output", `test-results/playwright-${browser}`],
      environment,
    );
    await run("scripts/check-webflow.mjs", [], environment);
  }
} finally {
  await server.dispose();
}
console.log(
  "Verified build, asset integrity, Chrome/WebKit behavior and Webflow integration.",
);
