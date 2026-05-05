const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 20000;

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const backendPath = normalizedPath.replace(/^\/api(?=\/|$)/, "");

  return API_BASE_URL ? `${API_BASE_URL}${backendPath || "/"}` : normalizedPath;
};

export const apiHeaders = (headers: HeadersInit = {}): HeadersInit => ({
  "ngrok-skip-browser-warning": "true",
  ...headers,
});

export const apiBaseUrl = API_BASE_URL;

export const apiTimeoutSignal = (timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeoutId),
  };
};
