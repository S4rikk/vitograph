'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Activity, Apple, MessageSquare, User } from 'lucide-react';
import UserProfileSheet from '@/components/profile/UserProfileSheet';

interface BottomDockProps {
  userId: string;
  userEmail: string;
  activeTab: number;
  onTabChange: (index: number) => void;
  isMedicalDirty?: boolean;
}

export function BottomDock({ userId, userEmail, activeTab, onTabChange, isMedicalDirty }: BottomDockProps) {
  const [activeMaskX, setActiveMaskX] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [prevTab, setPrevTab] = useState(0);
  const [isProfileDirty, setIsProfileDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<number | null>(null);
  const [triggerCloseCheck, setTriggerCloseCheck] = useState(false);

  useEffect(() => {
    if (activeTab === 3) {
      setIsProfileOpen(true);
    } else {
      setIsProfileOpen(false);
      setPrevTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    const updateMaskPosition = () => {
      if (tabRefs.current[activeTab]) {
        const item = tabRefs.current[activeTab];
        if (item) {
          // Calculate the center of the active tab, then shift by half of the carriage width (72px)
          setActiveMaskX(item.offsetLeft + item.offsetWidth / 2 - 72);
        }
      }
    };

    updateMaskPosition();

    window.addEventListener('resize', updateMaskPosition);
    return () => window.removeEventListener('resize', updateMaskPosition);
  }, [activeTab]);

  const handleTabClick = (index: number) => {
    if (index === 3) {
      onTabChange(3);
    } else {
      if (isProfileOpen && isProfileDirty) {
        setPendingTab(index);
        setTriggerCloseCheck(true);
      } else {
        onTabChange(index);
        setIsProfileOpen(false);
      }
    }
  };

  const handleCloseCheckCancel = () => {
    setTriggerCloseCheck(false);
    setPendingTab(null);
  };

  const handleCloseProfile = () => {
    setIsProfileOpen(false);
    setTriggerCloseCheck(false);
    if (pendingTab !== null) {
      onTabChange(pendingTab);
      setPendingTab(null);
    } else {
      onTabChange(prevTab);
    }
  };

  const tabs = [
    { icon: <Activity size={24} />, label: 'Анализы' },
    { icon: <Apple size={24} />, label: 'Питание' },
    { 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
          <circle cx="12" cy="12" r="10" strokeDasharray="2 4" strokeOpacity="0.5" />
          <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor" fillOpacity="0.2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="8" r="1" fill="currentColor" />
          <circle cx="5" cy="16" r="1" fill="currentColor" />
        </svg>
      ), 
      label: 'Ассистент' 
    },
    { icon: <User size={24} />, label: 'Профиль', isProfile: true }
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full h-[84px] z-50">
      {/* Background Layer with Mask */}
      <div 
        className="absolute left-[-2000px] w-[4000px] h-[84px] bg-gradient-to-b from-[#1e293b]/50 to-[#0f172a]/65 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.05)] transition-transform duration-500 z-[40]" 
        style={{ 
          mask: 'url(#nav-mask)', 
          WebkitMask: 'url(#nav-mask)', 
          transform: `translateX(${activeMaskX}px)`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(20px)',
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }} 
      />

      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <mask id="nav-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="4000" height="100">
            <rect x="0" y="0" width="4000" height="100" fill="white" />
            <path d="M 2000,0 H 2024 C 2032,0 2037.6,6.4 2038.6,12 A 34 34 0 0 0 2105.4 12 C 2106.4,6.4 2112,0 2120,0 H 2144 V -100 H 2000 Z" fill="black" />
          </mask>
        </defs>
      </svg>

      {/* Container moving with the active item */}
      <div 
        className="absolute top-0 left-0 w-[144px] h-[84px] transition-transform duration-500 z-[55] pointer-events-none"
        style={{ transform: `translateX(${activeMaskX}px)`, transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <svg className="absolute top-0 left-0 w-[144px] h-[84px] overflow-visible pointer-events-none" viewBox="0 0 144 84" preserveAspectRatio="none">
          <defs>
            <linearGradient id="glass-edge-glow" x1="0" y1="0" x2="144" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="30%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="45%" stopColor="rgba(153, 246, 228, 0.4)" />
              <stop offset="50%" stopColor="rgba(94, 234, 212, 0.7)" />
              <stop offset="55%" stopColor="rgba(153, 246, 228, 0.4)" />
              <stop offset="70%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
            </linearGradient>
            <linearGradient id="glass-edge-soft" x1="0" y1="0" x2="144" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
              <stop offset="30%" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="50%" stopColor="rgba(45, 212, 191, 0.35)" />
              <stop offset="70%" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
            </linearGradient>
          </defs>
          <path d="M -1000,0 H 24 C 32,0 37.6,6.4 38.6,12 A 34 34 0 0 0 105.4 12 C 106.4,6.4 112,0 120,0 H 1144" fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="2.5" transform="translate(0, 1.5)" />
          <path d="M -1000,0 H 24 C 32,0 37.6,6.4 38.6,12 A 34 34 0 0 0 105.4 12 C 106.4,6.4 112,0 120,0 H 1144" fill="none" stroke="url(#glass-edge-soft)" strokeWidth="3" transform="translate(0, 0.5)" />
          <path d="M -1000,0 H 24 C 32,0 37.6,6.4 38.6,12 A 34 34 0 0 0 105.4 12 C 106.4,6.4 112,0 120,0 H 1144" fill="none" stroke="url(#glass-edge-glow)" strokeWidth="1.2" transform="translate(0, 0.5)" />
        </svg>
        {/* Floating Circle */}
        <div 
          className="absolute top-[-22px] left-[44px] w-[56px] h-[56px] rounded-full backdrop-blur-[10px] pointer-events-auto"
          style={{
            background: 'radial-gradient(circle at 50% 110%, rgba(20, 184, 166, 0.25) 0%, transparent 55%), linear-gradient(180deg, rgba(30, 41, 59, 0.82) 0%, rgba(15, 23, 42, 0.96) 100%)',
            boxShadow: 'inset 0 1.5px 1px rgba(255, 255, 255, 0.25), inset 0 -2px 10px rgba(0, 0, 0, 0.8), inset 0 -5px 15px rgba(20, 184, 166, 0.2), 0 10px 20px rgba(0, 0, 0, 0.5)'
          }}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="relative flex h-full items-center justify-between px-2">
        {tabs.map((tab, index) => {
          const isActive = activeTab === index;
          
          const buttonContent = (
            <button
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              onClick={() => handleTabClick(index)}
              className={`flex-1 h-full flex flex-col items-center justify-center relative cursor-pointer outline-none ${isActive ? 'z-[60]' : 'z-[50]'}`}
              type="button"
            >
              <div 
                className={`absolute top-[30px] flex items-center justify-center`}
                style={{
                  transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.15s ease-out 0.4s',
                  transform: isActive ? 'translateY(-36px)' : 'translateY(0px)',
                  color: isActive ? '#2dd4bf' : '#64748b'
                }}
              >
                <div style={{
                  transition: 'filter 0.15s ease-out 0.4s',
                  filter: isActive ? 'drop-shadow(0 0 4px rgba(45, 212, 191, 0.9)) drop-shadow(0 0 12px rgba(20, 184, 166, 0.6))' : 'none'
                }}>
                  {React.cloneElement(tab.icon as React.ReactElement<any>, {
                    strokeWidth: isActive ? 2.2 : 2.5,
                    style: { transition: 'stroke-width 0.15s ease-out 0.4s' }
                  })}
                </div>
                {/* Блик-отражение на кромке выреза (верхний блик) */}
                <div 
                  className="absolute left-1/2 -translate-x-1/2 w-[12px] h-[1px] rounded-full pointer-events-none"
                  style={{
                    bottom: '-22px',
                    background: 'rgba(45, 212, 191, 0.8)',
                    boxShadow: '0 0 5px 2px rgba(45, 212, 191, 0.8), 0 0 12px 3px rgba(20, 184, 166, 0.5)',
                    filter: 'blur(1.5px)',
                    opacity: isActive ? 1 : 0,
                    transition: isActive ? 'opacity 0.15s ease-out 0.4s' : 'opacity 0s',
                  }}
                />
              </div>

              {/* Мягкий рассеянный блик на самом низу плашки */}
              <div 
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[16px] h-[1px] rounded-full pointer-events-none"
                style={{
                  background: 'rgba(20, 184, 166, 0.4)',
                  boxShadow: '0 -1px 6px 2px rgba(20, 184, 166, 0.5), 0 -3px 12px 3px rgba(20, 184, 166, 0.2)',
                  filter: 'blur(1.5px)',
                  opacity: isActive ? 1 : 0,
                  transition: isActive ? 'opacity 0.15s ease-out 0.4s' : 'opacity 0s',
                }}
              />

              <span 
                className={`absolute bottom-[14px] text-[11px] font-semibold tracking-[0.3px] transition-all duration-500 ${isActive ? 'opacity-100 translate-y-0 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'opacity-0 translate-y-[16px] text-[#ffffff]'}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                {tab.label}
              </span>
            </button>
          );

          if (tab.isProfile) {
            return (
              <UserProfileSheet 
                key={index} 
                userId={userId} 
                userEmail={userEmail}
                isOpen={isProfileOpen}
                onClose={handleCloseProfile}
                isDirtyChange={setIsProfileDirty}
                triggerCloseCheck={triggerCloseCheck}
                onCloseCheckCancel={handleCloseCheckCancel}
              >
                {buttonContent}
              </UserProfileSheet>
            );
          }

          return (
            <React.Fragment key={index}>
              {buttonContent}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
