// Capture production markup/styles for local integration review. Never publish
// this generated preview: it includes Webflow's existing forms and scripts.
import { mkdir, writeFile } from "node:fs/promises";

const response = await fetch("https://www.taxatech.com/");
if (!response.ok)
  throw new Error(`Webflow snapshot failed: ${response.status}`);
const source = await response.text();
const original =
  /<script\b[^>]*src="https:\/\/whole-earth\.github\.io\/taxa\/js\/core\/anim\.js"[^>]*><\/script>/;
if (!original.test(source))
  throw new Error(
    "Production animation embed changed; review it before generating a preview.",
  );
await mkdir("test-results/webflow", { recursive: true });
await writeFile("test-results/webflow/production.html", source);
let preview = source.replace(
  original,
  '<script type="module" src="./js/core/anim.js"></script>',
);
preview = preview.replace(
  /<script\b[^>]*src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*><\/script>/g,
  "",
);
preview = preview.replace(
  "<head>",
  `<head>
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="form-action 'none'">
<script>
// Local review only: prevent real submissions before Webflow handles forms.
document.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
</script>`,
);
await writeFile("dist/webflow.html", preview);
console.log(
  "Webflow preview: /webflow.html?perf (local review only; submissions disabled)",
);
