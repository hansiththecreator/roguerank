"use client";
import React, { useState } from "react";
import styles from "./styles.module.css";

const LeftMenu = ({ isOpen, onClose, onRandomPoll }) => {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose}></div>}

      <aside
        className={`${styles.leftMenu} ${isOpen ? styles.showMenu : ""}`}
        style={{
          position: "fixed",
          left: isOpen ? 0 : "-260px",
          top: 0,
          height: "100vh",
          width: "250px",
          background: "rgba(10,15,25,0.95)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid #334155",
          padding: "1rem",
          transition: "left 0.3s ease",
          zIndex: 9999,
          overflowY: "auto",
        }}
      >
        <h2 style={{ color: "white", marginBottom: 20 }}>Rogue Rank</h2>

        <ul style={{ listStyle: "none", padding: 0, color: "#9AA6C2" }}>
          <li className={styles.menuItem} onClick={onRandomPoll}>
            🎲 Random Poll
          </li>

          <li
            className={styles.menuItem}
            onClick={() => {
              alert("Liked polls feature coming soon!");
              onClose();
            }}
          >
            ❤️ Liked Polls
          </li>

          <li
            className={styles.menuItem}
            onClick={() => {
              alert("Visited polls feature coming soon!");
              onClose();
            }}
          >
            👀 Visited Polls
          </li>

          <li
            className={styles.menuItem}
            onClick={() => setShowAbout((v) => !v)}
          >
            ℹ️ About Rogue Rank
          </li>
        </ul>

        {/* ---------- ABOUT SECTION ---------- */}
        {showAbout && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid #1f2b3b",
              fontSize: 13,
              lineHeight: 1.5,
              color: "#9AA6C2",
            }}
          >
            <p style={{ color: "#e6eef8", fontWeight: 600 }}>
              Rogue Rank
            </p>

            <p style={{ marginTop: 6 }}>
              Rogue Rank is an experimental platform.
              User-generated content is not moderated by default.
            </p>

            <p style={{ marginTop: 6 }}>
              For issues or takedowns:
              <br />
              <a
                href="mailto:hansithreads@gmail.com"
                style={{ color: "#38bdf8", textDecoration: "none" }}
              >
                hansithreads@gmail.com
              </a>
            </p>

            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Built by Hansith Kurra ⚡
            </p>
          </div>
        )}
      </aside>
    </>
  );
};

export default LeftMenu;
