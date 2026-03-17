import { NextRequest, NextResponse } from "next/server";

// Vercel / Next.js allows up to 5 minutes for pro plans, but 60s for hobby. 
// Locally, setting this bypasses the default 30s timeout of Next.js dev server.
export const maxDuration = 120; // 2 minutes

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Read the target backend URL.
        const baseUrl = process.env.NEXT_PUBLIC_AI_DIRECT_URL || "http://localhost:3001/api/v1";
        
        // Target: /api/v1/integration/refresh-notes
        const integrationBaseUrl = baseUrl.endsWith("/ai")
            ? baseUrl.slice(0, -3) + "/integration"
            : baseUrl.includes("/v1") 
                ? baseUrl.split("/v1")[0] + "/v1/integration"
                : "http://localhost:3001/api/v1/integration";

        const backendUrl = `${integrationBaseUrl}/refresh-notes`;

        const authorization = req.headers.get("Authorization");
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };
        if (authorization) {
            headers["Authorization"] = authorization;
        }

        const response = await fetch(backendUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120_000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: true, message: `Backend error: ${response.status}`, detail: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[Next.js Proxy API] Error refreshing notes:", error);
        return NextResponse.json(
            { error: true, message: "Internal Proxy Error", detail: error.message },
            { status: 500 }
        );
    }
}
