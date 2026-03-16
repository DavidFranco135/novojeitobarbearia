import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface SlidingTabProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  theme?: string;
  allTabsOpen?: string | null;
  children: React.ReactNode;
}

const SlidingTab: React.FC<SlidingTabProps> = ({ title, isOpen, onToggle, badge, theme = 'dark', children }) => {
  return (
    <motion.div
      layout
      className={`border-b overflow-hidden transition-opacity duration-300 ${
        theme === 'light' ? 'border-zinc-100 bg-white' : 'border-white/5 bg-white/[0.02]'
      }`}
    >
      <button
        onClick={onToggle}
        className={`w-full py-5 px-6 flex justify-between items-center group transition-all ${
          theme === 'light' ? 'hover:bg-zinc-50' : 'hover:bg-white/[0.03]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-[15px] font-semibold tracking-tight ${
            theme === 'light' ? 'text-zinc-900' : 'text-white'
          }`}>
            {title}
          </span>
          {badge && <span className="flex items-center">{badge}</span>}
        </div>
        <ChevronDown
          size={18}
          className={`transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          } ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'} group-hover:translate-y-0.5`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-8">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SlidingTab;
