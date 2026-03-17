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

    if (!body.tool || typeof body.tool !== "string") {
      return c.json({ error: "tool name is required" }, 400);
    }

    c.executionCtx.waitUntil(
      trackToolCall(
        c.env.DB,
        body.tool,
        body.success !== false,
        body.durationMs,
        body.version,
      ),
    );

    return c.json({ tracked: true });
  } catch (error) {
    console.error("Track error:", error);
    return c.json({ error: "Track failed" }, 500);
  }
});

export default trackRoutes;
