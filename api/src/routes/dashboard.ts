/**
 * Dashboard route.
 * Protected by GitHub OAuth — user must be a member of an allowed org.
 */

import { Hono } from "hono";
import type { Bindings, AuthUser, AuthState } from "../interfaces";
import { getMetrics } from "../services";
import { generateDashboardHtml } from "../templates/dashboard";
import { generateToken } from "../services/oauth";

const dashboardRoute = new Hono<{ Bindings: Bindings }>();

// Dashboard auth middleware
dashboardRoute.use("*", async (c, next) => {
  const allowedOrgs = c.env.DASHBOARD_ALLOWED_ORGS;
  if (!allowedOrgs) {
    return c.text(
      "Dashboard access not configured. Set DASHBOARD_ALLOWED_ORGS environment variable.",
      403,
    );
  }

  const authState = c.get("authState") as AuthState;

  if (!authState.user) {
    // Not authenticated — redirect to OAuth flow
    // Create a temporary client registration for the dashboard
    const baseUrl = new URL(c.req.url).origin;
    const redirectUri = `${baseUrl}/dashboard`;

    // Ensure dashboard client registration exists
    const clientId = "dashboard-internal";
    const existingClient = await c.env.METRICS.get(`client:${clientId}`);
    if (!existingClient) {
      await c.env.METRICS.put(
        `client:${clientId}`,
        JSON.stringify({
          clientName: "Midnight Dashboard",
          redirectUris: [redirectUri],
        }),
        { expirationTtl: 365 * 24 * 60 * 60 }, // 1 year
      );
    }

    // Generate a PKCE code_challenge (required by /oauth/authorize).
    // The dashboard consumes auth codes directly from KV (Cloudflare self-fetch
    // limitation), so the verifier is intentionally discarded — the stored
    // challenge prevents the code from being exchanged via /oauth/token.
    const codeVerifier = generateToken();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const authorizeUrl = new URL(`${baseUrl}/oauth/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    return c.redirect(authorizeUrl.toString());
  }

  // Check org membership
  const allowedOrgList = allowedOrgs.split(",").map((o) => o.trim().toLowerCase());
  const userOrgs = authState.user.orgs.map((o) => o.toLowerCase());
  const hasAccess = allowedOrgList.some((org) => userOrgs.includes(org));

  if (!hasAccess) {
    return c.text(
      `Access denied. You must be a member of one of these organizations: ${allowedOrgs}`,
      403,
    );
  }

  return next();
});

// Handle OAuth callback code exchange for dashboard.
// NOTE: Cannot use fetch() to call our own Worker (Cloudflare self-fetch limitation).
// Instead, exchange the authorization code directly via KV lookup.
dashboardRoute.get("/", async (c) => {
  const code = c.req.query("code");

  if (code) {
    const baseUrl = new URL(c.req.url).origin;

    // Look up the authorization code directly from KV (no self-fetch)
    const codeData = await c.env.METRICS.get(`code:${code}`);
    if (codeData) {
      await c.env.METRICS.delete(`code:${code}`);
      const parsed = JSON.parse(codeData) as {
        user: AuthUser;
        clientId: string;
        redirectUri: string;
      };

      // Only accept codes issued for the dashboard client
      if (
        parsed.clientId !== "dashboard-internal" ||
        parsed.redirectUri !== `${baseUrl}/dashboard`
      ) {
        return c.redirect(`${baseUrl}/dashboard`);
      }

      const { user } = parsed;

      // Generate access token
      const accessToken = generateToken();
      await c.env.METRICS.put(`token:${accessToken}`, JSON.stringify(user), {
        expirationTtl: 24 * 60 * 60,
      });

      // Create session and set cookie
      const sessionId = generateToken();
      await c.env.METRICS.put(`session:${sessionId}`, JSON.stringify({ accessToken }), {
        expirationTtl: 24 * 60 * 60,
      });

      c.header(
        "Set-Cookie",
        `midnight_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
      );

      // Redirect to clean URL (strip code param)
      return c.redirect(`${baseUrl}/dashboard`);
    }
  }

  // Render dashboard
  const metrics = await getMetrics(c.env.DB);
  const authState = c.get("authState") as AuthState;
  const html = generateDashboardHtml(metrics, authState.user?.username);
  return c.html(html);
});

export default dashboardRoute;
