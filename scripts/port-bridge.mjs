import http from "node:http";
import net from "node:net";

const listenPort = Number(process.argv[2] || 3001);
const targetPort = Number(process.argv[3] || 43101);
const targetHost = process.argv[4] || "127.0.0.1";

function writeRawHeaders(req) {
  let head = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        head += `${name}: ${entry}\r\n`;
      }
      continue;
    }

    if (value !== undefined) {
      head += `${name}: ${value}\r\n`;
    }
  }

  return `${head}\r\n`;
}

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      host: targetHost,
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }
    res.end("Bridge upstream unavailable");
  });

  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const upstreamSocket = net.connect(targetPort, targetHost, () => {
    upstreamSocket.write(writeRawHeaders(req));
    if (head.length) {
      upstreamSocket.write(head);
    }

    socket.pipe(upstreamSocket).pipe(socket);
  });

  upstreamSocket.on("error", () => socket.destroy());
  socket.on("error", () => upstreamSocket.destroy());
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(
    `[port-bridge] listening on 127.0.0.1:${listenPort} -> ${targetHost}:${targetPort}`,
  );
});
