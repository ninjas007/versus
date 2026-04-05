import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 3000);

loadEnvFile(path.join(projectRoot, ".env"));
loadEnvFile(path.join(projectRoot, ".env.local"), true);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function loadEnvFile(filepath, override = false) {
  try {
    const raw = readFileSync(filepath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) return;

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (override || !(key in process.env)) {
        process.env[key] = value;
      }
    });
  } catch {
    return;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = String(req.headers["content-type"] || "");

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  return raw;
}

function buildQuery(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

async function serveStaticFile(res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const absolutePath = path.resolve(projectRoot, relativePath);

  if (!absolutePath.startsWith(projectRoot)) {
    return false;
  }

  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return false;
    }

    const extension = path.extname(absolutePath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    const content = await readFile(absolutePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

function apiFilePathFromUrl(pathname) {
  const relative = pathname.replace(/^\/api\//, "");
  const candidate = path.resolve(projectRoot, "api", `${relative}.js`);
  if (!candidate.startsWith(path.resolve(projectRoot, "api"))) {
    return null;
  }
  return candidate;
}

async function serveApiRoute(req, res, url) {
  const apiFilePath = apiFilePathFromUrl(url.pathname);
  if (!apiFilePath) {
    return false;
  }

  try {
    await stat(apiFilePath);
  } catch {
    return false;
  }

  const moduleUrl = `${pathToFileURL(apiFilePath).href}?t=${Date.now()}`;
  const routeModule = await import(moduleUrl);

  req.query = buildQuery(url.searchParams);
  req.body = await readBody(req);
  req.url = `${url.pathname}${url.search}`;
  req.headers.host = req.headers.host || `localhost:${port}`;
  req.headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "http";
  req.headers["x-forwarded-host"] = req.headers["x-forwarded-host"] || req.headers.host;

  await routeModule.default(req, res);
  return true;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    if (url.pathname.startsWith("/api/")) {
      const servedApi = await serveApiRoute(req, res, url);
      if (servedApi) return;
    }

    const servedStatic = await serveStaticFile(res, url.pathname);
    if (servedStatic) return;

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "NOT_FOUND", message: "Route tidak ditemukan." }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "DEV_SERVER_ERROR",
        message: error?.message || "Unknown server error"
      })
    );
  }
});

server.listen(port, () => {
  console.log(`Local dev server running at http://localhost:${port}`);
});
