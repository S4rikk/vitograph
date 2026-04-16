import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import AddUserModal from "./AddUserModal";
import UserActions from "./UserActions";
import CopyEmail from "./CopyEmail";
import { Users, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Users | Admin | VITOGRAPH",
};

export default async function UsersPage() {
  const adminClient = createAdminClient();
  const supabase = await createClient();

  // Fetch all users via Auth Admin API
  const { data: authData } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });
  const users = authData?.users ?? [];

  // Fetch display names from profiles table
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name");

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name as string | null]),
  );

  const isBanned = (bannedUntil: string | null | undefined) => {
    if (!bannedUntil) return false;
    return new Date(bannedUntil) > new Date();
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
            Users
          </h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed">
            Управление учётными записями. Бан, разбан и удаление пользователей.
          </p>
        </div>
        <AddUserModal />
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden glass shadow-xl shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-4 font-medium w-10 text-center">#</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">
                  Имя
                </th>
                <th className="px-6 py-4 font-medium">Роль</th>
                <th className="px-6 py-4 font-medium">Статус</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">
                  Последний вход
                </th>
                <th className="px-6 py-4 font-medium hidden lg:table-cell">
                  Регистрация
                </th>
                <th className="px-6 py-4 font-medium text-right">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-slate-300">
              {users.length > 0 ? (
                users.map((user, idx) => {
                  const role = (user.app_metadata?.role as string) ?? "user";
                  const isAdmin = role === "admin";
                  const banned = isBanned(user.banned_until);
                  const displayName = profileMap.get(user.id) ?? null;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Sequential number */}
                      <td className="px-4 py-4 text-center text-slate-600 text-xs font-mono w-10">
                        {idx + 1}
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 max-w-[200px]">
                        <CopyEmail email={user.email ?? ""} />
                      </td>

                      {/* Display name */}
                      <td className="px-6 py-4 text-slate-400 hidden sm:table-cell">
                        {displayName ?? (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Role badge */}
                      <td className="px-6 py-4">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
                            🟣 Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-medium">
                            ⚪ User
                          </span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-6 py-4">
                        {banned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                            <ShieldAlert className="w-3 h-3" />
                            Заблокирован
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                            <ShieldCheck className="w-3 h-3" />
                            Активен
                          </span>
                        )}
                      </td>

                      {/* Last sign in */}
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap hidden md:table-cell">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleDateString(
                              "ru-RU",
                            )
                          : "Никогда"}
                      </td>

                      {/* Created at */}
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap hidden lg:table-cell">
                        {new Date(user.created_at).toLocaleDateString("ru-RU")}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <UserActions
                          userId={user.id}
                          currentEmail={user.email ?? ""}
                          isBanned={banned}
                          isAdmin={isAdmin}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-500">
                    <Users className="w-8 h-8 opacity-20 mx-auto mb-3" />
                    Пользователи не найдены.
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
