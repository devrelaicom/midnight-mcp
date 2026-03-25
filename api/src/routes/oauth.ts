/**
 * OAuth 2.1 routes with PKCE support.
 * Implements authorization server for GitHub SSO.
 */

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Bindings, AuthUser } from "../interfaces";
import {
  generateToken,
  generateUUID,
  verifyPKCE,
  exchangeCodeWithGitHub,
  getGitHubUser,
  getGitHubOrgs,
} from "../services/oauth";

const oauthRoutes = new Hono<{ Bindings: Bindings }>();

// ============================================================================
// Discovery
// ============================================================================

/**
 * OAuth Authorization Server Metadata (RFC 8414).
 * MCP clients fetch this to discover auth endpoints.
 */
oauthRoutes.get("/.well-known/oauth-authorization-server", (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

// ============================================================================
// Dynamic Client Registration
// ============================================================================

oauthRoutes.post("/oauth/register", async (c) => {
  try {
    const body = await c.req.json<{
      redirect_uris?: string[];
      client_name?: string;
    }>();

    if (
      !body.redirect_uris ||
      !Array.isArray(body.redirect_uris) ||
      body.redirect_uris.length === 0
    ) {
      return c.json({ error: "redirect_uris is required" }, 400);
    }

    if (!body.client_name || typeof body.client_name !== "string") {
      return c.json({ error: "client_name is required" }, 400);
    }

    // Validate redirect URIs: must be http://localhost:* or https://*
    for (const uri of body.redirect_uris) {
      try {
        const parsed = new URL(uri);
        const isLocalhost = parsed.protocol === "http:" && parsed.hostname === "localhost";
        const isHttps = parsed.protocol === "https:";
        if (!isLocalhost && !isHttps) {
          return c.json(
            {
              error: `Invalid redirect_uri: ${uri}. Must use http://localhost or https://`,
            },
            400,
          );
        }
      } catch {
        return c.json({ error: `Invalid redirect_uri: ${uri}` }, 400);
      }
    }

    const clientId = generateUUID();

    await c.env.METRICS.put(
      `client:${clientId}`,
      JSON.stringify({
        clientName: body.client_name,
        redirectUris: body.redirect_uris,
      }),
      { expirationTtl: 30 * 24 * 60 * 60 }, // 30 days
    );

    return c.json({
      client_id: clientId,
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
    });
  } catch (error) {
    console.error("Client registration error:", error);
    return c.json({ error: "Registration failed" }, 500);
  }
});

// ============================================================================
// Authorization
// ============================================================================

oauthRoutes.get("/oauth/authorize", async (c) => {
  const responseType = c.req.query("response_type");
  const clientId = c.req.query("client_id");
  const redirectUri = c.req.query("redirect_uri");
  const codeChallenge = c.req.query("code_challenge");
  const codeChallengeMethod = c.req.query("code_challenge_method");
  const clientState = c.req.query("state");

  if (!clientId || !redirectUri) {
    return c.json({ error: "client_id and redirect_uri are required" }, 400);
  }

  if (responseType !== "code") {
    return c.json(
      { error: "invalid_request", error_description: "response_type must be 'code'" },
      400,
    );
  }

  // PKCE is required for all clients (OAuth 2.1)
  if (!codeChallenge) {
    return c.json(
      { error: "invalid_request", error_description: "code_challenge is required" },
      400,
    );
  }
  if (codeChallengeMethod !== "S256") {
    return c.json(
      { error: "invalid_request", error_description: "code_challenge_method must be S256" },
      400,
    );
  }

  // Validate client registration
  const clientData = await c.env.METRICS.get(`client:${clientId}`);
  if (!clientData) {
    return c.json({ error: "Unknown client_id" }, 400);
  }

  const client = JSON.parse(clientData) as {
    redirectUris: string[];
  };
  if (!client.redirectUris.includes(redirectUri)) {
    return c.json({ error: "redirect_uri not registered for this client" }, 400);
  }

  // Generate state for CSRF protection
  const state = generateToken();
  await c.env.METRICS.put(
    `state:${state}`,
    JSON.stringify({
      codeChallenge,
      redirectUri,
      clientId,
      clientState: clientState || null,
    }),
    { expirationTtl: 300 }, // 5 minutes
  );

  // Redirect to GitHub OAuth
  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", `${new URL(c.req.url).origin}/oauth/callback`);
  githubUrl.searchParams.set("scope", "read:org user:email");
  githubUrl.searchParams.set("state", state);

  return c.redirect(githubUrl.toString());
});

// ============================================================================
// Callback
// ============================================================================

oauthRoutes.get("/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.json({ error: "Missing code or state parameter" }, 400);
  }

  // Verify state (CSRF protection) — lookup and delete to prevent reuse
  const stateData = await c.env.METRICS.get(`state:${state}`);
  if (!stateData) {
    return c.json({ error: "Invalid or expired state parameter" }, 400);
  }
  await c.env.METRICS.delete(`state:${state}`);

  const { codeChallenge, redirectUri, clientId, clientState } = JSON.parse(stateData) as {
    codeChallenge: string;
    redirectUri: string;
    clientId: string;
    clientState: string | null;
  };

  try {
    // Exchange code with GitHub
    const githubAccessToken = await exchangeCodeWithGitHub(
      code,
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET,
    );

    // Fetch user profile and orgs
    const [githubUser, orgs] = await Promise.all([
      getGitHubUser(githubAccessToken),
      getGitHubOrgs(githubAccessToken),
    ]);

    // Generate our own authorization code
    const authCode = generateToken();
    const userData: AuthUser = {
      githubId: githubUser.id,
      username: githubUser.login,
      email: githubUser.email,
      orgs,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
    };

    await c.env.METRICS.put(
      `code:${authCode}`,
      JSON.stringify({
        user: userData,
        codeChallenge,
        redirectUri,
        clientId,
      }),
      { expirationTtl: 60 }, // 60 seconds
    );

    // Redirect back to client with authorization code
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", authCode);
    if (clientState) {
      callbackUrl.searchParams.set("state", clientState);
    }

    return c.redirect(callbackUrl.toString());
  } catch (error) {
    console.error("OAuth callback error:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }
});

// ============================================================================
// Token Exchange
// ============================================================================

oauthRoutes.post("/oauth/token", async (c) => {
  // Parse application/x-www-form-urlencoded body
  const body = await c.req.parseBody();
  const grantType = body["grant_type"] as string | undefined;
  const authCode = body["code"] as string | undefined;
  const clientId = body["client_id"] as string | undefined;
  const redirectUri = body["redirect_uri"] as string | undefined;
  const codeVerifier = body["code_verifier"] as string | undefined;

  if (grantType !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  if (!authCode || !clientId || !redirectUri) {
    return c.json({ error: "invalid_request" }, 400);
  }

  // Look up the authorization code
  const codeData = await c.env.METRICS.get(`code:${authCode}`);
  if (!codeData) {
    return c.json({ error: "invalid_grant" }, 400);
  }
  // Delete immediately to prevent reuse
  await c.env.METRICS.delete(`code:${authCode}`);

  const {
    user,
    codeChallenge,
    redirectUri: storedRedirectUri,
    clientId: storedClientId,
  } = JSON.parse(codeData) as {
    user: AuthUser;
    codeChallenge: string;
    redirectUri: string;
    clientId: string;
  };

  // Validate client_id and redirect_uri match the original request
  if (clientId !== storedClientId) {
    return c.json({ error: "invalid_grant" }, 400);
  }
  if (redirectUri !== storedRedirectUri) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  // PKCE verification is mandatory (OAuth 2.1)
  if (!codeVerifier) {
    return c.json(
      { error: "invalid_request", error_description: "code_verifier is required" },
      400,
    );
  }
  const valid = await verifyPKCE(codeVerifier, codeChallenge);
  if (!valid) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  // Generate access token and store session
  const accessToken = generateToken();
  await c.env.METRICS.put(
    `token:${accessToken}`,
    JSON.stringify(user),
    { expirationTtl: 24 * 60 * 60 }, // 24 hours
  );

  return c.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 86400,
  });
});

// ============================================================================
// Logout
// ============================================================================

oauthRoutes.get("/oauth/logout", async (c) => {
  const sessionId = getCookie(c, "midnight_session");
  if (sessionId) {
    // Resolve session -> access token, delete both
    const sessionData = await c.env.METRICS.get(`session:${sessionId}`);
    if (sessionData) {
      const { accessToken } = JSON.parse(sessionData) as {
        accessToken: string;
      };
      await c.env.METRICS.delete(`token:${accessToken}`);
      await c.env.METRICS.delete(`session:${sessionId}`);
    }
  }

  // Clear cookie
  c.header("Set-Cookie", "midnight_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");

  return c.redirect("/");
});

export default oauthRoutes;
