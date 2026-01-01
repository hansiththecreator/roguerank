"use client";

import { useState, useEffect } from "react";
import styles from "./DuelPoll.module.css";

export default function DuelPoll() {
  // Load votes from localStorage if they exist, else default
  const [votes, setVotes] = useState({ optionA: 0, optionB: 0 });

  useEffect(() => {
    const storedVotes = localStorage.getItem("duelPollVotes");
    if (storedVotes) setVotes(JSON.parse(storedVotes));
  }, []);

  const handleVote = (option) => {
    setVotes((prev) => {
      const newVotes = { ...prev, [option]: prev[option] + 1 };
      localStorage.setItem("duelPollVotes", JSON.stringify(newVotes)); // save to localStorage
      return newVotes;
    });
  };

  const totalVotes = votes.optionA + votes.optionB;
  const percentA = totalVotes ? ((votes.optionA / totalVotes) * 100).toFixed(1) : 0;
  const percentB = totalVotes ? ((votes.optionB / totalVotes) * 100).toFixed(1) : 0;

  return (
    <div className={styles.pollContainer}>
      <h1 className={styles.pollTitle}>🔥 Duel Poll is Live 🔥</h1>

      <div className={styles.options}>
        <button onClick={() => handleVote("optionA")} className={styles.voteButton}>
          Naruto
        </button>
        <button onClick={() => handleVote("optionB")} className={styles.voteButton}>
          Gojo
        </button>
      </div>

      <div className={styles.results}>
        <div className={styles.resultRow}>
          <span>Naruto</span>
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${percentA}%` }} />
          </div>
          <span>{votes.optionA} ({percentA}%)</span>
        </div>

        <div className={styles.resultRow}>
          <span>Gojo</span>
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${percentB}%` }} />
          </div>
          <span>{votes.optionB} ({percentB}%)</span>
        </div>
      </div>
    </div>
  );
}
