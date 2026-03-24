/**
 * Tool tracking route
 */

import { Hono } from "hono";
import type { Bindings } from "../interfaces";
import { trackToolCall } from "../services";

const trackRoutes = new Hono<{ Bindings: Bindings }>();

interface TrackRequest {
  tool: string;
  success: boolean;
  durationMs?: number;
  version?: string;
}

// Track a tool call
trackRoutes.post("/tool", async (c) => {
  try {
    const body = await c.req.json<TrackRequest>();

    const tool = typeof body.tool === "string" ? body.tool.trim().slice(0, 100) : "";
    if (!tool) {
      return c.json({ error: "tool name is required" }, 400);
    }

    const version = typeof body.version === "string" ? body.version.trim().slice(0, 50) : undefined;
    const durationMs =
      typeof body.durationMs === "number" && body.durationMs >= 0 && body.durationMs <= 600_000
        ? Math.round(body.durationMs)
        : undefined;

    c.executionCtx.waitUntil(
      trackToolCall(c.env.DB, tool, body.success !== false, durationMs, version),
    );

    return c.json({ tracked: true });
  } catch (error) {
    console.error("Track error:", error);
    return c.json({ error: "Track failed" }, 500);
  }
});

export default trackRoutes;
