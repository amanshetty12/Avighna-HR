import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

const KPI = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-border"
      >
        <BarChart3 size={40} className="text-secondary/40" />
      </motion.div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">KPI Dashboard</h2>
        <p className="text-secondary font-mono text-sm uppercase tracking-widest">Status: Coming Soon</p>
      </div>
      <p className="text-secondary/60 max-w-md mx-auto leading-relaxed">
        We are currently calibrating the neural metrics for your recruitment pipeline. 
        Advanced performance indicators will be available in the next system update.
      </p>
    </div>
  );
};

export default KPI;
