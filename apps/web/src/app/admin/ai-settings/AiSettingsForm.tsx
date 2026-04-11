"use client";

import { useState } from "react";
import { updateAppConfigItem } from "./actions";
import { Check, AlertCircle, Loader2, Save } from "lucide-react";

const MODELS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano"
];

const LLM_KEYS = [
  { key: "diary_llm", title: "Food Diary LLM" },
  { key: "analysis_llm", title: "Diagnostic Analysis LLM" },
  { key: "agent_llm", title: "Core Assistant LLM" }
];

export default function AiSettingsForm({ initialConfig }: { initialConfig: Record<string, string> }) {
  const [config, setConfig] = useState<Record<string, string>>({
    diary_llm: initialConfig["diary_llm"] || "gpt-5.4-mini",
    analysis_llm: initialConfig["analysis_llm"] || "gpt-5.4",
    agent_llm: initialConfig["agent_llm"] || "gpt-5.4",
    ...initialConfig
  });
  
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});
  const [successKeys, setSuccessKeys] = useState<Record<string, boolean>>({});
  const [errorObj, setErrorObj] = useState<string | null>(null);

  const [rawKeyInputs, setRawKeyInputs] = useState<Record<string, string>>({});

  const handleUpdate = async (key: string, value: string) => {
    setErrorObj(null);
    setLoadingKeys(prev => ({ ...prev, [key]: true }));
    setSuccessKeys(prev => ({ ...prev, [key]: false }));
    
    try {
      await updateAppConfigItem(key, value);
      setConfig(prev => ({ ...prev, [key]: value }));
      setSuccessKeys(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setSuccessKeys(prev => ({ ...prev, [key]: false })), 2000);
    } catch (err: any) {
      setErrorObj(`Failed to update ${key}: ${err.message || "Unknown error"}`);
    } finally {
      setLoadingKeys(prev => ({ ...prev, [key]: false }));
    }
  };

  const hiddenSystemKeys = ["service_role_key", "edge_function_url", "kb_ingest_edge_function_url"];

  return (
    <div className="space-y-8">
      {errorObj && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{errorObj}</p>
        </div>
      )}

      {/* Model Selection Block */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 glass">
        <h2 className="text-lg font-medium text-white mb-6">Model Allocations</h2>
        
        <div className="space-y-6">
          {LLM_KEYS.map((item) => (
            <div key={item.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-white/5 last:border-0 last:pb-0">
              <div>
                <label className="text-sm font-medium text-white block mb-0.5">{item.title}</label>
                <span className="text-xs text-slate-500 font-mono">{item.key}</span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select 
                  value={config[item.key] || ""}
                  onChange={(e) => handleUpdate(item.key, e.target.value)}
                  disabled={loadingKeys[item.key]}
                  className="w-full sm:w-64 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 appearance-none disabled:opacity-50"
                >
                  <option value="" disabled>Select a model...</option>
                  {MODELS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                
                <div className="w-6 shrink-0 flex justify-center">
                  {loadingKeys[item.key] && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                  {successKeys[item.key] && <Check className="w-4 h-4 text-green-400" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced System Tokens */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 glass opacity-80 hover:opacity-100 transition-opacity duration-300">
        <h2 className="text-lg font-medium text-white mb-6">Advanced System Config</h2>
        <div className="space-y-5">
          {Object.entries(config)
            .filter(([key]) => !LLM_KEYS.some(l => l.key === key))
            .map(([key, val]) => (
            <div key={key} className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 font-mono">{key}</label>
              <div className="flex gap-2">
                <input 
                  type={hiddenSystemKeys.includes(key) ? "password" : "text"}
                  defaultValue={val}
                  onChange={(e) => setRawKeyInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                  placeholder="Empty..."
                />
                <button
                  onClick={() => {
                    const newValue = rawKeyInputs[key];
                    if (newValue !== undefined && newValue !== val) {
                      handleUpdate(key, newValue);
                    }
                  }}
                  disabled={loadingKeys[key] || (rawKeyInputs[key] === undefined || rawKeyInputs[key] === val)}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[100px]"
                >
                  {loadingKeys[key] ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : successKeys[key] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
