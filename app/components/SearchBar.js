"use client";

export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-5xl p-2 rounded bg-rouge-card border border-neon-purple text-white focus:outline-none focus:ring-2 focus:ring-neon-purple"
    />
  );
}
