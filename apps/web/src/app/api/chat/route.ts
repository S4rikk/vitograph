import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Vercel / Next.js allows up to 5 minutes for pro plans.
// Locally, setting this bypasses the default 30s timeout of Next.js dev server.
export const maxDuration = 900; // 15 minutes for LangGraph agent (chat)

export async function POST(req: NextRequest) {
    try {
        const json = await req.json();

        // Read the target backend URL.
        // We try to use the direct URL if provided, otherwise fallback to local Node.js API
        const baseUrl = process.env.NEXT_PUBLIC_AI_DIRECT_URL || "http://localhost:3001/api/v1/ai";
        const backendUrl = `${baseUrl}/chat`;

        const authorization = req.headers.get("Authorization");
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (authorization) {
            headers["Authorization"] = authorization;
        }

        const response = await axios.post(backendUrl, json, {
            headers,
            timeout: 900_000,
            validateStatus: () => true // Allow handling non-2xx status codes downstream
        });

        if (response.status >= 400) {
            return NextResponse.json(
                { error: true, message: `Backend error: ${response.status}`, detail: typeof response.data === "string" ? response.data : JSON.stringify(response.data) },
                { status: response.status }
            );
        }

        return NextResponse.json(response.data);
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
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (authorization) {
            headers["Authorization"] = authorization;
        }

        const response = await axios.delete(backendUrl, {
            headers,
            timeout: 900_000,
            validateStatus: () => true
        });

        if (response.status >= 400) {
            return NextResponse.json(
                { error: true, message: `Backend error: ${response.status}`, detail: typeof response.data === "string" ? response.data : JSON.stringify(response.data) },
                { status: response.status }
            );
        }

        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error("[Next.js Proxy API] Error in DELETE chat history:", error);
        return NextResponse.json(
            { error: true, message: "Internal Proxy Error", detail: error.message },
            { status: 500 }
        );
    }
}
