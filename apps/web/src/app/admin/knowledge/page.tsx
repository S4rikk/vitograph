import { createClient } from "@/lib/supabase/server";
import AddDocumentModal from "./AddDocumentModal";
import DeleteDocumentButton from "./DeleteDocumentButton";
import { FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowledge Base | Admin | VITOGRAPH",
};

export default async function KnowledgeBasePage() {
  const supabase = await createClient();
  
  // Note: Due to RLS policies enforcing `is_admin()`, this query will naturally 
  // only succeed if the server is authenticated as an admin. However, our layout
  // already checks app_metadata.role earlier in the tree.
  const { data: docs } = await supabase
    .from("kb_documents")
    .select("id, title, category, status, created_at, slug")
    .order("created_at", { ascending: false });

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'indexed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'indexing': return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Knowledge Base</h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed">
            Manage RAG documents, monitor ingestion pipeline status, and add new contextual guidelines for the AI.
          </p>
        </div>
        <AddDocumentModal />
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden glass shadow-xl shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4 font-medium">Document Source</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Category</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Added</th>
                <th className="px-6 py-4 font-medium text-right relative"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-slate-300">
              {docs && docs.length > 0 ? docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="flex flex-col max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl">
                        <span className="truncate">{doc.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{doc.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-white/5 border border-white/10 text-xs whitespace-nowrap">
                      {doc.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       {getStatusIcon(doc.status)}
                       <span className="capitalize">{doc.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DeleteDocumentButton id={doc.id} title={doc.title} />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                    <FileText className="w-8 h-8 opacity-20 mx-auto mb-3" />
                    No documents found. <br />Click "New Document" to start building your knowledge base.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
