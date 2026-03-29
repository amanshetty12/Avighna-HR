import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import JDRefiner from './pages/JDRefiner';
import Candidates from './pages/Candidates';
import InterviewCopilot from './pages/InterviewCopilot';
import CulturalFit from './pages/CulturalFit';
import KPI from './pages/KPI';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-background text-primary font-sans selection:bg-accent/30 overflow-x-hidden">
        <Sidebar />
        
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 glassmorphism px-4 md:px-8 py-4 flex items-center justify-between">
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate mr-4">Recruitment Dashboard</h1>
            <div className="flex items-center gap-3 md:gap-4 shrink-0">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-mono uppercase tracking-tighter text-secondary">System Load</span>
                <span className="text-xs font-medium">Optimal</span>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 border border-border flex items-center justify-center overflow-hidden">
                <span className="text-[10px] md:text-xs font-bold">JD</span>
              </div>
            </div>
          </header>
          
          <div className="p-4 md:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jd-refiner" element={<JDRefiner />} />
              <Route path="/candidates" element={<Candidates />} />
              <Route path="/interview" element={<InterviewCopilot />} />
              <Route path="/cultural-fit" element={<CulturalFit />} />
              <Route path="/kpi" element={<KPI />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
