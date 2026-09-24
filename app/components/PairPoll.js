"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PairPoll.module.css";
import ThemedModal from "./ThemedModal";
import { updateElo } from "../utils/elo";
import { getPollCreatorHandle } from "../lib/creatorProfiles";
import { supabase } from "../lib/supabaseClient";
import {
  addComment,
  deleteComment,
  getComments,
  getLiveVoters,
  hasLikedComment,
  likeComment,
  savePoll,
  unlikeComment,
  updateComment,
} from "../lib/pollEngagement";

const COMMENT_PAGE_SIZE = 4;

function pairKey(pair) {
  if (pair.length !== 2) return "";
  return pair
    .map((option) => String(option.id))
    .sort()
    .join(":");
}

function shuffle(items) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function buildPairQueue(options, avoidFirstKey = "") {
  const queue = [];

  if (options.length < 2) return queue;

  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      const ids = [String(options[i].id), String(options[j].id)].sort();
      queue.push(ids);
    }
  }

  const shuffled = shuffle(queue);
  const repeatedIndex = shuffled.findIndex((ids) => ids.join(":") === avoidFirstKey);

  if (repeatedIndex === 0 && shuffled.length > 1) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

function takeNextPair(options, queueRef, currentPair = []) {
  if (options.length < 2) return [];

  if (queueRef.current.length === 0) {
    queueRef.current = buildPairQueue(options, pairKey(currentPair));
  }

  const nextIds = queueRef.current.shift();
  const nextPair = nextIds
    ?.map((id) => options.find((option) => String(option.id) === id))
    .filter(Boolean);

  if (nextPair?.length !== 2) {
    queueRef.current = buildPairQueue(options, pairKey(currentPair));
    return takeNextPair(options, queueRef, currentPair);
  }

  return Math.random() > 0.5 ? nextPair : [nextPair[1], nextPair[0]];
}

function normalizeOption(option) {
  return {
    ...option,
    rating: option.rating ?? 1000,
    votes: option.votes ?? 0,
  };
}

function formatCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function formatTimeAgo(value, prefix = "Created") {
  const timestamp = Number(value);
  if (!timestamp) return `${prefix} recently`;

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${prefix} just now`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${prefix} ${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${prefix} ${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${prefix} ${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${prefix} ${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(days / 365);
  return `${prefix} ${years} year${years === 1 ? "" : "s"} ago`;
}

function getCreatorHref(poll) {
  return `/creator/${encodeURIComponent(poll?.creatorId || poll?.creator || "unknown")}`;
}

function getShareUrl(poll) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/polls/${poll.id}`;
}

function getVoteShare(option, totalVotes) {
  if (!totalVotes) return 0;
  return Math.round(((option?.votes || 0) / totalVotes) * 100);
}

function getOptionSpecs(option) {
  if (!option?.specs || typeof option.specs !== "object") return [];
  return Object.values(option.specs)
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function hydrateCommentProfiles(rawComments, currentUserId) {
  const comments = rawComments || [];
  const userIds = [
    ...new Set(
      comments
        .map((comment) => comment.user_id)
        .filter(Boolean)
        .map(String)
    ),
  ];

  let profileById = new Map();
  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from("users")
      .select("id, profile_pic")
      .in("id", userIds);

    if (error) {
      console.error("Failed loading comment profiles:", error);
    } else {
      profileById = new Map((data || []).map((profile) => [String(profile.id), profile]));
    }
  }

  const hydrated = await Promise.all(
    comments.map(async (comment) => {
      const profile = comment.user_id ? profileById.get(String(comment.user_id)) : null;
      let likedByCurrentUser = false;

      if (currentUserId && comment.id && !String(comment.id).startsWith("local-")) {
        const { data, error } = await hasLikedComment(comment.id, currentUserId);
        if (error) {
          console.error("Failed checking comment like:", error);
        } else {
          likedByCurrentUser = Boolean(data);
        }
      }

      return {
        ...comment,
        profile_pic: profile?.profile_pic || comment.profile_pic || "",
        likedByCurrentUser,
      };
    })
  );

  return hydrated;
}

function ActionIcon({ name, filled = false }) {
  const common = {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
  const paths = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
    comment: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />,
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </>
    ),
    save: <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function ContenderCard({ option, rank, side, disabled, onVote }) {
  const specs = getOptionSpecs(option);
  const sideLabel = side === "left" ? "left contender" : "right contender";
  const handleClick = () => {
    onVote();
  };

  return (
    <article className={`${styles.contenderBlock} ${styles[side]}`}>
      <button
        type="button"
        disabled={disabled}
        className={styles.contenderCard}
        onClick={handleClick}
        aria-label={`Vote for ${option.text || sideLabel}`}
      >
        <div className={styles.imageStage}>
          {rank ? <span className={styles.rankBadge}>#{rank}</span> : null}
          {option.image ? (
            <img src={option.image} alt={option.text || sideLabel} className={styles.optionImg} />
          ) : (
            <div className={styles.optionImgPlaceholder}>
              {(option.text || "?")[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className={styles.optionFooter}>
          <h3 className={styles.optionText}>{option.text || "Unnamed"}</h3>
          {specs.length > 0 ? (
            <div className={styles.specRow}>
              {specs.map((spec) => (
                <span key={spec} className={styles.specChip}>{spec}</span>
              ))}
            </div>
          ) : (
            <p className={styles.optionMeta}>Rank #{rank || "-"} | {Math.round(option.rating || 0)} Elo</p>
          )}
        </div>
      </button>
    </article>
  );
}

function StatDonut({ value, side }) {
  return (
    <span
      className={`${styles.donut} ${styles[side]}`}
      style={{ "--value": `${Math.max(0, Math.min(100, value))}%` }}
      aria-hidden="true"
    />
  );
}

export default function PairPoll({ poll, onBack, onUpdate, currentUser, setCurrentUser }) {
  const [options, setOptions] = useState([]);
  const [pair, setPair] = useState([]);
  const [sessionVotes, setSessionVotes] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [voteStatus, setVoteStatus] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsError, setCommentsError] = useState("");
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [commentOffset, setCommentOffset] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingCommentId, setSavingCommentId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [commentDeleteDialog, setCommentDeleteDialog] = useState(null);
  const [liveVoters, setLiveVoters] = useState([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(poll.likes || 0);
  const [savedStatus, setSavedStatus] = useState("");
  const isSaved = Boolean(currentUser?.savedPolls?.includes(poll.id));
  const pairQueueRef = useRef([]);
  const isVotingRef = useRef(false);
  const pendingVotesRef = useRef([]);
  const optionsRef = useRef([]);

  useEffect(() => {
    setLiked(Boolean(currentUser?.likes?.includes(poll.id)));
    setLikeCount(poll.likes || 0);
  }, [currentUser, poll.id, poll.likes]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const loadCommentsPage = useCallback(
    async ({ offset = 0, append = false } = {}) => {
      if (!poll?.id) return;

      if (append) {
        setIsLoadingMoreComments(true);
      } else {
        setIsCommentsLoading(true);
      }
      setCommentsError("");

      const { data, error } = await getComments(poll.id, {
        limit: COMMENT_PAGE_SIZE,
        offset,
      });

      if (error) {
        console.error("Failed loading comments:", error);
        if (!append) setComments([]);
        setCommentsError("Unable to load comments.");
      } else {
        const hydratedComments = await hydrateCommentProfiles(data || [], currentUser?.id);
        setComments((prev) => (append ? [...prev, ...hydratedComments] : hydratedComments));
        setCommentOffset(offset + hydratedComments.length);
        setHasMoreComments((data || []).length === COMMENT_PAGE_SIZE);
      }

      if (append) {
        setIsLoadingMoreComments(false);
      } else {
        setIsCommentsLoading(false);
      }
    },
    [currentUser?.id, poll?.id]
  );

  useEffect(() => {
    let isActive = true;

    async function loadFreshPoll() {
      if (!poll?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");
      setVoteStatus("");
      pairQueueRef.current = [];

      const { data, error } = await supabase
        .from("poll_options")
        .select("id, text, rating, votes")
        .eq("poll_id", poll.id)
        .order("id", { ascending: true });

      if (!isActive) return;

      if (error) {
        console.error("Failed loading fresh poll:", error);
        const fallbackOptions = (poll?.options || []).map(normalizeOption);
        pairQueueRef.current = buildPairQueue(fallbackOptions);
        optionsRef.current = fallbackOptions;
        setOptions(fallbackOptions);
        setPair(takeNextPair(fallbackOptions, pairQueueRef));
        setLoadError("Using the last loaded version. New votes may need a refresh.");
        setIsLoading(false);
        return;
      }

      const freshOptions = (data || []).map((freshOption) => {
        const existing = (poll?.options || []).find(
          (option) => String(option.id) === String(freshOption.id)
        );
        return normalizeOption({
          ...freshOption,
          image: existing?.image ?? null,
          specs: existing?.specs,
        });
      });

      pairQueueRef.current = buildPairQueue(freshOptions);
      optionsRef.current = freshOptions;
      setOptions(freshOptions);
      setPair(takeNextPair(freshOptions, pairQueueRef));
      setSessionVotes(0);
      setShowSessionModal(false);
      setIsLoading(false);
    }

    loadFreshPoll();
    return () => {
      isActive = false;
    };
  }, [poll?.id, poll?.title]);

  useEffect(() => {
    let isActive = true;

    async function loadEngagement() {
      if (!poll?.id) return;

      const voterPromise = getLiveVoters(poll.id);
      const commentsPromise = loadCommentsPage({ offset: 0, append: false });
      const { data: voterData, error: voterError } = await voterPromise;
      await commentsPromise;

      if (!isActive) return;

      if (voterError) {
        console.error("Failed loading live voters:", voterError);
        setLiveVoters([]);
      } else {
        setLiveVoters(voterData || []);
      }

    }

    loadEngagement();
    return () => {
      isActive = false;
    };
  }, [loadCommentsPage, poll.id]);

  const sorted = useMemo(
    () => [...options].sort((a, b) => (b.rating || 0) - (a.rating || 0)),
    [options]
  );
  const rankById = useMemo(
    () => new Map(sorted.map((option, index) => [option.id, index + 1])),
    [sorted]
  );
  const totalVotes = useMemo(
    () => options.reduce((sum, o) => sum + (o.votes || 0), 0),
    [options]
  );

  async function handleVote(winnerId, loserId) {
    if (isVotingRef.current) {
      if (pendingVotesRef.current.length < 1) {
        pendingVotesRef.current.push({ winnerId, loserId });
      }
      return;
    }

    isVotingRef.current = true;
    setIsVoting(true);
    setVoteStatus("");

    try {
      setLoadError("");
      const currentOptions = optionsRef.current;
      const winner = currentOptions.find((option) => String(option.id) === String(winnerId));
      const loser = currentOptions.find((option) => String(option.id) === String(loserId));

      if (!winner || !loser) {
        throw new Error("Could not find both options for this poll.");
      }

      const [newW, newL] = updateElo(winner.rating ?? 1000, loser.rating ?? 1000, 24);
      const nextWinnerVotes = (winner.votes || 0) + 1;

      const { error: winnerUpdateError } = await supabase
        .from("poll_options")
        .update({ rating: Math.round(newW), votes: nextWinnerVotes })
        .eq("poll_id", poll.id)
        .eq("id", winnerId);
      if (winnerUpdateError) throw winnerUpdateError;

      const { error: loserUpdateError } = await supabase
        .from("poll_options")
        .update({ rating: Math.round(newL) })
        .eq("poll_id", poll.id)
        .eq("id", loserId);
      if (loserUpdateError) {
        console.error("Loser rating update failed:", loserUpdateError);
      }

      const confirmedOptions = currentOptions.map((option) => {
        if (String(option.id) === String(winnerId)) {
          return normalizeOption({
            ...option,
            rating: Math.round(newW),
            votes: nextWinnerVotes,
          });
        }
        if (String(option.id) === String(loserId)) {
          return normalizeOption({
            ...option,
            rating: Math.round(newL),
          });
        }
        return option;
      });
      const confirmedTotalVotes = confirmedOptions.reduce(
        (sum, option) => sum + (option.votes || 0),
        0
      );

      const { error: pollUpdateError } = await supabase
        .from("polls")
        .update({ total_votes: confirmedTotalVotes })
        .eq("id", poll.id);
      if (pollUpdateError) {
        console.error("Poll total update failed:", pollUpdateError);
      }

      const { error: voteLogError } = await supabase.from("poll_votes").insert({
        poll_id: poll.id,
        option_id: winnerId,
        username: currentUser?.username || "Guest",
        user_id: currentUser?.id || null,
      });
      if (voteLogError) console.error("Vote activity log failed:", voteLogError);

      optionsRef.current = confirmedOptions;
      setOptions(confirmedOptions);
      setPair((currentPair) => takeNextPair(confirmedOptions, pairQueueRef, currentPair));
      setSessionVotes((value) => {
        const next = value + 1;
        if (next === 10) setShowSessionModal(true);
        return next;
      });
      onUpdate?.({ ...poll, options: confirmedOptions, total_votes: confirmedTotalVotes });
      setVoteStatus(`Vote registered for ${winner.text || "your choice"}.`);
    } catch (err) {
      console.error("Vote save failed:", err);
      setLoadError("Vote was not saved. Please try again.");
    } finally {
      isVotingRef.current = false;
      const nextVote = pendingVotesRef.current.shift();

      if (nextVote) {
        handleVote(nextVote.winnerId, nextVote.loserId);
      } else {
        setIsVoting(false);
      }
    }
  }

  async function handleShare() {
    const url = getShareUrl(poll);
    setShareStatus("");
    try {
      if (navigator.share) {
        await navigator.share({ title: poll.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus("Link copied.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") setShareStatus("Unable to share this matchup.");
    }
  }

  async function handleLike() {
    if (!currentUser || !setCurrentUser) return;

    const nextLiked = !liked;
    const nextLikes = Math.max(0, liked ? likeCount - 1 : likeCount + 1);
    const nextUser = {
      ...currentUser,
      likes: nextLiked
        ? [...(currentUser.likes || []), poll.id]
        : (currentUser.likes || []).filter((id) => id !== poll.id),
    };

    setLiked(nextLiked);
    setLikeCount(nextLikes);
    setCurrentUser(nextUser);
    onUpdate?.({ ...poll, likes: nextLikes });

    const { error } = await supabase.from("polls").update({ likes: nextLikes }).eq("id", poll.id);
    if (error) {
      console.error("Like update failed:", error);
      setLiked(liked);
      setLikeCount(likeCount);
      setCurrentUser(currentUser);
      onUpdate?.({ ...poll, likes: likeCount });
    }
  }

  async function handleSave() {
    if (!currentUser?.id || !setCurrentUser) {
      setSavedStatus("Sign in or use a profile before saving.");
      return;
    }

    const savedPolls = currentUser.savedPolls || [];
    const nextUser = savedPolls.includes(poll.id)
      ? currentUser
      : { ...currentUser, savedPolls: [...savedPolls, poll.id] };
    setCurrentUser(nextUser);

    const { error } = await savePoll(poll.id, currentUser.id);
    if (error && error.code !== "23505") {
      console.error("Save poll failed:", error);
      setSavedStatus("Saved on this device. Cloud sync failed.");
      return;
    }
    setSavedStatus(error?.code === "23505" ? "Already saved." : "Saved.");
  }

  async function handleAddComment(event) {
    event.preventDefault();
    const text = commentText.trim();
    if (!text || isCommenting) return;

    setIsCommenting(true);
    setCommentsError("");

    const fallbackComment = {
      id: `local-${Date.now()}`,
      user_id: currentUser?.id || null,
      username: currentUser?.username || "Guest",
      profile_pic: currentUser?.profile_pic || currentUser?.pfp || "",
      text,
      likes: 0,
      edited: false,
      likedByCurrentUser: false,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await addComment(
      poll.id,
      currentUser?.id || null,
      currentUser?.username || "Guest",
      text
    );
    if (error) {
      console.error("Add comment failed:", error);
      setComments((prev) => [fallbackComment, ...prev]);
      setCommentText("");
      setCommentsError("Comment posted on this device. Cloud sync failed.");
      setIsCommenting(false);
      return;
    }

    const [hydratedComment] = await hydrateCommentProfiles([data], currentUser?.id);
    setComments((prev) => [
      {
        ...hydratedComment,
        profile_pic: hydratedComment?.profile_pic || currentUser?.profile_pic || currentUser?.pfp || "",
      },
      ...prev,
    ]);
    setCommentText("");
    setIsCommenting(false);
  }

  async function handleToggleCommentLike(comment) {
    if (!currentUser?.id) {
      setCommentsError("Use a profile before liking comments.");
      return;
    }

    const liked = Boolean(comment.likedByCurrentUser);
    const nextLikes = Math.max(0, (comment.likes || 0) + (liked ? -1 : 1));
    setComments((prev) =>
      prev.map((item) =>
        item.id === comment.id
          ? { ...item, likedByCurrentUser: !liked, likes: nextLikes }
          : item
      )
    );

    if (String(comment.id).startsWith("local-")) return;

    const { error } = liked
      ? await unlikeComment(comment.id, currentUser.id)
      : await likeComment(comment.id, currentUser.id);

    if (error && error.code !== "23505") {
      console.error("Comment like sync failed:", error);
      setCommentsError("Comment like saved on this device. Cloud sync failed.");
    }
  }

  function beginEditComment(comment) {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text || "");
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentText("");
  }

  async function handleUpdateComment(comment) {
    const text = editingCommentText.trim();
    if (!text || savingCommentId) return;

    setSavingCommentId(comment.id);
    setCommentsError("");

    const applyLocalEdit = () => {
      setComments((prev) =>
        prev.map((item) =>
          item.id === comment.id ? { ...item, text, edited: true } : item
        )
      );
    };

    if (String(comment.id).startsWith("local-")) {
      applyLocalEdit();
      cancelEditComment();
      setSavingCommentId(null);
      return;
    }

    const { error } = await updateComment(comment.id, text);
    applyLocalEdit();
    if (error) {
      console.error("Update comment failed:", error);
      setCommentsError("Comment edited on this device. Cloud sync failed.");
    }
    cancelEditComment();
    setSavingCommentId(null);
  }

  function handleDeleteComment(comment) {
    setCommentDeleteDialog({ comment, error: "" });
  }

  async function confirmDeleteComment() {
    const comment = commentDeleteDialog?.comment;
    if (!comment) return;

    setDeletingCommentId(comment.id);
    setCommentsError("");
    setCommentDeleteDialog((current) => ({ ...current, error: "" }));
    setComments((prev) => prev.filter((item) => item.id !== comment.id));

    if (String(comment.id).startsWith("local-")) {
      setDeletingCommentId(null);
      setCommentDeleteDialog(null);
      return;
    }

    const { error } = await deleteComment(comment.id);
    if (error) {
      console.error("Delete comment failed:", error);
      setCommentDeleteDialog((current) => ({
        ...current,
        error: "Comment deleted on this device. Cloud sync failed.",
      }));
      setDeletingCommentId(null);
      return;
    }
    setDeletingCommentId(null);
    setCommentDeleteDialog(null);
  }

  function handleLoadMoreComments() {
    loadCommentsPage({ offset: commentOffset, append: true });
  }

  function handleCommentKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    handleAddComment(event);
  }

  const left = pair[0];
  const right = pair[1];
  const leftShare = left ? getVoteShare(left, totalVotes) : 0;
  const rightShare = right ? getVoteShare(right, totalVotes) : 0;
  return (
    <div className={styles.pollContainer}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} /> Live matchup
          </span>
          <h2 className={styles.pollTitle}>{poll.title}</h2>
          <div className={styles.metaRow}>
            <span className={styles.metaChip}>
              Made by <Link href={getCreatorHref(poll)} className={styles.creatorLink}>{getPollCreatorHandle(poll)}</Link>
            </span>
            <span className={styles.metaChip}>{formatTimeAgo(poll.createdAt || poll.createdate)}</span>
            <span className={styles.metaChip}>{formatCount(totalVotes)} total votes</span>
            <span className={styles.metaChip}>{options.length} contenders</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.fighterBadge}>Choose your fighter</span>
          <button className={styles.closeButton} onClick={onBack} type="button">Close</button>
        </div>
      </div>

      {loadError && <div className={styles.notice}>{loadError}</div>}
      {voteStatus && <div className={styles.successNotice}>{voteStatus}</div>}

      <section className={styles.matchShell} aria-label="Live matchup arena">
        <div className={styles.mainArena}>
          <div className={styles.heroBlock}>
            <div className={styles.heroKicker}>Live matchup</div>
            <h1 className={styles.heroTitle}>{poll.title}</h1>
            <div className={styles.heroDivider}>
              <span /> <p>Which one takes the crown?</p> <span />
            </div>
          </div>

          {isLoading ? (
            <div className={styles.loadingGrid}>
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonVs}>VS</div>
              <div className={styles.skeletonCard} />
            </div>
          ) : pair.length === 2 ? (
            <>
              <div className={styles.optionsContainer}>
                <ContenderCard
                  option={left}
                  rank={rankById.get(left.id)}
                  side="left"
                  disabled={isVoting}
                  onVote={() => handleVote(left.id, right.id)}
                />

                <div className={styles.vsBadge} aria-hidden="true">VS</div>

                <ContenderCard
                  option={right}
                  rank={rankById.get(right.id)}
                  side="right"
                  disabled={isVoting}
                  onVote={() => handleVote(right.id, left.id)}
                />
              </div>

              <section
                className={styles.statsStrip}
                style={{
                  "--left-mobile-share": `${leftShare}%`,
                  "--right-mobile-share": `${rightShare}%`,
                }}
                aria-label="Matchup statistics"
              >
                <div className={styles.statsSide}>
                  <span className={styles.statIcon}>Like</span>
                  <div className={styles.statText}>
                    <strong>{leftShare}%</strong>
                    <span>{formatCount(left.votes || 0)} votes</span>
                  </div>
                  <StatDonut value={leftShare} side="left" />
                </div>
                <div className={styles.statsVs}>VS</div>
                <div className={`${styles.statsSide} ${styles.statsRight}`}>
                  <StatDonut value={rightShare} side="right" />
                  <div className={styles.statText}>
                    <strong>{rightShare}%</strong>
                    <span>{formatCount(right.votes || 0)} votes</span>
                  </div>
                  <span className={styles.statIcon}>Like</span>
                </div>
              </section>

              <div className={styles.actionBar}>
                <button
                  type="button"
                  className={liked ? styles.actionActive : ""}
                  onClick={handleLike}
                  disabled={!currentUser || !setCurrentUser}
                >
                  <ActionIcon name="heart" filled={liked} /> Like {formatCount(likeCount)}
                </button>
                <a href="#comments"><ActionIcon name="comment" /> Discuss {formatCount(comments.length)}</a>
                <button type="button" onClick={handleShare}><ActionIcon name="share" /> Share</button>
                <button
                  type="button"
                  className={isSaved ? styles.actionActive : ""}
                  onClick={handleSave}
                >
                  <ActionIcon name="save" filled={isSaved} /> {isSaved ? "Saved" : "Save"}
                </button>
              </div>
              {(shareStatus || savedStatus) && (
                <div className={styles.inlineStatus}>{shareStatus || savedStatus}</div>
              )}
            </>
          ) : (
            <div className={styles.notice}>Not enough options to compare.</div>
          )}
        </div>

        <aside className={styles.sidebar} aria-label="Match information">
          {liveVoters.length > 0 ? (
            <section className={styles.sidePanel}>
              <div className={styles.sideTitle}>
                <span><span className={styles.liveDot} /> Live voters</span>
                <strong>{liveVoters.length}</strong>
              </div>
              <div className={styles.avatarStack}>
                {liveVoters.slice(0, 6).map((voter, index) => (
                  <span key={`${voter.user_id || voter.username || "voter"}-${index}`} title={voter.username || "Voter"}>
                    {(voter.username || "?")[0]?.toUpperCase()}
                  </span>
                ))}
                {liveVoters.length > 6 ? <span>+{liveVoters.length - 6}</span> : null}
              </div>
            </section>
          ) : null}

          <section className={styles.sidePanel}>
            <h3 className={styles.sideHeading}>Match stats</h3>
            <dl className={styles.sideStats}>
              <div><dt>Total votes</dt><dd>{formatCount(totalVotes)}</dd></div>
              <div><dt>Contenders</dt><dd>{options.length}</dd></div>
              <div><dt>Created</dt><dd>{formatTimeAgo(poll.createdAt || poll.createdate, "").trim() || "Recently"}</dd></div>
              <div><dt>Visibility</dt><dd>Public</dd></div>
            </dl>
            <button type="button" className={styles.shareMatchBtn} onClick={handleShare}>Share matchup</button>
          </section>
        </aside>
      </section>

      <section className={styles.lowerGrid}>
        <section className={styles.rankingPanel} aria-labelledby="ranking-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 id="ranking-title">Current ranking</h2>
              <p>All contenders based on community votes</p>
            </div>
          </div>

          {sorted.length > 0 ? (
            <ol className={styles.rankingList}>
              {sorted.map((o, i) => {
                const share = getVoteShare(o, totalVotes);
                return (
                  <li key={o.id} className={styles.rankingItem}>
                    <div className={styles.rankingIndex}>{i + 1}</div>
                    <div className={styles.rankingThumb}>
                      {o.image ? (
                        <img src={o.image} alt={o.text} className={styles.rankingImg} />
                      ) : (
                        <div className={styles.rankingPlaceholder}>{(o.text || "?")[0]?.toUpperCase()}</div>
                      )}
                    </div>
                    <div className={styles.rankingMeta}>
                      <div className={styles.rankingName}>{o.text || "Unnamed"}</div>
                      <div className={styles.rankingSub}>
                        {Math.round(o.rating || 0)} points | {formatCount(o.votes || 0)} votes
                      </div>
                    </div>
                    <div className={styles.rankingScore}>
                      <strong>{share}%</strong>
                      <span style={{ "--value": `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className={styles.emptyState}>Ranking will appear once votes are recorded.</div>
          )}
        </section>

        <section className={styles.commentsPanel} id="comments" aria-labelledby="comments-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 id="comments-title">Top comments</h2>
              <p>{comments.length ? "Recent community reactions" : "No comments yet"}</p>
            </div>
          </div>

          {commentsError && <div className={styles.commentNotice}>{commentsError}</div>}

          {isCommentsLoading ? (
            <div className={styles.commentSkeleton}>Loading comments...</div>
          ) : comments.length > 0 ? (
            <div className={styles.commentList}>
              {comments.map((comment) => (
                <article key={comment.id} className={styles.commentItem}>
                  <span className={styles.commentAvatar}>
                    {comment.profile_pic ? (
                      <img src={comment.profile_pic} alt="" className={styles.commentAvatarImg} />
                    ) : (
                      (comment.username || "?")[0]?.toUpperCase()
                    )}
                  </span>
                  <div>
                    <div className={styles.commentTop}>
                      <strong>{comment.username || "Guest"}</strong>
                      <span>
                        {formatTimeAgo(new Date(comment.created_at).getTime(), "").trim()}
                        {comment.edited ? " (edited)" : ""}
                      </span>
                      {comment.user_id && comment.user_id === currentUser?.id ? (
                        <span className={styles.commentOwnerActions}>
                          <button type="button" onClick={() => beginEditComment(comment)} aria-label="Edit comment">
                            &#9998;
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment)}
                            disabled={deletingCommentId === comment.id}
                            aria-label="Delete comment"
                          >
                            &#128465;
                          </button>
                        </span>
                      ) : null}
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className={styles.commentEditBox}>
                        <textarea
                          value={editingCommentText}
                          onChange={(event) => setEditingCommentText(event.target.value)}
                          maxLength={500}
                          rows={3}
                        />
                        <div className={styles.commentEditActions}>
                          <button
                            type="button"
                            onClick={() => handleUpdateComment(comment)}
                            disabled={savingCommentId === comment.id || !editingCommentText.trim()}
                          >
                            {savingCommentId === comment.id ? "Saving..." : "Save"}
                          </button>
                          <button type="button" onClick={cancelEditComment}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p>{comment.text}</p>
                    )}
                    <div className={styles.commentActions}>
                      <button
                        type="button"
                        className={comment.likedByCurrentUser ? styles.commentLiked : ""}
                        onClick={() => handleToggleCommentLike(comment)}
                        disabled={!currentUser?.id}
                        aria-label={comment.likedByCurrentUser ? "Unlike comment" : "Like comment"}
                      >
                        {comment.likedByCurrentUser ? "\u2665" : "\u2661"}
                      </button>
                      <span>{formatCount(comment.likes || 0)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>Be the first to start the discussion.</div>
          )}

          {hasMoreComments && !isCommentsLoading && (
            <button
              type="button"
              className={styles.loadMoreComments}
              onClick={handleLoadMoreComments}
              disabled={isLoadingMoreComments}
            >
              {isLoadingMoreComments ? "Loading..." : "Load more"}
            </button>
          )}

          <form className={styles.commentForm} onSubmit={handleAddComment}>
            <label htmlFor="match-comment">Add a comment</label>
            <textarea
              id="match-comment"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={handleCommentKeyDown}
              placeholder="Share your take..."
              maxLength={500}
              rows={3}
            />
            <button type="submit" disabled={isCommenting || !commentText.trim()}>
              {isCommenting ? "Posting..." : "Post comment"}
            </button>
          </form>
        </section>
      </section>

      <footer className={styles.footer}>
        <span>Copyright 2026 Rogue Rank. All rights reserved.</span>
      </footer>

      {showSessionModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="session-title">
            <h2 id="session-title">Good work, you rocked this poll</h2>
            <p className={styles.modalSub}>Top 5 right now</p>

            <ol className={styles.modalRanking}>
              {sorted.slice(0, 5).map((o, i) => (
                <li key={o.id}>{i + 1}. {o.text}</li>
              ))}
            </ol>

            <div className={styles.modalActions}>
              <button type="button" onClick={() => { setShowSessionModal(false); setSessionVotes(0); }}>
                Continue voting
              </button>
              <button type="button" onClick={onBack}>Next poll</button>
            </div>
          </div>
        </div>
      )}

      <ThemedModal
        open={Boolean(commentDeleteDialog)}
        title="Delete comment?"
        tone="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        showCancel
        isBusy={Boolean(deletingCommentId)}
        error={commentDeleteDialog?.error}
        onCancel={() => {
          if (deletingCommentId) return;
          setCommentDeleteDialog(null);
        }}
        onConfirm={confirmDeleteComment}
      >
        <p>This will permanently delete your comment:</p>
        <p className="themedModalPollTitle">{commentDeleteDialog?.comment?.text || "Untitled comment"}</p>
        <p className="themedModalWarning">This cannot be undone.</p>
      </ThemedModal>
    </div>
  );
}
