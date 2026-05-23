import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  connectToBackendCandidates,
  createEventStreamResponse,
} from "../_lib/backend";

export async function POST(request) {
  try {
    const { getToken } = await auth();
    const token = await getToken({ template: "auth_token" });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (_error) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { attemptedUrl, candidates, lastError, response } =
      await connectToBackendCandidates({
        path: "/incident/stream",
        init: {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(body),
          cache: "no-store",
        },
      });

    if (!response) {
      console.error("[Execute Proxy Error] all backend candidates failed", {
        candidates,
        lastError: String(lastError || "unknown"),
      });
      return NextResponse.json(
        { error: "Backend unreachable for execution stream", candidates },
        { status: 504 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Backend execution stream failed", backend: attemptedUrl },
        { status: response.status },
      );
    }

    return createEventStreamResponse(response.body);
  } catch (error) {
    console.error("[Execute Proxy Error]", error);
    return NextResponse.json(
      { error: "Execute proxy failed", detail: String(error) },
      { status: 500 },
    );
  }
}
