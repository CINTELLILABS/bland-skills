import { getApiKey, getBaseUrl } from "./config.js";
import { BlandError, AuthError } from "./errors.js";
import type { ApiResponse, ApiError } from "./types.js";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): string {
  const base = getBaseUrl().replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);
  if (query) {
    for (const [key, val] of Object.entries(query)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
      }
    }
  }
  return url.toString();
}

export function createApiClient(explicitApiKey?: string) {
  async function request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = "GET", body, query } = options;

    let apiKey: string;
    try {
      apiKey = getApiKey(explicitApiKey);
    } catch {
      throw new AuthError();
    }

    const url = buildUrl(path, query);
    const headers: Record<string, string> = {
      authorization: apiKey,
    };

    const fetchOptions: RequestInit = { method, headers };

    if (body) {
      headers["content-type"] = "application/json";
      fetchOptions.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      throw new BlandError(
        `Network error: ${err instanceof Error ? err.message : "Failed to connect to Bland API"}`
      );
    }

    if (response.status === 401) {
      throw new AuthError("Invalid API key.");
    }

    let data: unknown;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        if (!response.ok) {
          throw new BlandError(`API error (${response.status}): ${text}`);
        }
        return text as unknown as T;
      }
    }

    const apiResponse = data as ApiResponse<T>;
    if (apiResponse.errors && apiResponse.errors.length > 0) {
      throw new BlandError(
        apiResponse.errors.map((e: ApiError) => e.message).join("; "),
        response.status,
        apiResponse.errors
      );
    }

    if (apiResponse.data !== undefined) {
      return apiResponse.data as T;
    }

    return data as T;
  }

  return {
    get: <T = unknown>(
      path: string,
      query?: Record<string, string | number | boolean | undefined>
    ) => request<T>(path, { method: "GET", query }),

    post: <T = unknown>(path: string, body?: Record<string, unknown>) =>
      request<T>(path, { method: "POST", body }),

    put: <T = unknown>(path: string, body?: Record<string, unknown>) =>
      request<T>(path, { method: "PUT", body }),

    patch: <T = unknown>(path: string, body?: Record<string, unknown>) =>
      request<T>(path, { method: "PATCH", body }),

    delete: <T = unknown>(path: string) =>
      request<T>(path, { method: "DELETE" }),
  };
}

// Default client (uses env var / CLI config)
export const api = createApiClient();
