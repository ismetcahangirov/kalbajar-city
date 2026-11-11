// HTTPS and HTTP/2 in front of the production server, as the site is served
// in production (Cloudflare terminates TLS and speaks HTTP/2 or HTTP/3 to
// the browser), for the Lighthouse job in ci.yml.
//
// Lighthouse's mobile score is simulated (Lantern), and the simulation takes
// the protocol from the measured run. Over plain HTTP/1.1, as `pnpm start`
// serves, it models six TCP connections per origin, each with its own slow
// start and a round trip per request; over HTTP/2 it models one warm,
// multiplexed connection. The same build simulates home's mobile LCP at
// about 3.0 s over HTTP/1.1 and about 2.4 s over HTTP/2 (#30). Only the
// second is what a phone gets from the live site.
//
// The proxy only forwards: bodies, headers and compression (the server's
// gzip; Cloudflare would send brotli, which is smaller) are passed through
// unchanged, so nothing is measured that the server did not send.
//
// usage: node tests/lighthouse/h2-proxy.mjs <key.pem> <cert.pem> <listen port> <upstream port>
import http from "node:http";
import http2 from "node:http2";
import { readFileSync } from "node:fs";

const [keyFile, certFile, listenPort = "3443", upstreamPort = "3011"] = process.argv.slice(2);
if (!keyFile || !certFile) {
  console.error("usage: h2-proxy.mjs <key.pem> <cert.pem> [listen port] [upstream port]");
  process.exit(1);
}

/** Connection-specific headers, which HTTP/2 forbids. */
const hopByHop = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "http2-settings",
]);

const server = http2.createSecureServer({
  key: readFileSync(keyFile),
  cert: readFileSync(certFile),
});

server.on("stream", (stream, headers) => {
  const forwarded = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!name.startsWith(":") && !hopByHop.has(name)) forwarded[name] = value;
  }
  forwarded.host = headers[":authority"] ?? `localhost:${listenPort}`;

  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: Number(upstreamPort),
      method: headers[":method"],
      path: headers[":path"],
      headers: forwarded,
    },
    (response) => {
      // The browser may have cancelled the request (the hero film, a prefetch).
      if (stream.destroyed || stream.closed) return response.resume();
      const head = { ":status": response.statusCode ?? 502 };
      for (const [name, value] of Object.entries(response.headers)) {
        if (!hopByHop.has(name)) head[name] = value;
      }
      stream.respond(head);
      response.pipe(stream);
    },
  );
  upstream.on("error", () => {
    if (!stream.destroyed && !stream.headersSent) stream.respond({ ":status": 502 });
    if (!stream.destroyed) stream.end();
  });
  stream.on("close", () => upstream.destroy());
  stream.on("error", () => upstream.destroy());
  stream.pipe(upstream);
});

server.on("sessionError", () => {});
server.listen(Number(listenPort), () => {
  console.log(`https://localhost:${listenPort} -> http://localhost:${upstreamPort}`);
});
