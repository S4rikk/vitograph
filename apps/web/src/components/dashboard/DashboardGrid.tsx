'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { DashboardCard } from './DashboardCard';
import { CloudUpload, LineChart, HeartPulse, FileText, CheckCircle, TrendingUp, Sparkles, Activity, FilePlus, Mic, PieChart, ScanFace, Camera } from 'lucide-react';

interface DashboardGridProps {
  alertSymptoms?: 'normal' | 'fatigue' | 'bad' | 'inactive' | null;
  onCardClick: (screen: 'upload' | 'reports' | 'symptoms' | 'photo') => void;
}

export function DashboardGrid({ alertSymptoms, onCardClick }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3.5 flex-1 min-h-0">
      {/* Left Column */}
      <div className="flex flex-col gap-3.5 h-full min-h-0">
        <DashboardCard
          icon={<FilePlus size={24} />}
          title={<>Подача<br />анализов</>}
          subtitle="Загрузить"
          subtitleIcon={<CloudUpload size={14} />}
          accentColor="teal"
          height="tall"
          badge="PDF/Фото"
          backgroundIcon={<Mic size={120} />}
          onClick={() => onCardClick('upload')}
          bgOpacity={0.4}
          blurAmount={24}
          gradientOpacity={0.8}
        />
        <DashboardCard
          icon={<LineChart size={24} />}
          title={<>Отчеты по<br />анализам</>}
          subtitle="Динамика"
          subtitleIcon={<TrendingUp size={14} />}
          accentColor="indigo"
          height="short"
          backgroundIcon={<PieChart size={120} />}
          onClick={() => onCardClick('reports')}
          bgOpacity={0.75}
          blurAmount={0}
          gradientOpacity={0.75}
        />
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-3.5 h-full min-h-0">
        <DashboardCard
          icon={<Activity size={24} />}
          title={<>Симптомы<br />сегодня</>}
          subtitle="Чек-ап"
          subtitleIcon={<CheckCircle size={14} />}
          accentColor="rose"
          height="short"
          alertIndicator={alertSymptoms}
          backgroundIcon={<HeartPulse size={120} />}
          onClick={() => onCardClick('symptoms')}
          bgOpacity={0.6}
          blurAmount={18}
          gradientOpacity={0.8}
        />
        <DashboardCard
          icon={<ScanFace size={24} />}
          title={<>Фото<br />диагностика</>}
          subtitle="Умная камера"
          subtitleIcon={<Sparkles size={14} />}
          accentColor="purple"
          height="tall"
          badge="AI-анализ"
          backgroundIcon={<Camera size={120} />}
          onClick={() => onCardClick('photo')}
          bgOpacity={0.4}
          blurAmount={24}
          gradientOpacity={0.8}
        />
      </div>
    </div>
  );
}
