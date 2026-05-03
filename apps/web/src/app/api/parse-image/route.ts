import { NextRequest, NextResponse } from "next/server";

// Vercel / Next.js allows up to 5 minutes for pro plans, but 60s for hobby. 
// Locally, setting this bypasses the default 30s timeout of Next.js dev server.
export const maxDuration = 120; // 2 minutes

export async function POST(req: NextRequest) {
    try {
        // Read the target backend URL.
        const baseUrl = process.env.NEXT_PUBLIC_AI_DIRECT_URL || "http://localhost:3001/api/v1";
        const integrationBaseUrl = baseUrl.endsWith("/ai")
            ? baseUrl.slice(0, -3) + "/integration"
            : "http://localhost:3001/api/v1/integration";
        const backendUrl = `${integrationBaseUrl}/parse-image`;

        // Forward the exact content-type (including the multipart boundary!)
        const headers = new Headers();
        const contentType = req.headers.get("Content-Type");
        if (contentType) {
            headers.set("Content-Type", contentType);
        }

        const authorization = req.headers.get("Authorization");
        if (authorization) {
            headers.set("Authorization", authorization);
        }

        const acceptLanguage = req.headers.get("Accept-Language");
        if (acceptLanguage) {
            headers.set("Accept-Language", acceptLanguage);
        }

        const response = await fetch(backendUrl, {
            method: "POST",
            headers,
            body: req.body,
            signal: AbortSignal.timeout(120_000),
            // @ts-ignore
            duplex: "half", // Required for sending streams in Node 18+ fetch
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
