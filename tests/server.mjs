import http from "node:http";
import net from "node:net";
import { readFile } from "node:fs/promises";
export async function fixtureServer() {
  const calls = [],
    modelCalls = [];
  let delay = 80;
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith("/v1/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      calls.push({ path: req.url, body: body.toString() });
      const proxy = http.request(
        {
          hostname: "127.0.0.1",
          port: 8787,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: "127.0.0.1:8787" },
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      proxy.on("error", () => {
        res.writeHead(503);
        res.end("{}");
      });
      proxy.end(body);
      return;
    }
    if (req.url === "/api/chat") {
      let body = "";
      for await (const c of req) body += c;
      const data = JSON.parse(body);
      modelCalls.push(data);
      const input = JSON.parse(data.messages[1].content);
      const results = input.posts.map((p) => ({
        id: p.id,
        categories: p.text.includes("Reply YES")
          ? ["engagement_farming"]
          : p.text.includes("Everything is doomed")
            ? ["doomering"]
            : [],
        confidence:
          p.text.includes("Reply YES") ||
          p.text.includes("Everything is doomed")
            ? "high"
            : "clear",
        relevant:
          p.text.includes("soil moisture") || p.text.includes("design review"),
        needsContext: p.contextIncomplete,
      }));
      await new Promise((r) => setTimeout(r, delay));
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({ message: { content: JSON.stringify({ results }) } }),
      );
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(await readFile(new URL("./fixture.html", import.meta.url)));
  });
  server.on("upgrade", (req, socket, head) => {
    const upstream = net.connect(8787, "127.0.0.1", () => {
      upstream.write(
        `${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n")}\r\n\r\n`,
      );
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    socket.on("close", () => upstream.destroy());
    upstream.on("close", () => socket.destroy());
  });
  await new Promise((r) => server.listen(4173, "127.0.0.1", r));
  return { server, calls, modelCalls, setDelay: (v) => (delay = v) };
}
