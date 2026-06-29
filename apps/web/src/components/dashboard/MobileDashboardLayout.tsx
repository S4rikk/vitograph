'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/hooks/useIsMobile';
import { DashboardHeader } from './DashboardHeader';
import { WellbeingWidget } from './WellbeingWidget';
import { DashboardGrid } from './DashboardGrid';
import { BottomDock } from './BottomDock';
import MedicalResultsView from '@/components/medical/MedicalResultsView';
import Logo from '@/components/ui/Logo';

// Lazy load heavy components on mobile to optimize loading times and avoid hydration issues
const FoodDiaryView = dynamic(() => import('@/components/diary/FoodDiaryView'), { ssr: false });
const AiAssistantView = dynamic(() => import('@/components/assistant/AiAssistantView'), { ssr: false });

interface MobileDashboardLayoutProps {
  userId: string;
  userEmail: string;
  desktopChildren: React.ReactNode;
}

export function MobileDashboardLayout({ userId, userEmail, desktopChildren }: MobileDashboardLayoutProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(0);
  const [subScreen, setSubScreen] = useState<'hub' | 'upload' | 'reports' | 'symptoms' | 'photo'>('hub');
  const [isMedicalDirty, setIsMedicalDirty] = useState(false);
  const [prevActiveTab, setPrevActiveTab] = useState(0);
  const [alertSymptoms, setAlertSymptoms] = useState<'normal' | 'fatigue' | 'bad' | 'inactive' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize the last active non-profile tab
  useEffect(() => {
    if (activeTab !== 3) {
      setPrevActiveTab(activeTab);
    }
  }, [activeTab]);

  const displayTab = activeTab === 3 ? prevActiveTab : activeTab;

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 320); // 320ms is the sweet spot allowing the bottom dock transition to fly without CPU lockup
    return () => clearTimeout(timer);
  }, [displayTab]);

  const handleMoodChange = (mood: number | null) => {
    if (mood === 0) {
      setAlertSymptoms('bad');
    } else if (mood === 1) {
      setAlertSymptoms('fatigue');
    } else if (mood === 2) {
      setAlertSymptoms('normal');
    } else if (mood === 3 || mood === 4) {
      setAlertSymptoms('inactive');
    } else {
      setAlertSymptoms(null);
    }
  };

  const handleTabChange = (index: number) => {
    if (isMedicalDirty && activeTab === 0 && index !== 0) {
      const confirmLeave = window.confirm("У вас есть несохраненные изменения в биомаркерах. Вы уверены, что хотите покинуть страницу?");
      if (!confirmLeave) return;
    }
    setActiveTab(index);
  };

  if (!mounted) {
    return (
      <div className="dark h-[100dvh] sm:h-[calc(100dvh-32px)] w-full sm:max-w-[440px] sm:mx-auto sm:my-4 sm:rounded-[36px] sm:border sm:border-white/10 sm:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] bg-[#050B14] flex flex-col items-center justify-center relative overflow-hidden">
        {/* DNA Raster background */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/dna_raster.png" 
            alt="DNA Background" 
            className="w-full h-full object-cover object-center opacity-40 transition-all duration-75 blur-[20px]" 
            style={{ transform: 'rotate(180deg) scale(1.1)' }} 
          />
        </div>
        
        {/* Animated logo container */}
        <div className="relative z-10 animate-pulse duration-1000 flex flex-col items-center justify-center splash-logo">
          <Logo size="lg" showSubtitle={false} />
        </div>
      </div>
    );
  }

  if (!isMobile) {
    return <>{desktopChildren}</>;
  }

  return (
    <div className="dark h-[100dvh] sm:h-[calc(100dvh-32px)] w-full sm:max-w-[440px] sm:mx-auto sm:my-4 sm:rounded-[36px] sm:border sm:border-white/10 sm:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] bg-[#050B14] text-white flex flex-col pb-[84px] relative overflow-hidden">
      {/* Растровый фон ДНК */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/dna_raster.png" 
            alt="DNA Background" 
            className="w-full h-full object-cover object-center opacity-90 transition-all duration-75" 
            style={{ filter: 'blur(10px) brightness(1) contrast(1)', transform: 'rotate(180deg) translate(-30px, 0px) scaleX(1) scaleY(1)' }} 
          />
        </div>
        {/* Легкие градиенты для интеграции с цветами карточек */}
        <div className="absolute -top-[10%] -left-[20%] w-[70%] h-[40%] bg-teal-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
      </div>

      {displayTab === 0 && (
        <div className="flex-grow flex flex-col min-h-0 relative z-10">
          {subScreen === 'hub' ? (
            <div className="flex-grow flex flex-col px-5 pt-3 pb-1.5 min-h-0 relative">
              <DashboardHeader />
              <div>
                <WellbeingWidget onMoodSelect={handleMoodChange} />
              </div>
              <DashboardGrid alertSymptoms={alertSymptoms} onCardClick={setSubScreen} />
            </div>
          ) : (
            <div className="flex-grow flex flex-col px-5 pt-3 pb-2 min-h-0 relative overflow-y-auto pb-[84px]">
              <MedicalResultsView
                activeSubScreen={subScreen}
                onBack={() => setSubScreen('hub')}
                isDirtyChange={setIsMedicalDirty}
                onNavigate={setSubScreen}
              />
            </div>
          )}
        </div>
      )}

      {displayTab === 1 && (
        <div className="flex-grow flex flex-col min-h-0 relative z-10">
          <div className="flex-1 min-h-0 relative">
            {!isTransitioning && <FoodDiaryView />}
          </div>
        </div>
      )}

      {displayTab === 2 && (
        <div className="flex-grow flex flex-col min-h-0 relative z-10">
          <div className="flex-1 min-h-0 relative">
            {!isTransitioning && <AiAssistantView userId={userId} />}
          </div>
        </div>
      )}

      <BottomDock 
        userId={userId} 
        userEmail={userEmail} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        isMedicalDirty={isMedicalDirty} 
      />
    </div>
  );
}
