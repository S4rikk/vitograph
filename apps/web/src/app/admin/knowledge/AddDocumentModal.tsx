"use client";

import { useState } from "react";
import { createKbDocument } from "./actions";
import { Plus, X, Loader2, AlertCircle } from "lucide-react";

export default function AddDocumentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    "nutrition", "supplements", "lifestyle", 
    "diagnostics", "mental_health", "sleep", 
    "exercise", "condition_protocol", "biohacking", "general"
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    try {
      const result = await createKbDocument(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setIsOpen(false);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-white text-slate-950 hover:bg-slate-200 px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4" />
        New Document
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !loading && setIsOpen(false)} />
          
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
              <h2 className="text-xl font-medium text-white">Add Knowledge Document</h2>
              <button 
                onClick={() => !loading && setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1.5">Document Title</label>
                <input 
                  type="text" 
                  id="title"
                  name="title" 
                  required
                  disabled={loading}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                  placeholder="e.g. Magnesium Supplementation Protocol"
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue=""
                  disabled={loading}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 appearance-none"
                >
                  <option value="" disabled>Select category...</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="source_markdown" className="block text-sm font-medium text-slate-300 mb-1.5">Source Content (Markdown)</label>
                <textarea
                  id="source_markdown"
                  name="source_markdown"
                  required
                  disabled={loading}
                  rows={8}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-mono resize-y"
                  placeholder="# Header&#10;&#10;Content here..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-white hover:bg-slate-200 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save to Pending
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
