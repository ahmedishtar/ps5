#!/usr/bin/env node
/* Standalone host for the whole site, including the api/payload/<name> endpoint.
 *
 *     node api/serve.js [port]        (run it from the site root; default port 8080)
 *
 * Why this exists: the ELF tile menu cannot deliver a payload from the browser -
 * JavaScript has no raw sockets, and an HTTP POST straight to port 9021 would
 * prepend HTTP headers so elfldr would not see \x7fELF at offset 0. The page asks
 * the server to make the TCP connection instead.
 *
 * By default the console address is the socket's remote address. Set PS5_HOST when
 * running behind Docker, a reverse proxy, NAT, or a VPN where that address is not
 * directly reachable from this process.
 *
 * Static files are served relative to the directory you run this from, so hosting
 * under a subdirectory works the same way as at a root.
 */
"use strict";
const http = require("http"), net = require("net"), fs = require("fs"), path = require("path");
const ROOT = process.cwd();
const LISTEN_HOST = process.env.HOST || "0.0.0.0";

function parsePort(value, fallback, name) {
    const port = Number.parseInt(value || String(fallback), 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error(`${name} must be an integer between 1 and 65535`);
    return port;
}

const PORT = parsePort(process.argv[2] || process.env.PORT, 8080, "PORT");
const ELFLDR_PORT = parsePort(process.env.ELFLDR_PORT, 9021, "ELFLDR_PORT");
const PS5_HOST = (process.env.PS5_HOST || "").trim();
const MIME = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript",
    ".css": "text/css", ".png": "image/png", ".gif": "image/gif",
    ".jpg": "image/jpeg", ".json": "application/json",
    ".elf": "application/octet-stream", ".bin": "application/octet-stream",
    ".txt": "text/plain; charset=utf-8"
};

function sendPayload(name, ip, cb) {
    if (!/^[A-Za-z0-9._-]+\.(elf|bin)$/.test(name)) return cb(new Error("bad payload name"));
    const file = path.join(ROOT, "payloads", name);
    if (!file.startsWith(path.join(ROOT, "payloads") + path.sep)) return cb(new Error("bad payload path"));
    fs.readFile(file, (err, buf) => {
        if (err) return cb(new Error("payload not found: " + name));
        const sock = net.connect(ELFLDR_PORT, ip);
        let done = false;
        const finish = (e) => { if (!done) { done = true; sock.destroy(); cb(e, buf.length); } };
        sock.setTimeout(15000, () => finish(new Error("timeout talking to " + ip)));
        sock.on("error", (e) => finish(new Error("connect " + ip + ":" + ELFLDR_PORT + " - " + e.message)));
        sock.on("connect", () => sock.end(buf, () => finish(null)));
    });
}

const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
    catch (_) { res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("bad request"); }
    if (p === "/healthz") {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        return res.end(JSON.stringify({ ok: true }));
    }
    const m = p.match(/\/api\/payload\/([^/]+)$/);
    if (m) {
        let ip = req.socket.remoteAddress || "";
        if (ip.startsWith("::ffff:")) ip = ip.slice(7);
        if (PS5_HOST) ip = PS5_HOST;
        if (!ip) { res.writeHead(502, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: false, error: "console address unavailable" })); }
        sendPayload(m[1], ip, (err, bytes) => {
            res.writeHead(err ? 502 : 200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(err ? { ok: false, error: err.message } : { ok: true, bytes, name: m[1], to: ip + ":" + ELFLDR_PORT }));
            console.log(`[payload] ${m[1]} -> ${ip}  ${err ? "FAILED: " + err.message : bytes + " bytes"}`);
        });
        return;
    }
    if (p.indexOf("/log/") >= 0) { res.writeHead(204); return res.end(); }
    let file = path.resolve(ROOT, "." + p);
    if (p.endsWith("/")) file = path.join(file, "index.html");
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("forbidden"); }
    fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); console.log("[404] " + p); return res.end("not found"); }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
        res.end(buf);
    });
});

server.listen(PORT, LISTEN_HOST, () => {
    console.log(`serving ${ROOT} on http://${LISTEN_HOST}:${PORT}`);
    console.log(PS5_HOST ? `api/payload/<name> will connect to configured console ${PS5_HOST}:${ELFLDR_PORT}` : `api/payload/<name> will connect to the requesting address on :${ELFLDR_PORT}`);
});
