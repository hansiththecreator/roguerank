"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./MultiPoll.module.css";
import PairPoll from "./PairPoll";
import PollGridCard from "./PollGridCard";
import PollCreator from "./PollCreator";
import ThemedModal from "./ThemedModal";
import { supabase } from "../lib/supabaseClient";
import { applyCreatorProfilesToPolls, getPollCreatorHandle, getPollCreatorUsername } from "../lib/creatorProfiles";
import { reportPoll as persistPollReport } from "../lib/pollEngagement";
import { POLL_IMAGES_BUCKET } from "../lib/storageImages";

const REPORT_EMAIL = "roguerankofficial@gmail.com";
const REPORT_REASONS = [
  "Spam or scam",
  "Offensive content",
  "Harassment or hate",
  "Inappropriate image",
  "Misleading poll",
  "Other",
];
const POLL_PAGE_SIZE = 12;
const POLL_LOAD_TIMEOUT_MS = 20000;
let initialPollPagePromise = null;

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function normalizePoll(row) {
  const options = (row.poll_options || row.options || [])
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((o) => ({
      id: o.id,
      text: o.text,
      image: o.image_url ?? o.image,
      rating: o.rating ?? 1000,
      votes: o.votes ?? 0,
    }));

  return {
    id: row.id,
    title: row.title,
    creator: row.creator,
    creatorId: row.creatorid ?? row.creator_id ?? row.creatorId,
    likes: Math.max(0, row.likes ?? 0),
    total_votes:
      row.total_votes ??
      options.reduce((sum, option) => sum + (option.votes || 0), 0),
    hashtags: row.hashtags || [],
    createdAt: row.createdate ?? row.createdAt,
    thumbnail: row.thumbnail ?? null,
    options,
  };
}

// ✅ Format large numbers — 20024 becomes 20k, 1500000 becomes 1.5M
function formatCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function HeroStatIcon({ name }) {
  const common = {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
  const paths = {
    polls: (
      <>
        <path d="m12 3 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4" />
        <path d="m4 17 8 4 8-4" />
      </>
    ),
    votes: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    options: (
      <>
        <path d="M7 18v-7" />
        <path d="M12 18V6" />
        <path d="M17 18v-4" />
        <path d="M5 18h14" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
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

// ✅ Get best thumbnail — highest voted option with image
function getPollThumbnail(poll) {
  if (poll.thumbnail) return poll.thumbnail;
  const withImage = (poll.options || []).filter((o) => o.image);
  if (!withImage.length) return null;
  const sorted = [...withImage].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  return sorted[0].image;
}

function getHashtagHref(tag) {
  return `/hashtags/${encodeURIComponent(String(tag).replace(/^#/, ""))}`;
}

function getCreatorHref(poll) {
  return `/creator/${encodeURIComponent(poll.creatorId || poll.creator || "unknown")}`;
}

function getStoragePathFromPublicUrl(url) {
  if (!url || typeof url !== "string") return null;

  const marker = `/storage/v1/object/public/${POLL_IMAGES_BUCKET}/`;

  try {
    const { pathname } = new URL(url);
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const path = pathname.slice(markerIndex + marker.length);
    return path ? decodeURIComponent(path) : null;
  } catch {
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) return null;

    const path = url.slice(markerIndex + marker.length).split("?")[0];
    return path ? decodeURIComponent(path) : null;
  }
}

export default function MultiPoll({
  selectedPoll,
  setSelectedPoll,
  searchQuery,
  searchFilter,
  currentUser,
  setCurrentUser,
  polls,
  setPolls,
  showCreator,
  setShowCreator,
}) {
  const router = useRouter();
  const loadMoreRef = useRef(null);
  const isFetchingMoreRef = useRef(false);
  const [editingPoll, setEditingPoll] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);
  const [isFetchingMorePolls, setIsFetchingMorePolls] = useState(false);
  const [nextPollOffset, setNextPollOffset] = useState(0);
  const [hasMorePolls, setHasMorePolls] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingPollId, setDeletingPollId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [noticeDialog, setNoticeDialog] = useState(null);
  const [activeTab, setActiveTab] = useState("latest");
  const [reportPoll, setReportPoll] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDescription, setReportDescription] = useState("");
  const isSearchActive = Boolean(searchQuery?.trim());

  const fetchPollPage = useCallback(async (from) => {
    return supabase
      .from("polls")
      .select(`*, poll_options (id, text, image_url, rating, votes)`)
      .order("createdate", { ascending: false })
      .range(from, from + POLL_PAGE_SIZE - 1);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadPolls() {
      setIsLoadingPolls(true);
      setLoadError("");
      setNextPollOffset(0);
      setHasMorePolls(true);
      try {
        initialPollPagePromise ||= withTimeout(
          fetchPollPage(0).then(async ({ data, error }) => {
            if (error) return { data: null, error };
            const rows = data || [];
            const profiledPolls = await applyCreatorProfilesToPolls(rows.map(normalizePoll));
            return { data: rows, profiledPolls, error: null };
          }),
          POLL_LOAD_TIMEOUT_MS,
          "Polls request timed out."
        );

        const { data, profiledPolls, error } = await initialPollPagePromise;
        if (!isActive) return;

        if (error) {
          console.error("Error loading polls:", error);
          initialPollPagePromise = null;
          setLoadError(
            `Polls could not be loaded. ${error.message || "Check the backend connection and try again."}`
          );
          setHasMorePolls(false);
          return;
        }
        const rows = data || [];
        setPolls(profiledPolls || []);
        setNextPollOffset(rows.length);
        setHasMorePolls(rows.length === POLL_PAGE_SIZE);
      } catch (error) {
        console.error("Error loading polls:", error);
        initialPollPagePromise = null;
        if (!isActive) return;
        setLoadError(
          `Polls could not be loaded. ${error?.message || "Check the backend connection and try again."}`
        );
        setHasMorePolls(false);
      } finally {
        if (isActive) {
          setIsLoadingPolls(false);
        }
      }
    }
    loadPolls();

    return () => {
      isActive = false;
    };
  }, [fetchPollPage, setPolls]);

  const loadMorePolls = useCallback(async () => {
    if (
      isFetchingMoreRef.current ||
      isLoadingPolls ||
      isSearchActive ||
      !hasMorePolls
    ) {
      return;
    }

    isFetchingMoreRef.current = true;
    setIsFetchingMorePolls(true);

    let result;
    try {
      result = await withTimeout(
        fetchPollPage(nextPollOffset),
        POLL_LOAD_TIMEOUT_MS,
        "More polls request timed out."
      );
    } catch (error) {
      console.error("Error loading more polls:", error);
      isFetchingMoreRef.current = false;
      setIsFetchingMorePolls(false);
      return;
    }

    const { data, error } = result;
    if (error) {
      console.error("Error loading more polls:", error);
      isFetchingMoreRef.current = false;
      setIsFetchingMorePolls(false);
      return;
    }

    const rows = data || [];
    const nextPolls = await applyCreatorProfilesToPolls(rows.map(normalizePoll));
    setPolls((prev) => {
      const existingIds = new Set(prev.map((poll) => String(poll.id)));
      return [
        ...prev,
        ...nextPolls.filter((poll) => !existingIds.has(String(poll.id))),
      ];
    });
    setNextPollOffset((value) => value + rows.length);
    setHasMorePolls(rows.length === POLL_PAGE_SIZE);
    isFetchingMoreRef.current = false;
    setIsFetchingMorePolls(false);
  }, [fetchPollPage, hasMorePolls, isLoadingPolls, isSearchActive, nextPollOffset, setPolls]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || isLoadingPolls || isSearchActive || !hasMorePolls) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMorePolls();
        }
      },
      { rootMargin: "420px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMorePolls, isLoadingPolls, isSearchActive, loadMorePolls]);

  useEffect(() => {
    if (!menuOpenFor) return;
    function handleOutsideClick() { setMenuOpenFor(null); }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [menuOpenFor]);

  const totalVotes = useMemo(() =>
    polls.reduce((sum, p) => sum + (p.total_votes || 0), 0), [polls]);
  const totalOptions = useMemo(() =>
    polls.reduce((sum, p) => sum + (p.options?.length || 0), 0), [polls]);

  // ✅ Search with filter
  const sortedPolls = useMemo(() => {
    const query = searchQuery?.trim().toLowerCase() || "";
    const filter = searchFilter || "all";

    let filtered = polls.filter((poll) => {
      if (!query) return true;
      if (filter === "polls") return poll.title?.toLowerCase().includes(query);
      if (filter === "creators") {
        return [poll.creatorUsername, poll.creatorName, poll.creator]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      }
      if (filter === "hashtags") return (poll.hashtags || []).some((tag) => tag.toLowerCase().includes(query));
      if (filter === "options") return (poll.options || []).some((o) => o.text?.toLowerCase().includes(query));
      return [poll.title, poll.creatorUsername, poll.creatorName, poll.creator, ...(poll.hashtags || []), ...(poll.options || []).map((o) => o.text)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    if (activeTab === "popular") return [...filtered].sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0));
    if (activeTab === "mostliked") return [...filtered].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return filtered;
  }, [polls, searchQuery, searchFilter, activeTab]);

  const trendingPoll = useMemo(() =>
    polls.length > 0
      ? [...polls].sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0))[0]
      : null,
    [polls]
  );

  const handleLikeToggle = async (pollId) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll || !currentUser) return;
    const liked = currentUser.likes?.includes(pollId);
    const nextLikes = Math.max(0, liked ? poll.likes - 1 : poll.likes + 1);
    const nextUser = {
      ...currentUser,
      likes: liked
        ? currentUser.likes.filter((id) => id !== pollId)
        : [...(currentUser.likes || []), pollId],
    };
    setCurrentUser(nextUser);
    setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, likes: nextLikes } : p)));
    const { error } = await supabase.from("polls").update({ likes: nextLikes }).eq("id", pollId);
    if (error) {
      console.error("Like update failed:", error);
      setCurrentUser(currentUser);
      setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, likes: poll.likes } : p)));
    }
  };

  const handleShare = (poll) => {
    const url = `${window.location.origin}/polls/${poll.id}`;
    if (navigator.share) {
      navigator.share({ title: poll.title, url });
    } else {
      navigator.clipboard.writeText(url);
      setNoticeDialog({ title: "Link copied", message: "The poll link is ready to share." });
    }
  };

  const openPoll = (poll) => {
    if (!poll?.id) return;
    router.push(`/polls/${poll.id}`);
  };

  const handleDelete = (poll) => {
    setMenuOpenFor(null);
    setDeleteDialog({ poll, error: "" });
  };

  const handleCoverUpdated = (pollId, thumbnail) => {
    setPolls((prev) =>
      prev.map((poll) => (poll.id === pollId ? { ...poll, thumbnail } : poll))
    );
    setSelectedPoll((current) =>
      current?.id === pollId ? { ...current, thumbnail } : current
    );
  };

  const confirmDeletePoll = async () => {
    const pollId = deleteDialog?.poll?.id;
    if (!pollId) return;

    setDeletingPollId(pollId);
    setDeleteDialog((current) => ({ ...current, error: "" }));

    const [{ data: pollImageData, error: pollImageError }, { data: optionImageData, error: optionImageError }] =
      await Promise.all([
        supabase.from("polls").select("thumbnail").eq("id", pollId).maybeSingle(),
        supabase.from("poll_options").select("image_url").eq("poll_id", pollId),
      ]);

    if (pollImageError || optionImageError) {
      console.warn("Could not fetch poll images for cleanup:", pollImageError || optionImageError);
    } else {
      const imagePaths = [
        getStoragePathFromPublicUrl(pollImageData?.thumbnail),
        ...(optionImageData || []).map((option) =>
          getStoragePathFromPublicUrl(option.image_url)
        ),
      ].filter(Boolean);
      const uniqueImagePaths = [...new Set(imagePaths)];

      if (uniqueImagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(POLL_IMAGES_BUCKET)
          .remove(uniqueImagePaths);

        if (storageError) {
          console.warn("Poll image cleanup failed:", storageError);
        }
      }
    }

    const { error: optionsError } = await supabase.from("poll_options").delete().eq("poll_id", pollId);
    if (optionsError) {
      setDeleteDialog((current) => ({
        ...current,
        error: "Could not delete poll options. Please try again.",
      }));
      setDeletingPollId(null);
      return;
    }
    const { error: pollError } = await supabase.from("polls").delete().eq("id", pollId);
    if (pollError) {
      setDeleteDialog((current) => ({
        ...current,
        error: "Could not delete this poll. Please try again.",
      }));
      setDeletingPollId(null);
      return;
    }
    setPolls((prev) => prev.filter((poll) => poll.id !== pollId));
    setMenuOpenFor(null);
    setEditingPoll(null);
    setDeletingPollId(null);
    setDeleteDialog(null);
  };

  const handleReport = (poll) => {
    const reports = JSON.parse(localStorage.getItem("rankr_reports") || "[]");
    const alreadyReported = reports.some((r) => r.pollId === poll.id && r.userId === currentUser?.id);
    if (alreadyReported) {
      setNoticeDialog({
        title: "Already reported",
        message: "You already reported this poll. Thanks for helping keep Rogue Rank fair.",
      });
      setMenuOpenFor(null);
      return;
    }
    setReportPoll(poll);
    setReportReason(REPORT_REASONS[0]);
    setReportDescription("");
    setMenuOpenFor(null);
  };

  const closeReportModal = () => {
    setReportPoll(null);
    setReportDescription("");
    setReportReason(REPORT_REASONS[0]);
  };

  const handleDraftReport = async () => {
    if (!reportPoll) return;

    const pollUrl = `${window.location.origin}/polls/${reportPoll.id}`;
    const optionalDescription = reportDescription.trim() || "Not provided";
    const subject = `Report poll: ${reportPoll.title}`;
    const body = [
      "Please review this poll.",
      "",
      `Poll ID: ${reportPoll.id}`,
      `Report reason: ${reportReason}`,
      `Optional description: ${optionalDescription}`,
      "",
      `Title: ${reportPoll.title}`,
      `Creator: ${reportPoll.creator || "Unknown"}`,
      pollUrl,
    ].join("\n");

    const { error: reportError } = await persistPollReport(
      reportPoll.id,
      reportReason,
      currentUser?.id
    );
    if (reportError) {
      console.error("Poll report save failed:", reportError);
    }

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(REPORT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");

    const reports = JSON.parse(localStorage.getItem("rankr_reports") || "[]");
    localStorage.setItem(
      "rankr_reports",
      JSON.stringify([
        ...reports,
        {
          pollId: reportPoll.id,
          title: reportPoll.title,
          userId: currentUser?.id || "guest",
          reason: reportReason,
          description: reportDescription.trim(),
          createdAt: Date.now(),
        },
      ])
    );
    closeReportModal();
  };

  const handleSavePoll = async (poll) => {
    let insertedNewPoll = false;

    try {
      const createdate = poll.createdAt || poll.createdate || Date.now();
      const pollRow = { title: poll.title, creator: poll.creator, creatorid: poll.creatorId, likes: poll.likes ?? 0, hashtags: poll.hashtags ?? [], thumbnail: poll.thumbnail || null };

      if (editingPoll) {
        const { error: pollError } = await supabase.from("polls").update(pollRow).eq("id", poll.id);
        if (pollError) throw pollError;
        const { error: deleteError } = await supabase.from("poll_options").delete().eq("poll_id", poll.id);
        if (deleteError) throw deleteError;
      } else {
        const { error: pollError } = await supabase.from("polls").insert({ id: poll.id, ...pollRow, createdate, total_votes: 0 });
        if (pollError) throw pollError;
        insertedNewPoll = true;
      }

      const optionRows = poll.options.map((option) => ({ id: option.id, poll_id: poll.id, text: option.text, image: null, image_url: option.image ?? null, migrated: Boolean(option.image), rating: option.rating ?? 1000, votes: option.votes ?? 0 }));
      const { error: optionsError } = await supabase.from("poll_options").insert(optionRows);
      if (optionsError) {
        if (insertedNewPoll) {
          await supabase.from("polls").delete().eq("id", poll.id);
        }
        throw optionsError;
      }

      const normalized = {
        ...normalizePoll({ ...poll, creatorid: poll.creatorId, createdate, total_votes: poll.total_votes ?? 0 }),
        creatorUsername: getPollCreatorUsername(poll),
      };
      setShowCreator(false);
      setEditingPoll(null);
      setPolls((prev) => editingPoll ? prev.map((item) => (item.id === poll.id ? normalized : item)) : [normalized, ...prev]);
    } catch (err) {
      console.error("Save poll failed:", err);
      throw err;
    }
  };

  return (
    <div className={styles.pollContainer}>
      {!selectedPoll && !showCreator && !editingPoll && (
        <>
          {/* HERO */}
          <div className={styles.heroSection}>
            <div className={styles.heroContent}>
              <span className={styles.heroBadge}>Rogue Rank</span>
              <h1 className={styles.heroTitle}>Find the <span>crowd favorite</span>, one matchup at a time.</h1>
              <p className={styles.heroSub}>Rogue Rank turns polls into live rankings. Create a set, vote through head-to-head choices, and watch the strongest options rise.</p>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.statBox}><span className={styles.statIcon}><HeroStatIcon name="polls" /></span><strong>{formatCount(polls.length)}</strong><span>polls</span></div>
              <div className={styles.statBox}><span className={styles.statIcon}><HeroStatIcon name="votes" /></span><strong>{formatCount(totalVotes)}</strong><span>total votes</span></div>
              <div className={styles.statBox}><span className={styles.statIcon}><HeroStatIcon name="options" /></span><strong>{formatCount(totalOptions)}</strong><span>options</span></div>
            </div>
          </div>

          {/* TRENDING */}
          {trendingPoll && (
            <div className={styles.trendingBanner}>
              <span className={styles.trendingLabel}>🔥 Trending Now</span>
              <div className={styles.trendingInner}>
                {getPollThumbnail(trendingPoll) && (
                  <img src={getPollThumbnail(trendingPoll)} alt={trendingPoll.title} className={styles.trendingImg} />
                )}
                <div className={styles.trendingMeta}>
                  <h2 className={styles.trendingTitle}>{trendingPoll.title}</h2>
                  <p className={styles.trendingCreator}>
                    by <Link href={getCreatorHref(trendingPoll)} className={styles.creatorLink}>{getPollCreatorHandle(trendingPoll)}</Link>
                  </p>
                  <div className={styles.trendingTags}>
                    {(trendingPoll.hashtags || []).slice(0, 3).map((tag) => (
                      <Link key={tag} href={getHashtagHref(tag)} className={styles.tag}>#{tag}</Link>
                    ))}
                  </div>
                  <p className={styles.trendingVotes}>{formatCount(trendingPoll.total_votes || 0)} votes • {formatCount(trendingPoll.likes || 0)} likes</p>
                  <button className={styles.trendingBtn} onClick={() => openPoll(trendingPoll)}>Vote Now</button>
                </div>
              </div>
            </div>
          )}

          {/* TABS */}
          <div className={styles.tabRow}>
            {["latest", "popular", "mostliked"].map((tab) => (
              <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`} onClick={() => setActiveTab(tab)}>
                {tab === "latest" ? "Latest" : tab === "popular" ? "Popular" : "Most Liked"}
              </button>
            ))}
          </div>

          {isLoadingPolls && <div className={styles.statePanel}>Loading polls...</div>}
          {loadError && <div className={styles.statePanel}>{loadError}</div>}
          {!isLoadingPolls && !loadError && sortedPolls.length === 0 && (
            <div className={styles.statePanel}>No polls found. Start one from the create button.</div>
          )}

          {/* CARD GRID */}
          <section className={styles.cardGrid}>
            {sortedPolls.map((poll) => (
              <PollGridCard
                key={poll.id}
                poll={poll}
                currentUser={currentUser}
                menuOpen={menuOpenFor === poll.id}
                isDeleting={deletingPollId === poll.id}
                onOpen={openPoll}
                onShare={handleShare}
                onLikeToggle={handleLikeToggle}
                onMenuToggle={(pollId) => setMenuOpenFor(menuOpenFor === pollId ? null : pollId)}
                onReport={handleReport}
                onDelete={handleDelete}
                onCoverUpdated={handleCoverUpdated}
              />
            ))}
            {isFetchingMorePolls && !isSearchActive && (
              <>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`feed-skeleton-${index}`} className={styles.feedSkeletonCard} aria-hidden="true" />
                ))}
              </>
            )}
          </section>
          <div ref={loadMoreRef} className={styles.feedSentinel} aria-hidden="true" />
          {!isLoadingPolls && !isSearchActive && !hasMorePolls && polls.length > 0 && (
            <div className={styles.feedEndMessage}>You've reached the end.</div>
          )}
        </>
      )}

      {(showCreator || editingPoll) && (
        <PollCreator mode={editingPoll ? "edit" : "create"} poll={editingPoll} currentUser={currentUser}
          onCancel={() => { setShowCreator(false); setEditingPoll(null); }}
          onCreate={handleSavePoll}
        />
      )}

      {selectedPoll && (
        <PairPoll poll={selectedPoll} onBack={() => setSelectedPoll(null)}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          onUpdate={(updatedPoll) => {
            setSelectedPoll((current) => current?.id === updatedPoll.id ? { ...current, ...updatedPoll } : current);
            setPolls((prev) => prev.map((poll) => poll.id === updatedPoll.id ? { ...poll, options: updatedPoll.options, total_votes: updatedPoll.total_votes } : poll));
          }}
        />
      )}

      {reportPoll && (
        <div className={styles.reportOverlay} role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={closeReportModal}>
          <div className={styles.reportModal} onClick={(event) => event.stopPropagation()}>
            <h2 id="report-title" className={styles.reportTitle}>Report poll</h2>
            <p className={styles.reportPollTitle}>{reportPoll.title}</p>

            <label className={styles.reportLabel} htmlFor="report-reason">Reason</label>
            <select
              id="report-reason"
              className={styles.reportSelect}
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
            >
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>

            <label className={styles.reportLabel} htmlFor="report-description">Optional description</label>
            <textarea
              id="report-description"
              className={styles.reportTextarea}
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              placeholder="Add context for the Rogue Rank team..."
              rows={5}
              maxLength={800}
            />

            <div className={styles.reportActions}>
              <button type="button" className={styles.reportCancelBtn} onClick={closeReportModal}>
                Cancel
              </button>
              <button type="button" className={styles.reportDraftBtn} onClick={handleDraftReport}>
                Draft in Gmail
              </button>
            </div>
          </div>
        </div>
      )}

      <ThemedModal
        open={Boolean(deleteDialog)}
        title="Delete poll?"
        tone="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        showCancel
        isBusy={Boolean(deletingPollId)}
        error={deleteDialog?.error}
        onCancel={() => {
          if (deletingPollId) return;
          setDeleteDialog(null);
        }}
        onConfirm={confirmDeletePoll}
      >
        <p>This will permanently delete:</p>
        <p className="themedModalPollTitle">{deleteDialog?.poll?.title || "Untitled poll"}</p>
        <p className="themedModalWarning">This cannot be undone.</p>
      </ThemedModal>

      <ThemedModal
        open={Boolean(noticeDialog)}
        title={noticeDialog?.title}
        message={noticeDialog?.message}
        confirmLabel="OK"
        onConfirm={() => setNoticeDialog(null)}
      />
    </div>
  );
}
