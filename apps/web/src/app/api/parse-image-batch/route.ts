import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Increase max duration for this endpoint specifically (Vercel generic or Next.js setting)
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
    try {
        // Попытка взять токен из заголовков, иначе из кук
        const authHeader = req.headers.get("Authorization");
        let token = "";
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else {
            const cookieStore = await cookies();
            token = cookieStore.get("app.auth.token")?.value || "";
        }

        // Логика как в parse-image: правильное определение URL шлюза интеграции
        const baseUrl = process.env.NEXT_PUBLIC_AI_DIRECT_URL || "http://localhost:3001/api/v1";
        const integrationBaseUrl = baseUrl.endsWith("/ai")
            ? baseUrl.slice(0, -3) + "/integration"
            : "http://localhost:3001/api/v1/integration";

        const backendUrl = `${integrationBaseUrl}/parse-image-batch`;

        // Create headers for proxying
        const headers = new Headers();
        // Forward the exact content-type (including the multipart boundary!)
        const contentType = req.headers.get("Content-Type");
        if (contentType) {
            headers.set("Content-Type", contentType);
        }

        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        const fetchOptions: RequestInit = {
            method: "POST",
            body: req.body, // Proxy raw stream to avoid FormData array keys loss
            headers,
            signal: AbortSignal.timeout(300_000), // 300s timeout
            // @ts-ignore
            duplex: "half", // Required for sending streams in Node 18+ fetch
        };

        const response = await fetch(backendUrl, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[parse-image-batch] Backend status ${response.status}:`, errorText);
            return NextResponse.json({ success: false, error: true, message: `Backend error: ${response.status}`, detail: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err: any) {
        if (err.name === "AbortError" || err.name === "TimeoutError") {
            return NextResponse.json(
                { success: false, error: true, message: "Request timed out after 5 minutes. The processing takes too long." },
                { status: 504 }
            );
        }
        const errorDetail = err instanceof Error ? err.message : String(err);
        console.error("[Proxy:parse-image-batch] ❌ Unexpected Error:", errorDetail);
        return NextResponse.json(
            { success: false, error: errorDetail, message: "Unexpected proxy failure" },
            { status: 500 }
        );
    }
}
