'use client';
import { motion } from 'framer-motion';

export default function LeaderboardModal({ options, onClose }) {
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        className="bg-neutral-900 rounded-2xl p-6 w-[90%] max-w-md shadow-2xl text-white"
        initial={{ scale: 0.9 }} animate={{ scale: 1 }}
      >
        <h2 className="text-2xl font-bold mb-4 text-center">🏆 Leaderboard</h2>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {options
            .sort((a, b) => b.rating - a.rating)
            .map((opt, i) => (
              <div key={opt.id} className="flex justify-between p-2 rounded-lg bg-neutral-800">
                <span>{i + 1}. {opt.name}</span>
                <span className="text-yellow-400">{opt.rating}</span>
              </div>
            ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}
