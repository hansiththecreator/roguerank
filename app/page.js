// app/page.js
"use client";

import MultiPoll from "./components/MultiPoll";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#e6eef8", padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <MultiPoll />
      </div>
    </main>
  );
}
