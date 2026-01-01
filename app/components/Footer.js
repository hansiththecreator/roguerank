// app/components/Footer.js
"use client";
import React from "react";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      width: "100%",
      borderTop: "1px solid rgba(255,255,255,0.04)",
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      background: "linear-gradient(180deg, rgba(3,7,18,0.0), rgba(3,7,18,0.02))",
      color: "#9AA6C2",
      fontSize: 13,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "#0ea5e9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#042028",
          fontWeight: 800,
          boxShadow: "0 4px 18px rgba(14,165,233,0.12)"
        }}>RR</div>

        <div>
          <div style={{ fontWeight: 700, color: "#E6EEF8" }}>Rogue Rank</div>
          <div style={{ color: "#9AA6C2", fontSize: 12 }}>© {year} — Built by Hansith Kurra</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <div style={{ color: "#9AA6C2" }}>Privacy</div>
        <div style={{ color: "#9AA6C2" }}>Terms</div>
        <div style={{ color: "#9AA6C2", opacity: 0.95 }}>Made with ⚡ & ☕</div>
      </div>
    </footer>
  );
}
