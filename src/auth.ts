import * as http from "http";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { getBlandCliConfigPath, getBaseUrl, isAuthenticated } from "./config.js";

const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const SIGNUP_URL_BASE = "https://app.bland.ai/auth";

interface AuthResult {
  success: boolean;
  already_authenticated?: boolean;
  api_key?: string;
  org_id?: string;
  phone_number?: string | null;
  persona_id?: string | null;
  error?: string;
}

export interface DeviceLoginResult {
  success: boolean;
  device_code?: string;
  user_code?: string;
  verification_url?: string;
  verification_url_complete?: string;
  expires_in?: number;
  interval?: number;
  error?: string;
}

export type DevicePollStatus = "pending" | "approved" | "expired" | "slow_down";

export type AgentPhonePlanStatus = "active" | "past_due" | "canceled" | "none";

export interface AgentPhonePlanSummary {
  name: string;
  display_name: string;
  status: AgentPhonePlanStatus;
  phone_number: string | null;
  concurrency: number;
  max_call_duration_minutes: number;
  allowed_countries: string[];
  current_period_end: string | null;
}

export interface DevicePollResult {
  success: boolean;
  status?: DevicePollStatus;
  api_key?: string;
  org_id?: string;
  phone_number?: string | null;
  plan?: AgentPhonePlanSummary | null;
  client_name?: string;
  interval?: number;
  expires_in?: number;
  error?: string;
}

const DEFAULT_CLIENT_NAME = "bland-skills";
const AGENT_ONBOARDING_START_PATH = "/v1/agent/onboarding/start";
const AGENT_ONBOARDING_POLL_PATH = "/v1/agent/onboarding/poll";

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not find free port"));
      }
    });
    server.on("error", reject);
  });
}

function isValidApiKey(key: unknown): key is string {
  return typeof key === "string" && /^[a-zA-Z0-9_\-]{10,}$/.test(key);
}

function saveApiKeyToConfig(apiKey: string): void {
  if (!isValidApiKey(apiKey)) {
    throw new Error("Invalid API key format received from server");
  }

  const configPath = getBlandCliConfigPath();
  const configDir = path.dirname(configPath);

  fs.mkdirSync(configDir, { recursive: true });

  const config = {
    current_profile: "default",
    profiles: {
      default: {
        api_key: apiKey,
        base_url: "https://api.bland.ai",
      },
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>Bland AI</title></head>
<body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8f9fa;">
  <div style="text-align: center; padding: 2rem;">
    <h1 style="color: #10b981;">Authentication Successful</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;

const ALLOWED_BASE_URLS = [
  "https://api.bland.ai",
  "https://staging-api.bland.ai",
];

function validateBaseUrl(baseUrl: string): string {
  if (ALLOWED_BASE_URLS.includes(baseUrl)) return baseUrl;
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname.endsWith(".bland.ai") && parsed.protocol === "https:") {
      return baseUrl;
    }
  } catch {
    // invalid URL
  }
  throw new Error(`Untrusted base URL: ${baseUrl}`);
}

async function exchangeToken(
  baseUrl: string,
  token: string,
  redirectUri: string,
  retries = 1
): Promise<any> {
  const validatedUrl = validateBaseUrl(baseUrl);
  const exchangeUrl = `${validatedUrl}/auth/exchange`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(exchangeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, redirect_uri: redirectUri }),
      });

      if (!res.ok) {
        throw new Error(`Exchange failed: ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

export async function handleAuthLogin(): Promise<AuthResult> {
  if (isAuthenticated()) {
    return { success: true, already_authenticated: true };
  }

  let port: number;
  try {
    port = await findFreePort();
  } catch {
    return { success: false, error: "COULD_NOT_FIND_PORT" };
  }

  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const authUrl = `${SIGNUP_URL_BASE}?ref=metabot&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return new Promise<AuthResult>(async (resolve) => {
    let resolved = false;

    function finish(result: AuthResult) {
      if (resolved) return;
      resolved = true;
      server.close();
      resolve(result);
    }

    const server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url || "", true);

      if (parsedUrl.pathname === "/callback" && parsedUrl.query.token) {
        const token = parsedUrl.query.token as string;

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(SUCCESS_HTML);

        try {
          const baseUrl = getBaseUrl();
          const response = await exchangeToken(baseUrl, token, redirectUri, 1);
          const data = response.data;

          saveApiKeyToConfig(data.api_key);

          finish({
            success: true,
            api_key: data.api_key,
            org_id: data.org_id,
            phone_number: data.phone_number || null,
            persona_id: data.persona_id || null,
          });
        } catch (err) {
          finish({
            success: false,
            error: `TOKEN_EXCHANGE_FAILED: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(port, "127.0.0.1", async () => {
      try {
        const open = (await import("open")).default;
        await open(authUrl);
      } catch {
        finish({
          success: false,
          error: `BROWSER_OPEN_FAILED. Please open this URL manually: ${authUrl}`,
        });
      }
    });

    setTimeout(() => {
      finish({
        success: false,
        error: "TIMEOUT — user did not complete signup within 5 minutes",
      });
    }, AUTH_TIMEOUT_MS);
  });
}

interface OnboardingApiError {
  error?: string;
  message?: string;
  interval?: number;
}

interface OnboardingApiResponse {
  data?: Record<string, unknown> | null;
  errors?: OnboardingApiError[] | null;
}

async function parseJsonSafe(res: Response): Promise<OnboardingApiResponse | null> {
  try {
    return (await res.json()) as OnboardingApiResponse;
  } catch {
    return null;
  }
}

function firstErrorMessage(payload: OnboardingApiResponse | null, fallback: string): string {
  return payload?.errors?.[0]?.message || fallback;
}

function genericErrorResult(
  res: Response,
  payload: OnboardingApiResponse | null
): { success: false; error: string } {
  return {
    success: false,
    error: firstErrorMessage(payload, `Request failed: ${res.status} ${res.statusText}`),
  };
}

type OnboardingRequestResult =
  | { ok: true; res: Response; payload: OnboardingApiResponse | null }
  | { ok: false; error: string };

// Shared by handleDeviceAuthLogin and handleDeviceAuthPoll: resolve/validate
// the base URL, POST the body, and parse the response. Status-code-specific
// handling (503 on start, 429/SLOW_DOWN on poll, the generic !res.ok
// fallback) stays with each caller since it differs per endpoint.
async function postOnboarding(
  path: string,
  body: Record<string, unknown>
): Promise<OnboardingRequestResult> {
  let baseUrl: string;
  try {
    baseUrl = validateBaseUrl(getBaseUrl());
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      error: `NETWORK_ERROR: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const payload = await parseJsonSafe(res);
  return { ok: true, res, payload };
}

/**
 * Start a device-authorization flow (RFC 8628 style). Unlike handleAuthLogin,
 * this never blocks: an MCP tool call can't hold a connection open for the
 * up-to-15-minute window a human needs to complete signup in their own
 * browser, especially when that human isn't on the same machine as the
 * agent. Returns the code and link immediately; the caller polls
 * handleDeviceAuthPoll separately, one call at a time.
 */
export async function handleDeviceAuthLogin(
  clientName?: string
): Promise<DeviceLoginResult> {
  const result = await postOnboarding(AGENT_ONBOARDING_START_PATH, {
    client_name: clientName || DEFAULT_CLIENT_NAME,
  });
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  const { res, payload } = result;

  if (res.status === 503) {
    return {
      success: false,
      error: firstErrorMessage(payload, "Device login is temporarily unavailable. Try again shortly."),
    };
  }

  if (!res.ok) {
    return genericErrorResult(res, payload);
  }

  const data = payload?.data;
  if (!data || typeof data.device_code !== "string" || typeof data.user_code !== "string") {
    return { success: false, error: "Malformed response from onboarding start endpoint" };
  }

  return {
    success: true,
    device_code: data.device_code,
    user_code: data.user_code,
    verification_url: data.verification_url as string | undefined,
    verification_url_complete: data.verification_url_complete as string | undefined,
    expires_in: data.expires_in as number | undefined,
    interval: data.interval as number | undefined,
  };
}

/**
 * Poll a device code started by handleDeviceAuthLogin. On approval, the API
 * key is saved to local config here (mirroring saveApiKeyToConfig's use in
 * handleAuthLogin). Callers should only ever surface a short preview of the
 * key, never the full value.
 */
export async function handleDeviceAuthPoll(
  deviceCode: string
): Promise<DevicePollResult> {
  if (!deviceCode) {
    return { success: false, error: "device_code is required" };
  }

  const result = await postOnboarding(AGENT_ONBOARDING_POLL_PATH, { device_code: deviceCode });
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  const { res, payload } = result;

  if (res.status === 429) {
    const err0 = payload?.errors?.[0];
    if (err0?.error === "SLOW_DOWN") {
      return { success: true, status: "slow_down", interval: err0.interval };
    }
    return { success: false, error: firstErrorMessage(payload, "Rate limited") };
  }

  if (!res.ok) {
    return genericErrorResult(res, payload);
  }

  const data = payload?.data;
  const status = data?.status as DevicePollStatus | undefined;

  if (status === "approved") {
    const apiKey = data?.api_key as string | undefined;
    if (!apiKey) {
      return { success: false, error: "Server approved the request but did not return an API key" };
    }
    try {
      saveApiKeyToConfig(apiKey);
    } catch (err) {
      return {
        success: false,
        error: `Failed to save API key: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return {
      success: true,
      status: "approved",
      api_key: apiKey,
      org_id: data?.org_id as string | undefined,
      phone_number: (data?.phone_number as string | null | undefined) ?? null,
      plan: (data?.plan as AgentPhonePlanSummary | null | undefined) ?? null,
      client_name: data?.client_name as string | undefined,
    };
  }

  // A missing/expired record and a never-existed device_code both surface
  // here as "expired": the server never distinguishes them, on purpose.
  if (status === "expired") {
    return { success: true, status: "expired" };
  }

  return {
    success: true,
    status: "pending",
    interval: data?.interval as number | undefined,
    expires_in: data?.expires_in as number | undefined,
  };
}
