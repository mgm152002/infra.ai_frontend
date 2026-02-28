const DEFAULT_BACKEND_CANDIDATES = [
  process.env.API_INTERNAL_URL,
  process.env.BACKEND_URL,
  process.env.NEXT_PUBLIC_API_URL,
  "http://127.0.0.1:8000",
  "http://localhost:8000",
];

export function backendCandidates() {
  const seen = new Set();
  const out = [];
  for (const raw of DEFAULT_BACKEND_CANDIDATES) {
    const url = (raw || "").trim().replace(/\/+$/, "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export async function fetchWithConnectTimeout(url, init = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`connect-timeout-${timeoutMs}ms`), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
