// Prepared assets ship as matching raw/gzip pairs. Keep native decompression
// and the compatibility download path identical for models and reflections.
export async function loadBinary(url, signal) {
  const compressed = typeof DecompressionStream === "function";
  const response = await fetch(compressed ? `${url}.gz` : url, { signal });
  if (!response.ok)
    throw new Error(`Asset request failed (${response.status}): ${url}`);
  const body = compressed
    ? new Response(response.body.pipeThrough(new DecompressionStream("gzip")))
    : response;
  return body.arrayBuffer();
}
