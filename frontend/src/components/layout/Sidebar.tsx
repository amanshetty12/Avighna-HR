import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, MessageSquare, ClipboardCheck, LayoutDashboard, Settings, Menu, X, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}

const NavItem = ({ to, icon: Icon, label, onClick }: NavItemProps) => (
  <NavLink
    to={to}
    end={to === '/'}
    onClick={onClick}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
      ${isActive 
        ? 'bg-white/10 text-white' 
        : 'text-secondary hover:text-white hover:bg-white/5'}
    `}
  >
    <Icon size={20} className="transition-transform group-hover:scale-110" />
    <span className="font-mono text-[12px] uppercase tracking-widest">{label}</span>
  </NavLink>
);

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-white text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-background border-r border-border flex flex-col p-6 gap-8 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-white flex items-center justify-center rounded-lg">
            <span className="text-black font-bold text-sm tracking-tighter">AV</span>
          </div>
          <span className="font-sans font-bold text-xl tracking-tight">Avighna</span>
        </div>
        
        <nav className="flex flex-col gap-2">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" onClick={() => setIsOpen(false)} />
          <NavItem to="/jd-refiner" icon={ClipboardCheck} label="JD Refiner" onClick={() => setIsOpen(false)} />
          <NavItem to="/candidates" icon={Users} label="Candidates" onClick={() => setIsOpen(false)} />
          <NavItem to="/interview" icon={MessageSquare} label="Copilot" onClick={() => setIsOpen(false)} />
          <NavItem to="/cultural-fit" icon={Home} label="Culture" onClick={() => setIsOpen(false)} />
          <NavItem to="/kpi" icon={BarChart3} label="KPI" onClick={() => setIsOpen(false)} />
          <div className="mt-8 pt-8 border-t border-border">
            <NavItem to="/settings" icon={Settings} label="Settings" onClick={() => setIsOpen(false)} />
          </div>
        </nav>
        
        <div className="mt-auto">
          <div className="p-4 rounded-2xl bg-white/5 border border-border">
            <p className="font-mono text-[10px] text-secondary uppercase mb-2">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium">Core Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
