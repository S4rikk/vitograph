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
      className="inline-flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm border border-border"
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
              cursor-pointer relative flex items-center gap-2 rounded-lg px-5 py-2.5
              text-sm font-medium transition-all duration-200 select-none
              ${
                isActive
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-ink-muted hover:text-ink hover:bg-surface-hover"
              }
            `}
          >
            <span className="w-5 h-5 flex-shrink-0">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
