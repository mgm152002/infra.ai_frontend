const DEFAULT_BACKEND_CANDIDATES = [
  process.env.API_INTERNAL_URL,
  process.env.BACKEND_URL,
  process.env.NEXT_PUBLIC_API_URL,
  "http://127.0.0.1:8000",
  "http://localhost:8000",
];

export const EVENT_STREAM_HEADERS = Object.freeze({
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
});

export function normalizeBackendUrl(raw) {
  return (raw || "").trim().replace(/\/+$/, "");
}

export function backendCandidates(candidateList = DEFAULT_BACKEND_CANDIDATES) {
  const seen = new Set();
  const candidates = [];

  for (const raw of candidateList) {
    const url = normalizeBackendUrl(raw);
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    candidates.push(url);
  }

  return candidates;
}

export async function fetchWithConnectTimeout(
  url,
  init = {},
  timeoutMs = 8000,
  fetchImpl = fetch,
) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(`connect-timeout-${timeoutMs}ms`),
    timeoutMs,
  );

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function connectToBackendCandidates({
  path,
  init = {},
  timeoutMs = 8000,
  candidates = backendCandidates(),
  fetchImpl = fetch,
}) {
  let response = null;
  let lastError = null;
  let attemptedUrl = null;

  for (const backendUrl of candidates) {
    attemptedUrl = `${backendUrl}${path}`;

    try {
      response = await fetchWithConnectTimeout(
        attemptedUrl,
        init,
        timeoutMs,
        fetchImpl,
      );
      break;
    } catch (error) {
      lastError = error;
    }
  }

  return {
    attemptedUrl,
    candidates,
    lastError,
    response,
  };
}

export function createEventStreamResponse(body) {
  return new Response(body, { headers: EVENT_STREAM_HEADERS });
}
