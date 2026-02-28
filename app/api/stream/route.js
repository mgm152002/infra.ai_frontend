import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { backendCandidates, fetchWithConnectTimeout } from "../_lib/backend";

export async function GET(request) {
    try {
        const { getToken } = await auth();
        const token = await getToken({ template: 'auth_token' });

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const incident = searchParams.get("incident");
        const streamPath = incident
            ? `/api/v1/incidents/stream/${encodeURIComponent(incident)}`
            : "/api/v1/incidents/stream";

        const candidates = backendCandidates();
        let response = null;
        let lastError = null;
        let attemptedUrl = null;

        for (const backendUrl of candidates) {
            attemptedUrl = `${backendUrl}${streamPath}`;
            try {
                response = await fetchWithConnectTimeout(attemptedUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'text/event-stream'
                    },
                    cache: 'no-store'
                }, 8000);
                break;
            } catch (e) {
                lastError = e;
            }
        }

        if (!response) {
            console.error("[SSE Proxy Error] all backend candidates failed", {
                streamPath,
                candidates,
                lastError: String(lastError || "unknown"),
            });
            return NextResponse.json(
                { error: "Backend unreachable for SSE stream", candidates },
                { status: 504 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { error: "Backend SSE connection failed", backend: attemptedUrl },
                { status: response.status }
            );
        }

        // Proxy the ReadableStream directly to the client
        return new Response(response.body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
            },
        });
    } catch (error) {
        console.error("[SSE Proxy Error]", error);
        return NextResponse.json({ error: "SSE proxy failed", detail: String(error) }, { status: 500 });
    }
}
