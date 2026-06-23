'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Bell } from 'lucide-react';
import Logo from '@/components/ui/Logo';

export function DashboardHeader() {
  const t = useTranslations('dashboard_header');
  const [supabase] = useState(() => createClient());
  const [firstName, setFirstName] = useState<string>('');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .limit(1);

      if (data && data.length > 0 && data[0].display_name) {
        setFirstName(data[0].display_name.split(' ')[0]);
      }
    };

    fetchProfile();
  }, [supabase]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t('greeting_morning');
    if (hour >= 12 && hour < 18) return t('greeting_afternoon');
    if (hour >= 18 && hour < 23) return t('greeting_evening');
    return t('greeting_night');
  };

  return (
    <header className="flex justify-between items-start mb-2 relative z-10 pt-2">
      <div className="flex flex-col">
        {/* Логотип */}
        <div className="flex items-center mb-1.5">
          <Logo size="lg" showSubtitle={true} />
        </div>
        
        {/* Приветствие */}
        <div className="pl-1">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight whitespace-nowrap">
            {firstName?.trim() ? `${getGreeting()}, ${firstName.trim()}!` : `${getGreeting()}!`}
          </h1>
        </div>
      </div>

      {/* Уведомления (стеклянная кнопка) */}
      <button className="w-14 h-14 mr-1 rounded-full bg-[#1e293b]/40 border border-white/10 flex items-center justify-center relative backdrop-blur-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] card-glass hover:bg-[#1e293b]/60 transition-colors">
        <Bell size={24} className="text-teal-300 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]" />
        <span className="absolute top-3.5 right-3.5 w-3 h-3 bg-teal-400 rounded-full border-2 border-[#020617] shadow-[0_0_8px_rgba(45,212,191,0.8)]"></span>
      </button>
    </header>
  );
}
