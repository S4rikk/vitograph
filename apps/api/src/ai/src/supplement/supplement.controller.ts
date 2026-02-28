import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

let supabaseAdminInstance: any = null;
function getSupabaseAdmin() {
    if (!supabaseAdminInstance) {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase credentials in environment variables");
        }
        supabaseAdminInstance = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
    }
    return supabaseAdminInstance;
}

export class SupplementController {
    /**
     * GET /api/v1/supplements/today
     * Возвращает активный протокол добавок пользователя и логи за сегодня.
     */
    public async getTodaySupplements(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            // 1. Получаем профиль с протоколом
            const supabaseAdmin = getSupabaseAdmin();
            const { data: profile, error: profileErr } = await supabaseAdmin
                .from("profiles")
                .select("active_supplement_protocol")
                .eq("id", userId)
                .single();

            if (profileErr) {
                res.status(500).json({ error: profileErr.message });
                return;
            }

            // 2. Получаем логи приема БАДов за 오늘 (сегодня с 00:00:00)
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const { data: logs, error: logsErr } = await supabaseAdmin
                .from("supplement_logs")
                .select("*")
                .eq("user_id", userId)
                .gte("taken_at", startOfDay.toISOString());

            if (logsErr) {
                res.status(500).json({ error: logsErr.message });
                return;
            }

            res.status(200).json({
                activeProtocol: profile?.active_supplement_protocol || {},
                todayLogs: logs || [],
            });
        } catch (error: any) {
            console.error("[SupplementController] Error getting today supplements:", error);
            res.status(500).json({ error: "Внутренняя ошибка сервера" });
        }
    }

    /**
     * POST /api/v1/supplements/log
     * Логирует факт приема БАДа
     */
    public async logSupplement(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const { supplement_name, dosage, taken_at_iso, was_on_time, source } = req.body;

            if (!supplement_name || !dosage) {
                res.status(400).json({ error: "supplement_name and dosage are required" });
                return;
            }

            const logEntry = {
                user_id: userId,
                supplement_name,
                dosage_taken: dosage,
                taken_at: taken_at_iso || new Date().toISOString(),
                was_on_time: typeof was_on_time === "boolean" ? was_on_time : true,
                source: source || "manual",
            };

            const supabaseAdmin = getSupabaseAdmin();
            const { data, error } = await supabaseAdmin
                .from("supplement_logs")
                .insert(logEntry)
                .select()
                .single();

            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }

            res.status(201).json(data);
        } catch (error: any) {
            console.error("[SupplementController] Error logging supplement:", error);
            res.status(500).json({ error: "Внутренняя ошибка сервера" });
        }
    }
}

export const supplementController = new SupplementController();
