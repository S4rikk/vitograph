"use client";

import React, { useEffect, useState } from "react";
import { Target, X, Loader2, Sparkles, ChevronDown } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import type { HealthGoal } from "@/lib/types/profile";

export default function HealthGoalsWidget() {
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [supabase] = useState(() => createClient());

  const loadData = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      setUserId(user.id);
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("health_goals")
        .eq("id", user.id)
        .single();
        
      if (error) throw error;

      if (profile?.health_goals && Array.isArray(profile.health_goals)) {
        setGoals(profile.health_goals.filter((g: HealthGoal) => g.is_active !== false));
      } else {
        setGoals([]);
      }
    } catch (e) {
      console.error("Failed to load health goals", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData(true);
    window.addEventListener("refresh-health-goals", handleUpdate);
    return () => window.removeEventListener("refresh-health-goals", handleUpdate);
  }, [supabase]);

  const handleRemoveGoal = async (goalId: string) => {
    if (!userId) return;
    if (!window.confirm("Завершить эту цель? Поздравляем с достижением! 🎉")) return;
    
    setIsDeleting(goalId);
    try {
      // Fetch full profile again to avoid overwriting other potential updates
      const { data: profile } = await supabase
        .from("profiles")
        .select("health_goals")
        .eq("id", userId)
        .single();
        
      let allGoals = profile?.health_goals || [];
      
      // Mark as inactive instead of deleting completely for history
      const updatedGoals = allGoals.map((g: HealthGoal) => 
        g.id === goalId ? { ...g, is_active: false } : g
      );
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ health_goals: updatedGoals })
        .eq("id", userId);
        
      if (updateError) throw updateError;
      setGoals(updatedGoals.filter((g: HealthGoal) => g.is_active !== false));
      window.dispatchEvent(new Event("refresh-health-goals"));
    } catch (e) {
      console.error("Failed to remove goal", e);
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex animate-pulse items-center gap-2 px-4 sm:px-6 pt-3 pb-2">
        <div className="h-7 w-7 rounded-full bg-slate-100"></div>
        <div className="h-8 w-32 rounded-full bg-slate-100"></div>
      </div>
    );
  }
  
  if (goals.length === 0) {
    return (
      <div className="px-5 sm:px-12 py-2 animate-in fade-in slide-in-from-top-1 duration-500">
        <div className="flex items-center gap-3 p-2 bg-slate-50/50 border border-slate-100 rounded-2xl w-full shadow-sm">
          <div className="flex shrink-0 items-center justify-center bg-white border border-slate-200 text-primary-600 rounded-xl w-9 h-9">
            <Target className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <p className="text-[12px] font-semibold text-slate-700 leading-tight">
              У вас пока нет целей
            </p>
            <p className="text-[11px] text-slate-500 italic mt-0.5 leading-snug">
              Напишите в чат: «Хочу похудеть на 5 кг»
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 sm:mx-6 mt-2 mb-1 animate-in fade-in slide-in-from-top-1 duration-500">
      <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 shadow-sm overflow-hidden transition-all duration-300">
        {/* ── Clickable Header ──────────────────────────── */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-emerald-50/50 transition-colors group"
        >
          {/* Icon */}
          <div className="flex shrink-0 items-center justify-center bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-xl w-8 h-8 shadow-sm transition-transform group-hover:scale-105">
            <Target className="w-4 h-4" />
          </div>

          {/* Title text */}
          <div className="flex-1 text-left min-w-0">
            {isExpanded ? (
              <span className="text-sm font-semibold text-emerald-800">
                {goals.length} {goals.length === 1 ? 'активная цель' : goals.length < 5 ? 'активные цели' : 'активных целей'}
              </span>
            ) : (
              <span className="text-sm font-semibold text-emerald-800 block truncate">
                {goals.length === 1 ? goals[0].title : `${goals.length} цели · ${goals[0].title}`}
              </span>
            )}
          </div>

          {/* Chevron with rotation animation */}
          <ChevronDown className={`w-4 h-4 text-emerald-500 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* ── Expandable Goal List ──────────────────────── */}
        <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
          <div className="border-t border-emerald-100/60">
            {goals.map((g, index) => (
              <div
                key={g.id}
                className={`flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-emerald-50/40 ${
                  index < goals.length - 1 ? 'border-b border-emerald-100/40' : ''
                } animate-in fade-in slide-in-from-top-1`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span className="flex-1 text-sm font-medium text-emerald-900 leading-relaxed">
                  {g.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveGoal(g.id);
                  }}
                  disabled={isDeleting === g.id}
                  className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-emerald-400 hover:bg-emerald-100 hover:text-emerald-700 transition-all disabled:opacity-30"
                  title="Завершить цель"
                >
                  {isDeleting === g.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
