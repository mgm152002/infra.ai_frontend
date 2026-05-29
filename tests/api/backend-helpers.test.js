import {
  backendCandidates,
  connectToBackendCandidates,
  createEventStreamResponse,
  fetchWithConnectTimeout,
  normalizeBackendUrl,
} from "@/app/api/_lib/backend";
import { describe, expect, it, vi } from "vitest";

describe("backend helpers", () => {
  it("normalizes backend URLs", () => {
    expect(normalizeBackendUrl(" http://localhost:8000/// ")).toBe(
      "http://localhost:8000",
    );
    expect(normalizeBackendUrl("")).toBe("");
  });

  it("deduplicates and filters backend candidates", () => {
    const candidates = backendCandidates([
      " http://localhost:8000/ ",
      "",
      "http://localhost:8000",
      "http://127.0.0.1:8000///",
    ]);

    expect(candidates).toEqual([
      "http://localhost:8000",
      "http://127.0.0.1:8000",
    ]);
  });

  it("falls through candidates until one succeeds", async () => {
    const successfulResponse = new Response("ok");
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("first backend down"))
      .mockResolvedValueOnce(successfulResponse);

    const result = await connectToBackendCandidates({
      path: "/api/v1/incidents/stream",
      candidates: ["http://a", "http://b"],
      init: { headers: { Accept: "text/event-stream" } },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.response).toBe(successfulResponse);
    expect(result.attemptedUrl).toBe("http://b/api/v1/incidents/stream");
    expect(String(result.lastError)).toContain("first backend down");
  });

  it("aborts slow requests when the connect timeout is exceeded", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn((_url, init) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      });
    });

    const pendingRequest = fetchWithConnectTimeout(
      "http://backend",
      {},
      25,
      fetchImpl,
    );
    const handledRejection = pendingRequest.catch((error) => error);

    await vi.advanceTimersByTimeAsync(25);
    await expect(handledRejection).resolves.toBe("connect-timeout-25ms");

    vi.useRealTimers();
  });

  it("creates an SSE response with the expected headers", async () => {
    const response = createEventStreamResponse("event: ping\n\n");

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toBe("event: ping\n\n");
  });

  it("returns empty candidates for all-empty input", () => {
    const candidates = backendCandidates(["", "", ""]);
    expect(candidates).toEqual([]);
  });

  it("normalizes URL with only trailing slashes", () => {
    expect(normalizeBackendUrl("http://localhost:8000///")).toBe(
      "http://localhost:8000",
    );
  });
});
