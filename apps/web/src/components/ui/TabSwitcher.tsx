"use client";

import { useState } from "react";

type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

type TabSwitcherProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
};

/**
 * Pill-style tab switcher with animated active indicator.
 *
 * Renders horizontally centered tabs with smooth color transitions.
 * Active tab is highlighted with a teal pill background.
 */
export default function TabSwitcher({
  tabs,
  activeTab,
  onTabChange,
}: TabSwitcherProps) {
  return (
    <nav
      role="tablist"
      aria-label="Main navigation"
      className="flex w-full overflow-x-auto hide-scrollbar sm:inline-flex sm:w-auto items-center gap-1 sm:gap-2 rounded-xl bg-white p-1 shadow-sm border border-border"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`
              cursor-pointer relative flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-lg px-3 sm:px-5 py-2.5
              text-[13px] sm:text-sm font-medium transition-all duration-200 select-none whitespace-nowrap
              ${
                isActive
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-ink-muted hover:text-ink hover:bg-surface-hover"
              }
            `}
          >
            <span className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
