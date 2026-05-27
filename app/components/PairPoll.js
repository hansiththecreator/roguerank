"use client";

import { useEffect, useState } from "react";
import styles from "./PairPoll.module.css";
import { updateElo } from "../utils/elo";
import { supabase } from "../lib/supabaseClient";

function pickRandomPair(options) {
  if (options.length < 2) return [];

  const a = Math.floor(Math.random() * options.length);
  let b = Math.floor(Math.random() * options.length);

  while (b === a) {
    b = Math.floor(Math.random() * options.length);
  }

  return [options[a], options[b]];
}

export default function PairPoll({ poll, onBack, onUpdate }) {
  const [options, setOptions] = useState([]);
  const [pair, setPair] = useState([]);
  const [sessionVotes, setSessionVotes] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadFreshPoll() {
      if (!poll?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("poll_options")
        .select("*")
        .eq("poll_id", poll.id)
        .order("id", { ascending: true });

      if (!isActive) return;

      if (error) {
        console.error("Failed loading fresh poll:", error);
        const fallbackOptions = (poll?.options || []).map((o) => ({
          ...o,
          rating: o.rating ?? 1000,
          votes: o.votes ?? 0,
        }));
        setOptions(fallbackOptions);
        setPair(pickRandomPair(fallbackOptions));
        setLoadError("Using the last loaded version. New votes may need a refresh.");
        setIsLoading(false);
        return;
      }

      const freshOptions = (data || []).map((o) => ({
        ...o,
        rating: o.rating ?? 1000,
        votes: o.votes ?? 0,
      }));

      setOptions(freshOptions);
      setPair(pickRandomPair(freshOptions));
      setSessionVotes(0);
      setShowSessionModal(false);
      setIsLoading(false);
    }

    loadFreshPoll();

    return () => {
      isActive = false;
    };
  }, [poll]);

  async function handleVote(winnerId, loserId) {
    if (isVoting) return;
    setIsVoting(true);

    const winner = options.find((o) => o.id === winnerId);
    const loser = options.find((o) => o.id === loserId);

    if (!winner || !loser) {
      setIsVoting(false);
      return;
    }

    const [newW, newL] = updateElo(
      winner.rating ?? 1000,
      loser.rating ?? 1000,
      24
    );

    const localWinnerVotes = (winner.votes || 0) + 1;
    const updatedOptions = options.map((o) => {
      if (o.id === winnerId) {
        return { ...o, rating: newW, votes: localWinnerVotes };
      }
      if (o.id === loserId) return { ...o, rating: newL };
      return o;
    });
    const localTotalVotes = updatedOptions.reduce(
      (sum, option) => sum + (option.votes || 0),
      0
    );

    setOptions(updatedOptions);
    setPair(pickRandomPair(updatedOptions));
    setSessionVotes((value) => {
      const next = value + 1;
      if (next === 10) setShowSessionModal(true);
      return next;
    });
    onUpdate?.({
      ...poll,
      options: updatedOptions,
      total_votes: localTotalVotes,
    });

    try {
      const { data: savedWinner, error: winnerReadError } = await supabase
        .from("poll_options")
        .select("votes")
        .eq("id", winnerId)
        .single();

      if (winnerReadError) throw winnerReadError;

      const savedWinnerVotes = (savedWinner?.votes || 0) + 1;

      const { error: winnerUpdateError } = await supabase
        .from("poll_options")
        .update({ rating: newW, votes: savedWinnerVotes })
        .eq("id", winnerId);

      if (winnerUpdateError) throw winnerUpdateError;

      const { error: loserUpdateError } = await supabase
        .from("poll_options")
        .update({ rating: newL })
        .eq("id", loserId);

      if (loserUpdateError) throw loserUpdateError;

      const { data: savedPoll, error: pollReadError } = await supabase
        .from("polls")
        .select("total_votes")
        .eq("id", poll.id)
        .single();

      if (pollReadError) throw pollReadError;

      const { error: pollUpdateError } = await supabase
        .from("polls")
        .update({ total_votes: (savedPoll?.total_votes || 0) + 1 })
        .eq("id", poll.id);

      if (pollUpdateError) throw pollUpdateError;
    } catch (err) {
      console.error("Vote save failed:", err);
      setLoadError("Your vote was shown locally, but saving failed. Please try again.");
    } finally {
      setIsVoting(false);
    }
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

      <p className={styles.instruction}>
        {isVoting ? "Saving your vote..." : "Select your choice"}
      </p>

      {loadError && <div className={styles.notice}>{loadError}</div>}

      {isLoading ? (
        <div className={styles.loadingPanel}>Loading matchup...</div>
      ) : pair.length === 2 ? (
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
                <div className={styles.optionImgPlaceholder}>?</div>
              )}
              <div className={styles.optionText}>
                {pair[0].text || "Unnamed"}
              </div>
            </button>
          </div>

          <div className={styles.orText}>OR</div>

          <div className={styles.optionCard}>
            <button
              disabled={isVoting}
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
                <div className={styles.optionImgPlaceholder}>?</div>
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
                <div className={styles.rankingPlaceholder}>?</div>
              )}
            </div>

            <div className={styles.rankingMeta}>
              <div className={styles.rankingName}>
                {o.text || "Unnamed"}
              </div>
              <div className={styles.rankingSub}>
                {Math.round(o.rating || 0)} points - {o.votes || 0} votes
              </div>
            </div>
          </li>
        ))}
      </ol>

      {showSessionModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Good work, you rocked this poll</h2>
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
