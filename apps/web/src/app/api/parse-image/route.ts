import { NextRequest, NextResponse } from "next/server";

// Vercel / Next.js allows up to 5 minutes for pro plans, but 60s for hobby. 
// Locally, setting this bypasses the default 30s timeout of Next.js dev server.
export const maxDuration = 120; // 2 minutes

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        // Read the target backend URL.
        // We try to use the direct URL if provided, otherwise fallback to local Node.js API
        const baseUrl = process.env.NEXT_PUBLIC_AI_DIRECT_URL || "http://localhost:3001/api/v1";
        // For integrations like parsing, it's not under /ai, it's under /integration
        // So if NEXT_PUBLIC_AI_DIRECT_URL is "http://vg.sanderok.uk/api/v1/ai", we replace "/ai" with "/integration"
        const integrationBaseUrl = baseUrl.endsWith("/ai")
            ? baseUrl.slice(0, -3) + "/integration"
            : "http://localhost:3001/api/v1/integration";

        const backendUrl = `${integrationBaseUrl}/parse-image`;

        const authorization = req.headers.get("Authorization");
        const headers: HeadersInit = {};
        if (authorization) {
            headers["Authorization"] = authorization;
        }

        const response = await fetch(backendUrl, {
            method: "POST",
            headers,
            body: formData,
            // Pass the timeout to the underlying node-fetch
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
        console.error("[Next.js Proxy API] Error uploading image:", error);
        return NextResponse.json(
            { error: true, message: "Internal Proxy Error", detail: error.message },
            { status: 500 }
        );
    }
}
