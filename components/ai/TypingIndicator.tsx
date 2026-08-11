import React from 'react';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';

const dotTransition = {
  duration: 0.6,
  repeat: Infinity,
  repeatType: "reverse" as const,
  ease: "easeInOut" as const
};

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex space-x-4 justify-start items-start"
    >
      {/* AI Avatar */}
      <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
        <Compass className="w-4.5 h-4.5 animate-spin" style={{ animationDuration: '6s' }} />
      </div>

      {/* Bubble */}
      <div
        className="max-w-xl space-y-2.5 p-4 rounded-2xl border rounded-tl-none relative shadow-lg shadow-indigo-950/20 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--hover-bg-strong)',
          borderColor: 'var(--border-medium)',
          color: 'var(--text-secondary)'
        }}
      >
        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
          AI Mentor is typing...
        </span>
        <div className="flex items-center space-x-2 py-1.5 px-0.5">
          <motion.span
            className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
            animate={{ y: [0, -6, 0] }}
            transition={{ ...dotTransition, delay: 0 }}
          />
          <motion.span
            className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
            animate={{ y: [0, -6, 0] }}
            transition={{ ...dotTransition, delay: 0.15 }}
          />
          <motion.span
            className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]"
            animate={{ y: [0, -6, 0] }}
            transition={{ ...dotTransition, delay: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default TypingIndicator;
