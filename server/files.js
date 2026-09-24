import { statSync, createReadStream } from "node:fs";
import { extname } from "node:path";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
  ".csv": "text/csv; charset=utf-8", ".md": "text/markdown; charset=utf-8",
};
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m) return "invalid";
  const [, a, bb] = m;
  let start, end;
  if (a === "") {                       // bytes=-N — последние N байт
    if (bb === "") return "invalid";
    const n = Number(bb);
    if (!n) return "invalid";
    start = Math.max(0, size - n); end = size - 1;
  } else {
    start = Number(a);
    end = bb === "" ? size - 1 : Number(bb);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (start > end || start >= size) return "invalid";
  return { start, end: Math.min(end, size - 1) };
}

export function serveFile(res, path, req) {
  const type = MIME[extname(path).toLowerCase()] || "application/octet-stream";
  const st = statSync(path);
  const cache = "private, no-store";
  // Аудио запрашивается кусками — без этого iOS не проматывает записи
  const range = parseRange(req.headers.range, st.size);
  if (range === "invalid") {
    res.writeHead(416, { "content-range": `bytes */${st.size}`, "accept-ranges": "bytes" });
    return res.end();
  }
  const opts = range ? { start: range.start, end: range.end } : {};
  const head = range
    ? { "content-type": type, "content-length": range.end - range.start + 1, "content-range": `bytes ${range.start}-${range.end}/${st.size}`, "accept-ranges": "bytes", "cache-control": cache }
    : { "content-type": type, "content-length": st.size, "accept-ranges": "bytes", "cache-control": cache };
  res.writeHead(range ? 206 : 200, head);
  const stream = createReadStream(path, opts);
  stream.on("error", () => res.destroy());   // заголовки уже ушли — только рвём соединение
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

