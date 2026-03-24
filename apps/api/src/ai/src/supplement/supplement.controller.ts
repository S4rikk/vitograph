import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
            const { startDate, endDate } = req.query;

            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            // 1. Получаем профиль с протоколом и списком медикаментов
            const supabaseAdmin = getSupabaseAdmin();
            const { data: profile, error: profileErr } = await supabaseAdmin
                .from("profiles")
                .select("medications")
                .eq("id", userId)
                .single();

            if (profileErr && profileErr.code !== "PGRST116") {
                console.error("[SupplementController] Error fetching profile:", profileErr);
            }

            // 2. Получаем логи приема БАДов за указанный период (или по умолчанию за сегодня)
            let query = supabaseAdmin
                .from("supplement_logs")
                .select("*")
                .eq("user_id", userId);

            if (startDate && typeof startDate === "string" && endDate && typeof endDate === "string") {
                query = query.gte("taken_at", startDate).lte("taken_at", endDate);
            } else {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                query = query.gte("taken_at", startOfDay.toISOString());
            }

            const { data: logs, error: logsErr } = await query;

            if (logsErr) {
                res.status(500).json({ error: logsErr.message });
                return;
            }

            res.status(200).json({
                activeProtocol: {},
                medications: profile?.medications || [],
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
                id: crypto.randomUUID(),
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

    /**
     * DELETE /api/v1/supplements/log/:id
     * Удаляет лог приема БАДа
     */
    public async deleteSupplementLog(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const logId = req.params.id;

            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            if (!logId) {
                res.status(400).json({ error: "logId is required" });
                return;
            }

            const supabaseAdmin = getSupabaseAdmin();
            const { error } = await supabaseAdmin
                .from("supplement_logs")
                .delete()
                .eq("id", logId)
                .eq("user_id", userId);

            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }

            res.status(200).json({ success: true });
        } catch (error: any) {
            console.error("[SupplementController] Error deleting supplement log:", error);
            res.status(500).json({ error: "Внутренняя ошибка сервера" });
        }
    }
}

export const supplementController = new SupplementController();
