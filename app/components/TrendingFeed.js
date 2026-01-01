'use client';
import React from 'react';
import PollCard from './PollCard';

export default function TrendingFeed({ polls = [], onOpen }) {
  // Added fallback: polls = [] ensures .map always works

  if (!polls.length) {
    return (
      <div className="mt-6 text-gray-400 text-center text-sm">
        No polls available yet. 🔥
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {polls.map((poll) => (
        <PollCard key={poll.id} poll={poll} onOpen={onOpen} />
      ))}
    </div>
  );
}
