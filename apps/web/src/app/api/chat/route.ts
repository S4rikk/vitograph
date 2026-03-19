import { NextRequest, NextResponse } from "next/server";

// Vercel / Next.js allows up to 5 minutes for pro plans.
// Locally, setting this bypasses the default 30s timeout of Next.js dev server.
export const maxDuration = 180; // 3 minutes for LangGraph agent (chat)

export async function POST(req: NextRequest) {
    try {
        const json = await req.json();

        // Read the target backend URL.
        // We try to use the direct URL if provided, otherwise fallback to local Node.js API
        const baseUrl = process.env.NEXT_PUBLIC_AI_DIRECT_URL || "http://localhost:3001/api/v1/ai";
        const backendUrl = `${baseUrl}/chat`;

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
            body: JSON.stringify(json),
            // Pass the timeout to the underlying node-fetch
            signal: AbortSignal.timeout(180_000),
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
        console.error("[Next.js Proxy API] Error in chat agent:", error);
        return NextResponse.json(
            { error: true, message: "Internal Proxy Error", detail: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get("mode") || "assistant";

        const baseUrl = process.env.NEXT_PUBLIC_AI_DIRECT_URL || "http://localhost:3001/api/v1/ai";
        const backendUrl = `${baseUrl}/chat/history?mode=${mode}`;

        const authorization = req.headers.get("Authorization");
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };
        if (authorization) {
            headers["Authorization"] = authorization;
        }

        const response = await fetch(backendUrl, {
            method: "DELETE",
            headers,
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
        console.error("[Next.js Proxy API] Error in DELETE chat history:", error);
        return NextResponse.json(
            { error: true, message: "Internal Proxy Error", detail: error.message },
            { status: 500 }
        );
    }
}
