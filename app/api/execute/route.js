import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { backendCandidates, fetchWithConnectTimeout } from "../_lib/backend";

export async function POST(request) {
    try {
        const { getToken } = await auth();
        const token = await getToken({ template: 'auth_token' });

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Read the body from the incoming POST
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const candidates = backendCandidates();
        let response = null;
        let lastError = null;
        let attemptedUrl = null;

        for (const backendUrl of candidates) {
            attemptedUrl = `${backendUrl}/incident/stream`;
            try {
                response = await fetchWithConnectTimeout(attemptedUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream'
                    },
                    body: JSON.stringify(body),
                    cache: 'no-store'
                }, 8000);
                break;
            } catch (e) {
                lastError = e;
            }
        }

        if (!response) {
            console.error("[Execute Proxy Error] all backend candidates failed", {
                candidates,
                lastError: String(lastError || "unknown"),
            });
            return NextResponse.json(
                { error: "Backend unreachable for execution stream", candidates },
                { status: 504 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { error: "Backend execution stream failed", backend: attemptedUrl },
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
        console.error("[Execute Proxy Error]", error);
        return NextResponse.json({ error: "Execute proxy failed", detail: String(error) }, { status: 500 });
    }
}
