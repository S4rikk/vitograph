"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { deleteKnowledgeDocument } from "./actions";

interface Props {
  id: number;
  title: string;
}

export default function DeleteDocumentButton({ id, title }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteKnowledgeDocument(id);
      if (result?.error) {
        setError(result.error);
        setIsDeleting(false);
      } else {
        setIsOpen(false);
        // Note: the component will unmount soon as the table refreshes via revalidatePath
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
        title="Delete Document"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]" 
            onClick={() => !isDeleting && setIsOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 animate-fade-in-up">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            
            <h3 className="text-xl font-medium text-white mb-2">Delete Document</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Are you sure you want to delete <span className="text-slate-200 font-medium whitespace-nowrap">"{title}"</span>? 
              This action is <strong className="text-red-400 font-medium">irreversible</strong> and will permanently remove all associated vector embeddings and chunks from the database.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 disabled:opacity-50 px-5 py-2.5 rounded-lg font-medium transition-all"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
