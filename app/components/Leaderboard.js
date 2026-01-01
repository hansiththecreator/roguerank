"use client";

import { motion, AnimatePresence } from "framer-motion";

export default function Leaderboard({ options, onClose }) {
  const sorted = [...options].sort((a, b) => b.rating - a.rating);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white dark:bg-neutral-900 p-6 rounded-2xl w-[90%] max-w-md shadow-2xl"
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
        >
          <h2 className="text-2xl font-semibold mb-4 text-center">🏆 Leaderboard</h2>
          <ul className="space-y-2">
            {sorted.map((o, idx) => (
              <li
                key={o.id}
                className="flex items-center justify-between bg-gray-100 dark:bg-neutral-800 rounded-xl px-4 py-2"
              >
                <span>{idx + 1}. {o.name}</span>
                <span className="text-sm text-gray-500">{Math.round(o.rating)}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={onClose}
            className="mt-6 w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-xl hover:scale-105 transition"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
