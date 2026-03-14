"use client";
import { useEffect, useState } from "react";
import styles from "./PairPoll.module.css";
import { updateElo } from "../utils/elo";
import { supabase } from "../lib/supabaseClient";

export default function PairPoll({ poll, onBack, onUpdate }) {
  const [options, setOptions] = useState(
    (poll?.options || []).map(o => ({ ...o }))
  );
  const [pair, setPair] = useState([]);
  const [sessionVotes, setSessionVotes] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    setOptions((poll?.options || []).map(o => ({ ...o })));
    setSessionVotes(0);
    setShowSessionModal(false);
  }, [poll]);

  useEffect(() => {
    if (options.length >= 2) pickPair();
  }, [options.length]);

  function pickPair() {
    if (options.length < 2) return setPair([]);
    const idxA = Math.floor(Math.random() * options.length);
    let idxB = Math.floor(Math.random() * options.length);
    while (idxB === idxA && options.length > 1) {
      idxB = Math.floor(Math.random() * options.length);
    }
    setPair([options[idxA], options[idxB]]);
  }

  if (isVoting) return;
setIsVoting(true);
  async function handleVote(winnerId, loserId) {
    const winner = options.find(o => o.id === winnerId);
    const loser = options.find(o => o.id === loserId);
    if (!winner || !loser) return;

    const wRating = winner.rating ?? 1000;
    const lRating = loser.rating ?? 1000;
    const [newW, newL] = updateElo(wRating, lRating, 24);

    // ---------- OPTIMISTIC UI UPDATE ----------
    const updatedOptions = options.map(o => {
      if (o.id === winnerId) {
        return { ...o, rating: newW, votes: (o.votes || 0) + 1 };
      }
      if (o.id === loserId) {
        return { ...o, rating: newL };
      }
      return o;
    });

    setOptions(updatedOptions);

    setSessionVotes(v => {
      const next = v + 1;
      if (next === 10) setShowSessionModal(true);
      return next;
    });

    const updatedPoll = { ...poll, options: updatedOptions };
    onUpdate?.(updatedPoll);

    pickPair();

    // ---------- SUPABASE WRITE (IMMEDIATE) ----------
try {
  await Promise.all([
    
    // update winner
    supabase
      .from("poll_options")
      .update({
        rating: newW,
        votes: (winner.votes || 0) + 1,
      })
      .eq("id", winnerId),

    // update loser
    supabase
      .from("poll_options")
      .update({
        rating: newL,
      })
      .eq("id", loserId),

    // update poll total votes
    supabase
      .from("polls")
      .update({
        total_votes: (poll.total_votes || 0) + 1
      })
      .eq("id", poll.id)

  ]);
} catch (err) {
  console.error("Vote write failed:", err);
}

setIsVoting(false);
  }

  const sorted = [...options].sort(
    (a, b) => (b.rating || 0) - (a.rating || 0)
  );

  return (
    <div className={styles.pollContainer}>
      <div className={styles.headerRow}>
        <h2 className={styles.pollTitle}>{poll.title}</h2>
        <button className={styles.closeButton} onClick={onBack}>
          Close
        </button>
      </div>

      <div style={{ fontSize: 13, color: "#9AA6C2", marginTop: 2 }}>
        Created by{" "}
        <strong style={{ color: "#e6eef8" }}>{poll.creator}</strong>
      </div>

      <p className={styles.instruction}>Select your choice</p>

      {pair.length === 2 ? (
        <div className={styles.optionsContainer}>
          <div className={styles.optionCard}>
            <button
            disabled={isVoting}
            className={styles.voteArea}
            onClick={() => handleVote(pair[0].id, pair[1].id)}
            >
              {pair[0].image ? (
                <img
                  src={pair[0].image}
                  alt={pair[0].text}
                  className={styles.optionImg}
                />
              ) : (
                <div className={styles.optionImgPlaceholder}>⭐</div>
              )}
              <div className={styles.optionText}>
                {pair[0].text || "Unnamed"}
              </div>
            </button>
          </div>

          <div className={styles.orText}>OR</div>

          <div className={styles.optionCard}>
            <button
              className={styles.voteArea}
              onClick={() => handleVote(pair[1].id, pair[0].id)}
            >
              {pair[1].image ? (
                <img
                  src={pair[1].image}
                  alt={pair[1].text}
                  className={styles.optionImg}
                />
              ) : (
                <div className={styles.optionImgPlaceholder}>⭐</div>
              )}
              <div className={styles.optionText}>
                {pair[1].text || "Unnamed"}
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: "#9AA6C2", marginTop: 12 }}>
          Not enough options to compare.
        </div>
      )}

      <h3 className={styles.rankingTitleHeader}>Current ranking</h3>

      <ol className={styles.rankingList}>
        {sorted.slice(0, 10).map((o, i) => (
          <li key={o.id} className={styles.rankingItem}>
            <div className={styles.rankingIndex}>{i + 1}</div>

            <div className={styles.rankingThumb}>
              {o.image ? (
                <img
                  src={o.image}
                  alt={o.text}
                  className={styles.rankingImg}
                />
              ) : (
                <div className={styles.rankingPlaceholder}>⭐</div>
              )}
            </div>

            <div className={styles.rankingMeta}>
              <div className={styles.rankingName}>
                {o.text || "Unnamed"}
              </div>
              <div className={styles.rankingSub}>
                {Math.round(o.rating || 0)} points · {o.votes || 0} votes
              </div>
            </div>
          </li>
        ))}
      </ol>

      {showSessionModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Good work, you rocked this poll 🚀</h2>
            <p className={styles.modalSub}>Top 5 right now</p>

            <ol className={styles.modalRanking}>
              {sorted.slice(0, 5).map((o, i) => (
                <li key={o.id}>
                  {i + 1}. {o.text}
                </li>
              ))}
            </ol>

            <div className={styles.modalActions}>
              <button
                onClick={() => {
                  setShowSessionModal(false);
                  setSessionVotes(0);
                }}
              >
                Continue voting
              </button>
              <button onClick={onBack}>Next poll</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
