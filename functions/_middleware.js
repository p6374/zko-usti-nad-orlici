// Cloudflare Pages: attach the CMS renderer without rewriting the large index.html.
export async function onRequest(context) {
  if (context.request.method !== "GET") return context.next();
  const pathname = new URL(context.request.url).pathname;
  if (pathname !== "/" && pathname !== "/index.html") return context.next();
  const response = await context.next();
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return response;
  return new HTMLRewriter().on("head", {
    element(head) {
      head.append('<script defer src="/cms-runtime.js"></script>', {html:true});
    }
  }).transform(response);
}
