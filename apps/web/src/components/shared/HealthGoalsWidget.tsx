"use client";

import React, { useEffect, useState } from "react";
import { Target, X, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
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

  const displayedGoals = isExpanded ? goals : goals.slice(0, 1);
  const hasMore = goals.length > 1;

  return (
    <div className="flex items-start gap-3 px-3 sm:px-6 pt-2 pb-2 bg-gradient-to-b from-slate-50/50 to-transparent">
      {/* Icon indicator */}
      <div 
        className={`flex shrink-0 items-center justify-center mt-0.5 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-xl w-8 h-8 shadow-sm transition-all ${hasMore ? "cursor-pointer hover:shadow hover:scale-105" : ""}`}
        onClick={() => hasMore && setIsExpanded(!isExpanded)}
      >
        <Target className="w-4 h-4" />
      </div>
      
      {/* List of goals */}
      <div className="flex flex-wrap items-center gap-2">
        {displayedGoals.map((g) => (
          <div 
            key={g.id} 
            className="group relative flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/50 bg-emerald-50/60 py-1 sm:py-1.5 pl-3 pr-1.5 text-sm font-semibold text-emerald-800 shadow-sm transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-100 hover:shadow animate-in fade-in zoom-in-95"
          >
            <Sparkles className="w-3 h-3 text-emerald-500 opacity-70" />
            <span className="truncate max-w-[220px] tracking-tight">{g.title}</span>
            <button 
              onClick={() => handleRemoveGoal(g.id)}
              disabled={isDeleting === g.id}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-emerald-500 opacity-50 transition-all hover:bg-white hover:text-emerald-700 hover:opacity-100 hover:shadow-sm disabled:opacity-30 cursor-pointer"
              title="Завершить цель"
            >
              {isDeleting === g.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3 cursor-pointer" />
              )}
            </button>
          </div>
        ))}

        {!isExpanded && hasMore && (
          <button 
            onClick={() => setIsExpanded(true)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white py-1 sm:py-1.5 px-2.5 text-[13px] font-semibold text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-700 cursor-pointer animate-in fade-in"
          >
            +{goals.length - 1} <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
        )}
        
        {isExpanded && hasMore && (
          <button 
            onClick={() => setIsExpanded(false)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white py-1 sm:py-1.5 px-2.5 text-[13px] font-semibold text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-700 cursor-pointer animate-in fade-in"
          >
            Свернуть <ChevronUp className="w-3.5 h-3.5 opacity-70" />
          </button>
        )}
      </div>
    </div>
  );
}
