"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Network, Loader2, AlertCircle, Share2, Info } from "lucide-react";

export default function SystemGraphPage() {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const content = await apiClient.getSystemGraphHtml();
        setHtml(content);
      } catch (err: any) {
        console.error("[FETCH_GRAPH_ERROR]", err);
        setError(err.message || "Failed to load system architecture graph");
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, []);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Network className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              System Architecture
            </h1>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl mt-2 leading-relaxed">
            Interactive map of the <span className="text-blue-400 font-semibold">VITOGRAPH</span> ecosystem. 
            This visualization displays real-time structural relationships between microservices, 
            data models, and AI nodes.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono uppercase tracking-widest text-blue-400/80 backdrop-blur-sm">
          <Share2 className="w-3 h-3" />
          <span>Investor View Mode</span>
        </div>
      </div>

      {/* Main Visualization Container */}
      <div className="flex-1 min-h-[70vh] rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl overflow-hidden relative group ring-1 ring-white/5 shadow-2xl">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent z-10" />
        
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 z-20 backdrop-blur-xl">
            <div className="relative">
               <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
               <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4 relative z-10" />
            </div>
            <p className="text-slate-100 font-medium text-sm mb-1">Mapping Architecture</p>
            <p className="text-slate-500 font-mono text-[10px] tracking-widest uppercase animate-pulse">Initializing nodes...</p>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100">Visualization Failed</h3>
            <p className="text-slate-400 max-w-md mt-2 mb-8 leading-relaxed">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-2.5 bg-slate-100 hover:bg-white text-slate-950 font-semibold rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg"
            >
              Retry Initialization
            </button>
          </div>
        ) : html ? (
          <iframe 
            srcDoc={html} 
            className="w-full h-full border-0 transition-opacity duration-1000 ease-in" 
            style={{ opacity: loading ? 0 : 1 }}
            title="System Graph"
          />
        ) : null}

        {/* Floating Info Badge */}
        {!loading && !error && (
          <div className="absolute bottom-6 right-6 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 backdrop-blur-md shadow-xl text-slate-300 pointer-events-none group-hover:opacity-100 opacity-40 transition-opacity duration-500">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium">Use mouse to zoom & drag nodes</span>
          </div>
        )}
      </div>

      {/* Investor Talking Points */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Modularity", value: "High", desc: "Decoupled agentic layers ensuring independent scaling." },
          { label: "Connectivity", value: "Neural", desc: "Real-time state synchronization via LangGraph checkpointers." },
          { label: "Complexity", value: "Enterprise", desc: "900+ active nodes mapping medical & AI logic." }
        ].map((stat, i) => (
          <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/[0.07] transition-colors">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{stat.label}</p>
            <p className="text-lg font-bold text-slate-200 mb-1">{stat.value}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{stat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
