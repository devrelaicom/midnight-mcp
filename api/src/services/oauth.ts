/**
 * OAuth utility functions.
 * Handles token generation, PKCE verification, and GitHub API calls.
 */

/**
 * Generate a cryptographically random hex string.
 */
export function generateToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a UUID v4 for client IDs.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Verify a PKCE code_verifier against a stored code_challenge (S256 method).
 * Returns true if the verifier hashes to the challenge.
 */
export async function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64 === codeChallenge;
}

/**
 * Exchange an authorization code with GitHub for an access token.
 */
export async function exchangeCodeWithGitHub(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "GitHub token exchange failed"
    );
  }

  return data.access_token;
}

/**
 * Fetch the authenticated GitHub user's profile.
 */
export async function getGitHubUser(
  accessToken: string
): Promise<{ id: number; login: string; email: string }> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "midnight-mcp-api",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed: ${response.status}`);
  }

  const user = (await response.json()) as {
    id: number;
    login: string;
    email: string | null;
  };

  // If email is null (private), try the emails endpoint
  let email = user.email || "";
  if (!email) {
    try {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "midnight-mcp-api",
        },
      });
      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as Array<{
          email: string;
          primary: boolean;
        }>;
        const primary = emails.find((e) => e.primary);
        email = primary?.email || emails[0]?.email || "";
      }
    } catch {
      // Non-critical, proceed without email
    }
  }

  return { id: user.id, login: user.login, email };
}

/**
 * Fetch the authenticated GitHub user's organization memberships.
 */
export async function getGitHubOrgs(
  accessToken: string
): Promise<string[]> {
  const response = await fetch("https://api.github.com/user/orgs", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "midnight-mcp-api",
    },
  });

  if (!response.ok) {
    return []; // Non-critical — user may have no orgs
  }

  const orgs = (await response.json()) as Array<{ login: string }>;
  return orgs.map((o) => o.login);
}
