"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Database, 
  Settings, 
  LayoutDashboard, 
  ChevronLeft,
  Menu,
  X
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Knowledge Base", href: "/admin/knowledge", icon: Database },
  { name: "AI Settings", href: "/admin/ai-settings", icon: Settings },
];

export default function AdminSidebar({ currentUserId }: { currentUserId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Top Navigation */}
      <div className="md:hidden sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Database className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-semibold text-slate-100 tracking-wide text-sm">VITOGRAPH</h2>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside className={clsx(
        "fixed md:sticky top-0 left-0 z-50 h-[100dvh] w-64 border-r border-white/10 bg-slate-950 bg-opacity-95 backdrop-blur-xl flex flex-col pt-6 pb-4 px-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center gap-3 mb-10 px-2 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 tracking-wide text-sm">VITOGRAPH</h2>
              <p className="text-[10px] uppercase font-mono text-slate-500 tracking-widest">Admin Console</p>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white p-1" onClick={() => setIsOpen(false)}>
             <X className="w-5 h-5"/>
          </button>
        </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
              )}
            >
              <item.icon className={clsx("w-4 h-4 transition-transform duration-200", isActive ? "scale-110 text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-white/10 mt-auto space-y-1">
        <Link 
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all duration-200 group"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform duration-200 group-hover:-translate-x-1" />
          Back to App
        </Link>
      </div>
    </aside>
    </>
  );
}
