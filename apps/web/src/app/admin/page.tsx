export default function AdminDashboardOverview() {
  return (
    <div className="animate-fade-in-up">
      <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Overview</h1>
      <p className="text-slate-400 mb-8">Welcome to the Vitograph Admin Console.</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 glass hover:bg-white/[0.07] transition-colors duration-200">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Total System Status</h3>
          <p className="text-2xl font-bold text-white mb-4">All Systems Operational</p>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-auto">
            <div className="bg-blue-500 h-1.5 rounded-full w-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
