"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TabSwitcher from "@/components/ui/TabSwitcher";
import MedicalResultsView from "@/components/medical/MedicalResultsView";
import FoodDiaryView from "@/components/diary/FoodDiaryView";
import AiAssistantView from "@/components/assistant/AiAssistantView";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import Logo from "@/components/ui/Logo";

/* ── SVG Icons ────────────────────────────────────────────── */

function MedicalIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
      />
    </svg>
  );
}

function DiaryIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function AssistantIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" strokeDasharray="2 4" strokeOpacity="0.5" />
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="8" r="1" fill="currentColor" />
      <circle cx="5" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

/* ── Tabs config ──────────────────────────────────────────── */

const TABS = [
  { id: "medical", label: "Анализы", icon: <MedicalIcon /> },
  { id: "diary", label: "Дневник", icon: <DiaryIcon /> },
  { id: "assistant", label: "Ассистент", icon: <AssistantIcon /> },
];

function HomeContent({ needsOnboarding, userId }: { needsOnboarding: boolean; userId: string }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab = ["diary", "medical", "assistant"].includes(tabParam || "") ? tabParam! : "medical";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const router = useRouter();

  if (needsOnboarding) {
    return <OnboardingWizard userId={userId} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-2 sm:px-6 lg:px-8 sm:py-8 flex-1 flex flex-col min-h-0 sm:h-full">
      {/* ── Header ────────────────────────────────────────── */}
      <header className="hidden sm:flex shrink-0 mb-8 justify-center">
        <Logo size="lg" showSubtitle={true} />
      </header>

      {/* ── Tab Switcher ──────────────────────────────────── */}
      <div className="flex justify-center shrink-0 mt-2 mb-2 sm:mt-0 sm:mb-8">
        <TabSwitcher
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tabId) => {
            setActiveTab(tabId);
            router.replace(`?tab=${tabId}`, { scroll: false });
          }}
        />
      </div>

      {/* ── Tab Panels ────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0">
        <div
          id="panel-medical"
          role="tabpanel"
          aria-labelledby="tab-medical"
          hidden={activeTab !== "medical"}
          className="flex-1 flex flex-col min-h-0 overflow-y-auto sm:overflow-visible"
        >
          <MedicalResultsView />
        </div>

        <div
          id="panel-diary"
          role="tabpanel"
          aria-labelledby="tab-diary"
          hidden={activeTab !== "diary"}
          className="flex-1 flex flex-col min-h-0 overflow-y-auto sm:overflow-visible"
        >
          <FoodDiaryView />
        </div>

        <div
          id="panel-assistant"
          role="tabpanel"
          aria-labelledby="tab-assistant"
          hidden={activeTab !== "assistant"}
          className="flex-1 flex flex-col min-h-0"
        >
          <AiAssistantView userId={userId} />
        </div>
      </main>
    </div>
  );
}

export default function ClientPage({ needsOnboarding, userId }: { needsOnboarding: boolean; userId: string }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-ink-muted">Loading interface...</div>}>
      <HomeContent needsOnboarding={needsOnboarding} userId={userId} />
    </Suspense>
  );
}
