import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  connectToBackendCandidates,
  createEventStreamResponse,
} from "../_lib/backend";

export async function GET(request) {
  try {
    const { getToken } = await auth();
    const token = await getToken({ template: "auth_token" });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const incident = searchParams.get("incident");
    const streamPath = incident
      ? `/api/v1/incidents/stream/${encodeURIComponent(incident)}`
      : "/api/v1/incidents/stream";

    const { attemptedUrl, candidates, lastError, response } =
      await connectToBackendCandidates({
        path: streamPath,
        init: {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          cache: "no-store",
        },
      });

    if (!response) {
      console.error("[SSE Proxy Error] all backend candidates failed", {
        streamPath,
        candidates,
        lastError: String(lastError || "unknown"),
      });
      return NextResponse.json(
        { error: "Backend unreachable for SSE stream", candidates },
        { status: 504 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Backend SSE connection failed", backend: attemptedUrl },
        { status: response.status },
      );
    }

    return createEventStreamResponse(response.body);
  } catch (error) {
    console.error("[SSE Proxy Error]", error);
    return NextResponse.json(
      { error: "SSE proxy failed", detail: String(error) },
      { status: 500 },
    );
  }
}
