// proxy.ts lets an emulator reach a server that selects its tenant by host
// name. The phone types http://localhost:PORT, adb reverse brings that port
// to the workstation, and this forwards each request to the upstream with the
// Host header the tenant is known by. It is a developer's tool for the device
// journeys and nothing else; it does not run in CI or on a phone.
//   tsx scripts/e2e/proxy.ts <listen port> <upstream url> <tenant host> [bind]
//   tsx scripts/e2e/proxy.ts 8081 http://127.0.0.1:8080 platformkit.localhost:8080
//
// It listens on loopback unless a bind address is given. Give one only to
// reach a real phone on a private network you control, and remember that what
// it forwards is plain HTTP.
import http from "node:http";
import https from "node:https";

const [port, upstream, host, bind = "127.0.0.1"] = process.argv.slice(2);
if (!port || !upstream || !host) {
  console.error("usage: proxy.ts <listen port> <upstream url> <tenant host> [bind address]");
  process.exit(2);
}
const target = new URL(upstream);
if (target.protocol !== "http:" && target.protocol !== "https:") {
  console.error(`proxy: ${target.protocol} is not a protocol this forwards`);
  process.exit(2);
}
// An https upstream is spoken to over TLS, on its own default port.
const send = target.protocol === "https:" ? https.request : http.request;

/**
 * rewritten moves a request onto the tenant's own host. The Host header is
 * what selects the tenant; Origin and Referer have to move with it, because a
 * server that refuses a cross-site sign-in compares them, and a browser that
 * typed this proxy's address sends that address. A native client sends
 * neither and is unaffected.
 *
 * This is a developer's tool on a network you control, pointed at a server
 * you are running. Rewriting Origin is exactly what a same-site rule exists
 * to prevent, which is why nothing here belongs anywhere near a deployment.
 */
const scheme = target.protocol.replace(":", "");
function rewritten(headers: http.IncomingHttpHeaders): http.IncomingHttpHeaders {
  const out: http.IncomingHttpHeaders = { ...headers, host };
  if (headers.origin) out.origin = `${scheme}://${host}`;
  if (headers.referer) {
    try {
      const at = new URL(headers.referer);
      out.referer = `${scheme}://${host}${at.pathname}${at.search}`;
    } catch {
      delete out.referer;
    }
  }
  return out;
}

const server = http.createServer((req, res) => {
  const out = send(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: req.url,
      method: req.method,
      headers: rewritten(req.headers),
    },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  out.on("error", (e) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`upstream: ${e.message}`);
  });
  req.pipe(out);
});

server.listen(Number(port), bind, () => {
  console.log(`proxy: ${bind}:${port} -> ${upstream} as ${host}`);
});
