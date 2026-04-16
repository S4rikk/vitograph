import { createClient } from "@/lib/supabase/server";
import StatusSelect from "./StatusSelect";
import { MessageSquareWarning, Bug, Lightbulb, ImageIcon, Inbox } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback | Admin | VITOGRAPH",
};

interface FeedbackRow {
  id: number;
  user_id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  attachment_url: string | null;
}

export default async function FeedbackPage() {
  const supabase = await createClient();

  const { data: feedbacks } = await supabase
    .from("feedback")
    .select("id, user_id, category, message, status, created_at, attachment_url")
    .order("created_at", { ascending: false });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "bug":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            <Bug className="w-3 h-3" />
            Баг
          </span>
        );
      case "suggestion":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
            <Lightbulb className="w-3 h-3" />
            Предложение
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded bg-white/5 border border-white/10 text-xs">
            {category}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: "bg-blue-500/10 border-blue-500/20 text-blue-400",
      reviewed: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
      resolved: "bg-green-500/10 border-green-500/20 text-green-400",
    };
    const labels: Record<string, string> = {
      new: "🆕 Новый",
      reviewed: "👀 Просмотрен",
      resolved: "✅ Решён",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${styles[status] ?? "bg-white/5 border-white/10 text-slate-400"}`}
      >
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Feedback</h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed">
            Жалобы и предложения пользователей. Меняйте статус для отслеживания прогресса.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden glass shadow-xl shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4 font-medium">#</th>
                <th className="px-6 py-4 font-medium">Категория</th>
                <th className="px-6 py-4 font-medium">Сообщение</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Статус</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">Дата</th>
                <th className="px-6 py-4 font-medium">Скриншот</th>
                <th className="px-6 py-4 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-slate-300">
              {feedbacks && feedbacks.length > 0 ? (
                (feedbacks as FeedbackRow[]).map((fb) => (
                  <tr key={fb.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                      {fb.id}
                    </td>
                    <td className="px-6 py-4">
                      {getCategoryBadge(fb.category)}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="truncate text-slate-200" title={fb.message}>
                        {fb.message}
                      </p>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      {getStatusBadge(fb.status)}
                    </td>
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap hidden md:table-cell">
                      {new Date(fb.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-6 py-4">
                      {fb.attachment_url ? (
                        <a
                          href={fb.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                          title="Открыть скриншот"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span className="hidden lg:inline">Открыть</span>
                        </a>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <StatusSelect id={fb.id} currentStatus={fb.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <Inbox className="w-8 h-8 opacity-20 mx-auto mb-3" />
                    Обращений пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
