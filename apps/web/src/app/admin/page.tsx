import { createAdminClient } from "@/lib/supabase/admin";
import { Users, UserPlus, TrendingUp, Calendar } from "lucide-react";
import UserGrowthChart from "@/components/admin/UserGrowthChart";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Admin | VITOGRAPH",
};

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClassName: string;
  subtitle?: React.ReactNode;
  delay: string;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  subtitle,
  delay,
}: KpiCardProps) {
  return (
    <div
      className="bg-white/5 border border-white/10 rounded-2xl p-6 glass hover:bg-white/[0.07] transition-all duration-300 group animate-fade-in-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-400">{label}</h3>
        <Icon className={iconClassName} />
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export default async function AdminDashboardOverview() {
  // 1. Fetch all users via Auth Admin API
  const adminClient = createAdminClient();
  const { data: authData } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });
  const users = authData?.users ?? [];

  // 2. Compute metrics
  const totalUsers = users.length;

  const today = new Date().toISOString().slice(0, 10);
  const newToday = users.filter(
    (u) => u.created_at.slice(0, 10) === today,
  ).length;

  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const newYesterday = users.filter(
    (u) => u.created_at.slice(0, 10) === yesterday,
  ).length;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const newLast7Days = users.filter(
    (u) => new Date(u.created_at) >= sevenDaysAgo,
  ).length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const newLast30Days = users.filter(
    (u) => new Date(u.created_at) >= thirtyDaysAgo,
  ).length;

  // 3. Daily signups for the chart (last 30 days)
  const dailySignups: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const count = users.filter((u) => u.created_at.slice(0, 10) === d).length;
    dailySignups.push({ date: d, count });
  }

  // 4. Comparison subtitle for "Today" card
  const todayDiff = newToday - newYesterday;
  let todaySubtitle: React.ReactNode;
  if (todayDiff > 0) {
    todaySubtitle = (
      <span className="text-green-400">↑ +{todayDiff} vs вчера</span>
    );
  } else if (todayDiff < 0) {
    todaySubtitle = (
      <span className="text-red-400">↓ {todayDiff} vs вчера</span>
    );
  } else {
    todaySubtitle = (
      <span className="text-slate-500">→ без изменений</span>
    );
  }

  // 5. Last 5 registered users (sorted by created_at desc)
  const recentUsers = [...users]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          Dashboard
        </h1>
        <p className="text-slate-400 leading-relaxed">
          Мониторинг роста пользователей
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Всего юзеров"
          value={totalUsers}
          icon={Users}
          iconClassName="w-5 h-5 text-slate-600 transition-colors duration-200 group-hover:text-blue-400"
          subtitle={`+${newToday} сегодня`}
          delay="0ms"
        />
        <KpiCard
          label="Сегодня"
          value={newToday}
          icon={UserPlus}
          iconClassName="w-5 h-5 text-slate-600 transition-colors duration-200 group-hover:text-green-400"
          subtitle={todaySubtitle}
          delay="50ms"
        />
        <KpiCard
          label="За 7 дней"
          value={newLast7Days}
          icon={TrendingUp}
          iconClassName="w-5 h-5 text-slate-600 transition-colors duration-200 group-hover:text-purple-400"
          subtitle="новых регистраций"
          delay="100ms"
        />
        <KpiCard
          label="За 30 дней"
          value={newLast30Days}
          icon={Calendar}
          iconClassName="w-5 h-5 text-slate-600 transition-colors duration-200 group-hover:text-amber-400"
          subtitle="новых регистраций"
          delay="150ms"
        />
      </div>

      {/* Bar Chart */}
      <div className="mb-8">
        <UserGrowthChart data={dailySignups} />
      </div>

      {/* Recent Registrations Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-fade-in-up">
        <div className="px-6 py-5 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">
            Последние регистрации
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            5 последних зарегистрированных пользователей
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Дата регистрации</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">
                  Последний вход
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-slate-300">
              {recentUsers.length > 0 ? (
                recentUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 text-white font-medium">
                      {user.email ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString("ru-RU")}{" "}
                      <span className="text-slate-600">
                        {new Date(user.created_at).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap hidden sm:table-cell">
                      {user.last_sign_in_at
                        ? `${new Date(
                            user.last_sign_in_at,
                          ).toLocaleDateString("ru-RU")} ${new Date(
                            user.last_sign_in_at,
                          ).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Никогда"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-16 text-center text-slate-500"
                  >
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
