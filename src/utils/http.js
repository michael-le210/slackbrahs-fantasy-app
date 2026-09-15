import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

const noCacheHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

export function sendJson(res, body, status = 200) {
  const responseStatus = body?.error && status === 200 ? 500 : status;
  res.writeHead(responseStatus, { "Content-Type": "application/json; charset=utf-8", ...noCacheHeaders });
  res.end(JSON.stringify(body));
}

export function sendHtml(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...noCacheHeaders });
  res.end(body);
}

export function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...noCacheHeaders, ...headers });
  res.end();
}

export async function sendFile(res, filePath) {
  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      ...noCacheHeaders
    });
    res.end(content);
  } catch {
    sendHtml(res, "Not found", 404);
  }
}

export async function serveStatic(res, publicDir, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return sendHtml(res, "Bad request", 400);
  }

  const filePath = resolve(publicDir, decodedPath.replace(/^[/\\]+/, ""));
  const relativePath = relative(publicDir, filePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return sendHtml(res, "Not found", 404);
  }
  return sendFile(res, filePath);
}
