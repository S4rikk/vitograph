import { getAppConfigKeys } from "./actions";
import AiSettingsForm from "./AiSettingsForm";

export default async function AiSettingsPage() {
  const config = await getAppConfigKeys();

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">AI Settings</h1>
      <p className="text-slate-400 mb-8 max-w-2xl leading-relaxed">
        Manage global LLM preferences, service keys, and edge function paths. 
        Changes made here are applied immediately across the entire architecture.
      </p>

      <AiSettingsForm initialConfig={config} />
    </div>
  );
}
