"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./MultiPoll.module.css";
import PairPoll from "./PairPoll";
import PollCreator from "./PollCreator";
import { supabase } from "../lib/supabaseClient";

const REPORT_EMAIL = "roguerankofficial@gmail.com";
const REPORT_REASONS = [
  "Spam or scam",
  "Offensive content",
  "Harassment or hate",
  "Inappropriate image",
  "Misleading poll",
  "Other",
];

function makeGuestUser() {
  return {
    id: `guest-${Math.random().toString(36).slice(2, 10)}`,
    username: "Guest",
    likes: [],
  };
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
  const [editingPoll, setEditingPoll] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingPollId, setDeletingPollId] = useState(null);
  const [activeTab, setActiveTab] = useState("latest");
  const [reportPoll, setReportPoll] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDescription, setReportDescription] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("rankr_user");
    if (!saved) {
      const guest = makeGuestUser();
      localStorage.setItem("rankr_user", JSON.stringify(guest));
      setCurrentUser(guest);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setCurrentUser({ ...parsed, likes: parsed.likes || [] });
    } catch {
      const guest = makeGuestUser();
      localStorage.setItem("rankr_user", JSON.stringify(guest));
      setCurrentUser(guest);
    }
  }, [setCurrentUser]);

  useEffect(() => {
    async function loadPolls() {
      setIsLoadingPolls(true);
      setLoadError("");
      const { data, error } = await supabase
        .from("polls")
        .select(`*, poll_options (id, text, image_url, rating, votes)`)
        .order("createdate", { ascending: false });

      if (error) {
        console.error("Error loading polls:", error);
        setLoadError("Polls could not be loaded. Check the backend connection and try again.");
        setIsLoadingPolls(false);
        return;
      }
      setPolls((data || []).map(normalizePoll));
      setIsLoadingPolls(false);
    }
    loadPolls();
  }, [setPolls]);

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
      if (filter === "creators") return poll.creator?.toLowerCase().includes(query);
      if (filter === "hashtags") return (poll.hashtags || []).some((tag) => tag.toLowerCase().includes(query));
      if (filter === "options") return (poll.options || []).some((o) => o.text?.toLowerCase().includes(query));
      return [poll.title, poll.creator, ...(poll.hashtags || []), ...(poll.options || []).map((o) => o.text)]
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
    localStorage.setItem("rankr_user", JSON.stringify(nextUser));
    setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, likes: nextLikes } : p)));
    const { error } = await supabase.from("polls").update({ likes: nextLikes }).eq("id", pollId);
    if (error) {
      console.error("Like update failed:", error);
      setCurrentUser(currentUser);
      localStorage.setItem("rankr_user", JSON.stringify(currentUser));
      setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, likes: poll.likes } : p)));
    }
  };

  const handleShare = (poll) => {
    const url = `${window.location.origin}/polls/${poll.id}`;
    if (navigator.share) {
      navigator.share({ title: poll.title, url });
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  };

  const openPoll = (poll) => {
    if (!poll?.id) return;
    router.push(`/polls/${poll.id}`);
  };

  const handleDelete = async (pollId) => {
    if (!confirm("Delete this poll?")) return;
    setDeletingPollId(pollId);
    const { error: optionsError } = await supabase.from("poll_options").delete().eq("poll_id", pollId);
    if (optionsError) {
      alert("Could not delete poll options.");
      setDeletingPollId(null);
      return;
    }
    const { error: pollError } = await supabase.from("polls").delete().eq("id", pollId);
    if (pollError) {
      alert("Could not delete this poll.");
      setDeletingPollId(null);
      return;
    }
    setPolls((prev) => prev.filter((poll) => poll.id !== pollId));
    setMenuOpenFor(null);
    setEditingPoll(null);
    setDeletingPollId(null);
  };

  const handleReport = (poll) => {
    const reports = JSON.parse(localStorage.getItem("rankr_reports") || "[]");
    const alreadyReported = reports.some((r) => r.pollId === poll.id && r.userId === currentUser?.id);
    if (alreadyReported) {
      alert("You already reported this poll.");
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

  const handleDraftReport = () => {
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

      const normalized = normalizePoll({ ...poll, creatorid: poll.creatorId, createdate, total_votes: poll.total_votes ?? 0 });
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
              <h1 className={styles.heroTitle}>Find the crowd favorite, one matchup at a time.</h1>
              <p className={styles.heroSub}>Rogue Rank turns polls into live rankings. Create a set, vote through head-to-head choices, and watch the strongest options rise.</p>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.statBox}><strong>{formatCount(polls.length)}</strong><span>polls</span></div>
              <div className={styles.statBox}><strong>{formatCount(totalVotes)}</strong><span>total votes</span></div>
              <div className={styles.statBox}><strong>{formatCount(totalOptions)}</strong><span>options</span></div>
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
                    by <Link href={getCreatorHref(trendingPoll)} className={styles.creatorLink}>{trendingPoll.creator}</Link>
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
            {sortedPolls.map((poll) => {
              const liked = currentUser?.likes?.includes(poll.id);
              const canManage = currentUser?.id === poll.creatorId || (!poll.creatorId && currentUser?.username === poll.creator);
              const isDeleting = deletingPollId === poll.id;
              const voteCount = poll.total_votes ?? poll.options.reduce((sum, option) => sum + (option.votes || 0), 0);
              const thumbnail = getPollThumbnail(poll);

              return (
                <article key={poll.id} className={styles.pollCard}>
                  {/* ✅ THUMBNAIL */}
                  <div className={styles.cardThumb} onClick={() => openPoll(poll)} style={{ cursor: "pointer" }}>
                    {thumbnail ? (
                      <img src={thumbnail} alt={poll.title} className={styles.cardThumbImg} />
                    ) : (
                      <div className={styles.cardThumbPlaceholder}>
                        {poll.title?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  <div className={styles.cardTop}>
                    <div className={styles.cardTitleGroup}>
                      <strong className={styles.cardTitle}>{poll.title}</strong>
                      <span className={styles.cardCreator}>
                        by <Link href={getCreatorHref(poll)} className={styles.creatorLink}>{poll.creator}</Link>
                      </span>
                      <span className={styles.cardCreatedAt}>{formatTimeAgo(poll.createdAt || poll.createdate)}</span>
                    </div>
                    <div className={styles.menuWrap}>
                      <button onClick={(e) => { e.stopPropagation(); setMenuOpenFor(menuOpenFor === poll.id ? null : poll.id); }} className={styles.iconButton} aria-label="Poll actions">•••</button>
                      {menuOpenFor === poll.id && (
                        <div className={styles.menu}>
                          <button onClick={(e) => { e.stopPropagation(); handleReport(poll); }}>⚠ Report</button>
                          {canManage && (
                            <button className={styles.dangerItem} disabled={isDeleting} onClick={(e) => { e.stopPropagation(); handleDelete(poll.id); }}>
                              🗑 {isDeleting ? "Deleting..." : "Delete poll"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ✅ ALL HASHTAGS visible — no truncation */}
                  {poll.hashtags?.length > 0 && (
                    <div className={styles.tagRow}>
                      {poll.hashtags.map((tag) => (
                        <Link key={tag} href={getHashtagHref(tag)} className={styles.tag}>#{tag}</Link>
                      ))}
                    </div>
                  )}

                  <div className={styles.cardStats}>
                    <span>{formatCount(poll.options.length)} options</span>
                    <span>{formatCount(voteCount)} votes</span>
                    <span>{formatCount(poll.likes)} likes</span>
                  </div>

                  <div className={styles.cardBottom}>
                    <button className={styles.cardButton} onClick={() => openPoll(poll)}>Vote / View</button>
                    <button className={styles.cardButtonShare} onClick={() => handleShare(poll)}>Share</button>
                    {/* ✅ LIKE — empty → filled red */}
                    <button className={`${styles.cardButtonLike} ${liked ? styles.liked : ""}`} onClick={() => handleLikeToggle(poll.id)} aria-label="Like">
                      {liked ? "♥" : "♡"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
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
    </div>
  );
}
