// All diagnostics use PREVIEW_URL, then PORT, then the development default.
export const previewBase =
  process.env.PREVIEW_URL || `http://127.0.0.1:${process.env.PORT || 4173}`;

export function previewUrl() {
  const url = new URL(previewBase);
  url.searchParams.set("perf", "");
  return url.href;
}
