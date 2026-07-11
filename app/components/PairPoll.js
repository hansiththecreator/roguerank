"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

function formatCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function formatTimeAgo(value) {
  const timestamp = Number(value);
  if (!timestamp) return "Created recently";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Created just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Created ${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Created ${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `Created ${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `Created ${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(days / 365);
  return `Created ${years} year${years === 1 ? "" : "s"} ago`;
}

function getCreatorHref(poll) {
  return `/creator/${encodeURIComponent(poll?.creatorId || poll?.creator || "unknown")}`;
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
        .select("id, text, image_url, rating, votes")
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
        id: o.id,
        text: o.text,
        image: o.image_url,
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
        .update({ rating: Math.round(newW), votes: savedWinnerVotes })
        .eq("id", winnerId);

      if (winnerUpdateError) throw winnerUpdateError;

      const { error: loserUpdateError } = await supabase
        .from("poll_options")
        .update({ rating: Math.round(newL) })
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

  const totalVotes = options.reduce((sum, o) => sum + (o.votes || 0), 0);

  return (
    <div className={styles.pollContainer}>
      {/* ✅ LIVE MATCHUP HEADER */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} /> Live matchup
          </span>
          <h2 className={styles.pollTitle}>{poll.title}</h2>
          <div className={styles.metaRow}>
            <span className={styles.metaChip}>
              Created by  <Link href={getCreatorHref(poll)} className={styles.creatorLink}>{poll.creator}</Link>
            </span>
            <span className={styles.metaChip}>{formatTimeAgo(poll.createdAt || poll.createdate)}</span>
            <span className={styles.metaChip}>{formatCount(totalVotes)} total votes</span>
            <span className={styles.metaChip}>{options.length} contenders</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.fighterBadge}>Choose your fighter</span>
          <button className={styles.closeButton} onClick={onBack}>
            Close
          </button>
        </div>
      </div>

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
                <div className={styles.optionImgFrame}>
                  <img
                    src={pair[0].image}
                    alt={pair[0].text}
                    className={styles.optionImg}
                  />
                </div>
              ) : (
                <div className={styles.optionImgPlaceholder}>
                  {(pair[0].text || "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className={styles.optionFooter}>
                <div className={styles.optionText}>
                  {pair[0].text || "Unnamed"}
                </div>
                <div className={styles.optionStatsRow}>
                  <span className={styles.statPill}>{formatCount(pair[0].votes || 0)} votes</span>
                  <span className={styles.statPill}>{Math.round(pair[0].rating || 1000)} ELO</span>
                </div>
              </div>
            </button>
          </div>

          <div className={styles.vsBadge}>VS</div>

          <div className={styles.optionCard}>
            <button
              disabled={isVoting}
              className={styles.voteArea}
              onClick={() => handleVote(pair[1].id, pair[0].id)}
            >
              {pair[1].image ? (
                <div className={styles.optionImgFrame}>
                  <img
                    src={pair[1].image}
                    alt={pair[1].text}
                    className={styles.optionImg}
                  />
                </div>
              ) : (
                <div className={styles.optionImgPlaceholder}>
                  {(pair[1].text || "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className={styles.optionFooter}>
                <div className={styles.optionText}>
                  {pair[1].text || "Unnamed"}
                </div>
                <div className={styles.optionStatsRow}>
                  <span className={styles.statPill}>{formatCount(pair[1].votes || 0)} votes</span>
                  <span className={styles.statPill}>{Math.round(pair[1].rating || 1000)} ELO</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.notice}>Not enough options to compare.</div>
      )}

      <h3 className={styles.rankingTitleHeader}>Current ranking</h3>

      {/* ✅ ALL OPTIONS — no slice limit */}
      <ol className={styles.rankingList}>
        {sorted.map((o, i) => (
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
                <div className={styles.rankingPlaceholder}>
                  {(o.text || "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <div className={styles.rankingMeta}>
              <div className={styles.rankingName}>
                {o.text || "Unnamed"}
              </div>
              <div className={styles.rankingSub}>
                {Math.round(o.rating || 0)} points · {formatCount(o.votes || 0)} votes
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
