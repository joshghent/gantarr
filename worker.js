// Cloudflare Worker entry. Wraps the TanStack Start server bundle and
// forces `Cache-Control: no-cache` on every HTML response so stale
// documents never linger in edge or browser caches. Static assets
// (hashed JS/CSS, images) still flow through Cloudflare's asset binding
// with their default long-lived caching — those are hash-keyed, so
// cache reuse is correct for them.

import server from "./dist/server/server.js";

const NO_CACHE = "no-cache, no-store, must-revalidate";

export default {
  async fetch(request, env, ctx) {
    const response = await server.fetch(request, env, ctx);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    const headers = new Headers(response.headers);
    headers.set("Cache-Control", NO_CACHE);
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
