'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Frown, Battery, Meh, Smile, Zap } from 'lucide-react';

/**
 * WellbeingWidget Component
 * 
 * Allows users to track their daily wellbeing on a scale from 0 to 4.
 * Uses a Glassmorphism design style with sliding radial-gradient glow effect.
 */
interface WellbeingWidgetProps {
  onMoodSelect?: (mood: number) => void;
}

export function WellbeingWidget({ onMoodSelect }: WellbeingWidgetProps) {
  const t = useTranslations('wellbeing');
  const [supabase] = useState(() => createClient());
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  useEffect(() => {
    const fetchMood = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Get current local date in YYYY-MM-DD format
      const today = new Date().toLocaleDateString('en-CA');
      
      const { data, error } = await supabase
        .from('daily_symptoms')
        .select('wellbeing')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
        
      if (!error && data && data.wellbeing !== null) {
        setSelectedMood(data.wellbeing);
      }
    };
    
    fetchMood();
  }, [supabase]);

  const handleSelect = async (mood: number) => {
    setSelectedMood(mood);
    if (onMoodSelect) onMoodSelect(mood);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const today = new Date().toLocaleDateString('en-CA');
    
    await supabase
      .from('daily_symptoms')
      .upsert(
        { user_id: user.id, date: today, wellbeing: mood },
        { onConflict: 'user_id, date' }
      );
  };

  const getMoodConfig = (mood: number) => {
    switch(mood) {
      case 0: return { icon: <Frown size={24} />, text: 'Плохо', color: 'text-rose-500', gradient: 'radial-gradient(circle at center, rgba(244,63,94,0.60) 0%, rgba(244,63,94,0) 70%)', badgeBg: 'bg-rose-500/45', badgeText: 'text-white' };
      case 1: return { icon: <Battery size={24} />, text: 'Усталость', color: 'text-amber-400', gradient: 'radial-gradient(circle at center, rgba(245,158,11,0.50) 0%, rgba(245,158,11,0) 70%)', badgeBg: 'bg-amber-500/45', badgeText: 'text-white' };
      case 2: return { icon: <Meh size={24} />, text: 'Нормально', color: 'text-slate-300', gradient: 'radial-gradient(circle at center, rgba(148,163,184,0.40) 0%, rgba(148,163,184,0) 70%)', badgeBg: 'bg-slate-500/45', badgeText: 'text-white' };
      case 3: return { icon: <Smile size={24} />, text: 'Хорошо', color: 'text-teal-400', gradient: 'radial-gradient(circle at center, rgba(20,184,166,0.50) 0%, rgba(20,184,166,0) 70%)', badgeBg: 'bg-teal-500/55', badgeText: 'text-white' };
      case 4: return { icon: <Zap size={24} />, text: 'Бодрость', color: 'text-indigo-400', gradient: 'radial-gradient(circle at center, rgba(99,102,241,0.60) 0%, rgba(99,102,241,0) 70%)', badgeBg: 'bg-indigo-500/45', badgeText: 'text-white' };
      default: return null;
    }
  };

  return (
    <div className="mb-2 py-3 px-4 relative transition-all duration-300 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-md">
      <div className="flex justify-between items-center mb-2 px-1.5">
        <span className="text-white/90 font-semibold text-xs tracking-tight">Как ваше самочувствие сегодня?</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/5 transition-all duration-300 ${selectedMood !== null ? getMoodConfig(selectedMood)?.badgeBg + ' ' + getMoodConfig(selectedMood)?.badgeText : 'text-slate-400 bg-white/5'}`}>
          {selectedMood !== null ? getMoodConfig(selectedMood)?.text : 'Выбрать'}
        </span>
      </div>
      
      <div className="relative bg-[#1e293b]/25 border border-white/5 rounded-full p-1 flex justify-between items-center h-[68px]">
        {selectedMood !== null && (
          <div 
            className="absolute top-[-9px] w-[18%] ml-[1%] aspect-square rounded-full transition-transform duration-300 ease-out z-0 pointer-events-none blur-[10px]"
            style={{ 
              transform: `translateX(${selectedMood * 105.5}%)`,
              background: getMoodConfig(selectedMood)?.gradient,
            }}
          />
        )}
        
        {[0, 1, 2, 3, 4].map((mood) => {
          const config = getMoodConfig(mood);
          const isSelected = selectedMood === mood;
          
          return (
            <button
              key={mood}
              onClick={() => handleSelect(mood)}
              className={`relative z-10 flex-1 py-2 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-300 active:scale-95 cursor-pointer ${
                isSelected ? config?.color : 'text-slate-400 hover:text-white/70'
              }`}
              type="button"
              aria-label={config?.text}
            >
              <div className={`transition-all duration-300 ${isSelected ? 'opacity-100' : 'opacity-60'}`}>
                {config?.icon}
              </div>
              <span className={`text-[9px] font-medium transition-colors ${isSelected ? 'text-white' : ''}`}>
                {config?.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
