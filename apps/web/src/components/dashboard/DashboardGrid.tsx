'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { DashboardCard } from './DashboardCard';
import { CloudUpload, LineChart, HeartPulse, FileText, CheckCircle, TrendingUp, Sparkles, Activity, FilePlus, Mic, PieChart, ScanFace, Camera } from 'lucide-react';

interface DashboardGridProps {
  alertSymptoms?: boolean;
  onCardClick: (screen: 'upload' | 'reports' | 'symptoms' | 'photo') => void;
}

export function DashboardGrid({ alertSymptoms, onCardClick }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left Column */}
      <div className="flex flex-col gap-4">
        <DashboardCard
          icon={<FilePlus size={24} />}
          title="Подача анализов"
          subtitle="Загрузить"
          subtitleIcon={<CloudUpload size={14} />}
          accentColor="teal"
          height="tall"
          badge="PDF/Фото"
          backgroundIcon={<Mic size={120} />}
          onClick={() => onCardClick('upload')}
        />
        <DashboardCard
          icon={<LineChart size={24} />}
          title="Отчеты по анализам"
          subtitle="Динамика"
          subtitleIcon={<TrendingUp size={14} />}
          accentColor="indigo"
          height="short"
          backgroundIcon={<PieChart size={120} />}
          onClick={() => onCardClick('reports')}
        />
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-4">
        <DashboardCard
          icon={<Activity size={24} />}
          title="Симптомы сегодня"
          subtitle="Чек-ап"
          subtitleIcon={<CheckCircle size={14} />}
          accentColor="rose"
          height="short"
          alertIndicator={alertSymptoms}
          backgroundIcon={<HeartPulse size={120} />}
          onClick={() => onCardClick('symptoms')}
        />
        <DashboardCard
          icon={<ScanFace size={24} />}
          title="Фото диагностика"
          subtitle="Умная камера"
          subtitleIcon={<Sparkles size={14} />}
          accentColor="purple"
          height="tall"
          badge="AI-анализ"
          backgroundIcon={<Camera size={120} />}
          onClick={() => onCardClick('photo')}
        />
      </div>
    </div>
  );
}
