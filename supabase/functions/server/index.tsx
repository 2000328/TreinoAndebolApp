import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

app.get("/make-server-8a2c2059/health", (c) => c.json({ status: "ok" }));

// Sessions
app.get("/make-server-8a2c2059/sessions", async (c) => {
  const data = await kv.get("sessions");
  return c.json(data ?? null);
});
app.put("/make-server-8a2c2059/sessions", async (c) => {
  const body = await c.req.json();
  await kv.set("sessions", body);
  return c.json({ ok: true });
});

// Players
app.get("/make-server-8a2c2059/players", async (c) => {
  const data = await kv.get("players");
  return c.json(data ?? null);
});
app.put("/make-server-8a2c2059/players", async (c) => {
  const body = await c.req.json();
  await kv.set("players", body);
  return c.json({ ok: true });
});

// Attendance
app.get("/make-server-8a2c2059/attendance", async (c) => {
  const data = await kv.get("attendance");
  return c.json(data ?? null);
});
app.put("/make-server-8a2c2059/attendance", async (c) => {
  const body = await c.req.json();
  await kv.set("attendance", body);
  return c.json({ ok: true });
});

// Games
app.get("/make-server-8a2c2059/games", async (c) => {
  const data = await kv.get("games");
  return c.json(data ?? null);
});
app.put("/make-server-8a2c2059/games", async (c) => {
  const body = await c.req.json();
  await kv.set("games", body);
  return c.json({ ok: true });
});

Deno.serve(app.fetch);
