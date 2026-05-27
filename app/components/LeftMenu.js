"use client";

import { useState } from "react";
import styles from "./styles.module.css";

export default function LeftMenu({ isOpen, onClose, onRandomPoll }) {
  const [showAbout, setShowAbout] = useState(false);

  const handleRandomPoll = () => {
    onRandomPoll?.();
    onClose?.();
  };

  return (
    <>
      {isOpen && (
        <button
          className={styles.overlay}
          onClick={onClose}
          aria-label="Close menu"
          type="button"
        />
      )}

      <aside
        className={`${styles.leftMenu} ${isOpen ? styles.showMenu : ""}`}
        aria-hidden={!isOpen}
      >
        <h2 className={styles.menuTitle}>Rogue Rank</h2>

        <nav className={styles.menuNav} aria-label="Main menu">
          <button className={styles.menuItem} onClick={handleRandomPoll} type="button">
            Random Poll
          </button>

          <button
            className={styles.menuItem}
            onClick={() => {
              alert("Liked polls feature coming soon!");
              onClose?.();
            }}
            type="button"
          >
            Liked Polls
          </button>

          <button
            className={styles.menuItem}
            onClick={() => {
              alert("Visited polls feature coming soon!");
              onClose?.();
            }}
            type="button"
          >
            Visited Polls
          </button>

          <button
            className={styles.menuItem}
            onClick={() => setShowAbout((value) => !value)}
            type="button"
          >
            About Rogue Rank
          </button>
        </nav>

        {showAbout && (
          <section className={styles.aboutPanel}>
            <p className={styles.aboutTitle}>Rogue Rank</p>

            <p>
              Rogue Rank is an experimental platform. User-generated content is
              not moderated by default.
            </p>

            <p>
              For issues or takedowns:
              <br />
              <a href="mailto:roguerankofficial@gmail.com">
                roguerankofficial@gmail.com
              </a>
            </p>

            <p className={styles.aboutCredit}>Built by Hansith Kurra</p>
          </section>
        )}
      </aside>
    </>
  );
}
