"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import LeftMenu from "../components/LeftMenu";
import PollGridCard from "../components/PollGridCard";
import ThemedModal from "../components/ThemedModal";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { applyCreatorProfilesToPolls } from "../lib/creatorProfiles";
import { reportPoll as persistPollReport } from "../lib/pollEngagement";
import { POLL_IMAGES_BUCKET } from "../lib/storageImages";
import { supabase } from "../lib/supabaseClient";
import cardStyles from "../components/MultiPoll.module.css";
import pageStyles from "../page.module.css";
import styles from "./MyPolls.module.css";

const REPORT_EMAIL = "roguerankofficial@gmail.com";
const REPORT_REASONS = [
  "Spam or scam",
  "Offensive content",
  "Harassment or hate",
  "Inappropriate image",
  "Misleading poll",
  "Other",
];

function normalizePoll(row) {
  const options = (row.poll_options || [])
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((option) => ({
      id: option.id,
      text: option.text,
      image: option.image_url ?? option.image,
      rating: option.rating ?? 1000,
      votes: option.votes ?? 0,
    }));

  return {
    id: row.id,
    title: row.title,
    creator: row.creator,
    creatorId: row.creatorid ?? row.creator_id ?? row.creatorId,
    likes: row.likes ?? 0,
    total_votes:
      row.total_votes ??
      options.reduce((sum, option) => sum + (option.votes || 0), 0),
    hashtags: row.hashtags || [],
    createdAt: row.createdate ?? row.createdAt,
    thumbnail: row.thumbnail || null,
    options,
  };
}

function formatCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function formatJoinedDate(timestamp) {
  const parsed = typeof timestamp === "string" ? Date.parse(timestamp) : Number(timestamp);
  const joined = Number.isFinite(parsed) ? parsed : Date.now();
  const days = Math.max(0, Math.floor((Date.now() - joined) / (24 * 60 * 60 * 1000)));

  if (days === 0) return "Joined today";
  if (days === 1) return "Joined 1 day ago";
  if (days < 30) return `Joined ${days} days ago`;

  const months = Math.floor(days / 30);
  if (months === 1) return "Joined 1 month ago";
  if (months < 12) return `Joined ${months} months ago`;

  const years = Math.floor(days / 365);
  return years === 1 ? "Joined 1 year ago" : `Joined ${years} years ago`;
}

function StatIcon({ name }) {
  const common = {
    width: "18",
    height: "18",
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
        <path d="M7 7h10" />
        <path d="M7 12h10" />
        <path d="M7 17h7" />
        <path d="M4 7h.01" />
        <path d="M4 12h.01" />
        <path d="M4 17h.01" />
      </>
    ),
    votes: (
      <>
        <path d="M7 18v-7" />
        <path d="M12 18V6" />
        <path d="M17 18v-4" />
        <path d="M5 18h14" />
      </>
    ),
    likes: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
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

export default function MyPollsPage() {
  const router = useRouter();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const { currentUser, setCurrentUser, isCurrentUserLoading } = useCurrentUser();
  const [polls, setPolls] = useState([]);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [deletingPollId, setDeletingPollId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [noticeDialog, setNoticeDialog] = useState(null);
  const [reportPoll, setReportPoll] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDescription, setReportDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");

  const loadPolls = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("polls")
      .select("*, poll_options (id, text, image_url, rating, votes)")
      .order("createdate", { ascending: false });

    if (error) {
      console.error("Error loading my polls:", error);
      setLoadError("Your polls could not be loaded.");
      setIsLoading(false);
      return;
    }

    setPolls(await applyCreatorProfilesToPolls((data || []).map(normalizePoll)));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  useEffect(() => {
    function handleFocus() {
      loadPolls();
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadPolls]);

  const myPolls = useMemo(
    () =>
      polls.filter((poll) => currentUser?.id && String(poll.creatorId) === String(currentUser.id)),
    [polls, currentUser]
  );
  const username = currentUser?.username || "Guest";
  const displayName = currentUser?.name || "";
  const showDisplayName = displayName.trim() && displayName.trim().toLowerCase() !== username.trim().toLowerCase();
  const totalVotes = myPolls.reduce((sum, poll) => sum + (poll.total_votes || 0), 0);
  const totalLikes = myPolls.reduce((sum, poll) => sum + (poll.likes || 0), 0);

  const openPoll = (poll) => {
    if (!poll?.id) return;
    setMenuOpen(false);
    router.push(`/polls/${poll.id}`);
  };

  const handleShare = (poll) => {
    const url = `${window.location.origin}/polls/${poll.id}`;
    if (navigator.share) {
      navigator.share({ title: poll.title, url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const handleLikeToggle = async (pollId) => {
    const poll = polls.find((item) => item.id === pollId);
    if (!poll || !currentUser) return;

    const liked = currentUser.likes?.includes(pollId);
    const nextLikes = Math.max(0, liked ? (poll.likes || 0) - 1 : (poll.likes || 0) + 1);
    const nextUser = {
      ...currentUser,
      likes: liked
        ? currentUser.likes.filter((id) => id !== pollId)
        : [...(currentUser.likes || []), pollId],
    };

    setCurrentUser(nextUser);
    setPolls((prev) => prev.map((item) => (item.id === pollId ? { ...item, likes: nextLikes } : item)));

    const { error } = await supabase.from("polls").update({ likes: nextLikes }).eq("id", pollId);
    if (error) {
      console.error("Like update failed:", error);
      setCurrentUser(currentUser);
      setPolls((prev) => prev.map((item) => (item.id === pollId ? { ...item, likes: poll.likes } : item)));
    }
  };

  const handleDelete = (poll) => {
    setMenuOpenFor(null);
    setDeleteDialog({ poll, error: "" });
  };

  const handleCoverUpdated = (pollId, thumbnail) => {
    setPolls((prev) =>
      prev.map((poll) => (poll.id === pollId ? { ...poll, thumbnail } : poll))
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
        ...(optionImageData || []).map((option) => getStoragePathFromPublicUrl(option.image_url)),
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
    setDeletingPollId(null);
    setDeleteDialog(null);
  };

  const handleReport = (poll) => {
    const reports = JSON.parse(localStorage.getItem("rankr_reports") || "[]");
    const alreadyReported = reports.some((report) => report.pollId === poll.id && report.userId === currentUser?.id);
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

  const openRandomPoll = () => {
    if (!polls.length) return;
    openPoll(polls[Math.floor(Math.random() * polls.length)]);
  };

  return (
    <div className={pageStyles.appShell}>
      <LeftMenu
        isOpen={isMenuOpen}
        onClose={() => setMenuOpen(false)}
        onRandomPoll={openRandomPoll}
        currentUser={currentUser}
        polls={polls}
        onSelectPoll={openPoll}
      />

      <main className={pageStyles.mainShell}>
        <Header
          onMenuClick={() => setMenuOpen(true)}
          onCreateClick={() => router.push("/?create=1")}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          isCurrentUserLoading={isCurrentUserLoading}
          polls={polls}
        />

        <div className={pageStyles.contentScroll}>
          <div className={styles.wrap}>
            <button className={styles.backButton} onClick={() => router.back()} type="button">
              Back
            </button>

            <section className={styles.profileHeader}>
              <div className={styles.profileAvatar} aria-hidden="true">
                {currentUser?.pfp ? (
                  <img src={currentUser.pfp} alt="" className={styles.profileAvatarImg} />
                ) : (
                  <span>{username?.[0]?.toUpperCase() || "G"}</span>
                )}
              </div>
              <div className={styles.profileMeta}>
                <p className={styles.eyebrow}>Your Studio</p>
                {showDisplayName && <p className={styles.displayName}>{displayName}</p>}
                <h1 className={styles.title}>My Polls</h1>
                <p className={styles.joinDate}>{formatJoinedDate(currentUser?.joinedAt)}</p>
                <p className={styles.subtext}>All the polls you created, collected in one place.</p>
                {currentUser?.bio?.trim() && <p className={styles.creatorBio}>{currentUser.bio}</p>}
              </div>

              <button className={styles.createButton} onClick={() => router.push("/?create=1")} type="button">
                Create Poll
              </button>
              <div className={styles.statsRow}>
                <div><span className={styles.statIcon}><StatIcon name="polls" /></span><strong>{formatCount(myPolls.length)}</strong><span>polls created</span></div>
                <div><span className={styles.statIcon}><StatIcon name="votes" /></span><strong>{formatCount(totalVotes)}</strong><span>total votes</span></div>
                <div><span className={styles.statIcon}><StatIcon name="likes" /></span><strong>{formatCount(totalLikes)}</strong><span>total likes</span></div>
              </div>
            </section>

            {isLoading && <div className={styles.statePanel}>Loading your polls...</div>}
            {!isLoading && loadError && <div className={styles.statePanel}>{loadError}</div>}
            {!isLoading && !loadError && isCurrentUserLoading && (
              <div className={styles.statePanel}>Loading your profile...</div>
            )}
            {!isLoading && !loadError && !isCurrentUserLoading && myPolls.length === 0 && (
              <div className={styles.emptyState}>
                <h2>No polls created yet</h2>
                <p>Start a poll and it will appear here automatically.</p>
                <button className={styles.createButton} onClick={() => router.push("/?create=1")} type="button">
                  Create your first poll
                </button>
              </div>
            )}

            {!isLoading && !loadError && !isCurrentUserLoading && myPolls.length > 0 && (
              <section className={cardStyles.cardGrid}>
                {myPolls.map((poll) => (
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
              </section>
            )}
          </div>
        </div>
      </main>

      {reportPoll && (
        <div className={cardStyles.reportOverlay} role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={closeReportModal}>
          <div className={cardStyles.reportModal} onClick={(event) => event.stopPropagation()}>
            <h2 id="report-title" className={cardStyles.reportTitle}>Report poll</h2>
            <p className={cardStyles.reportPollTitle}>{reportPoll.title}</p>

            <label className={cardStyles.reportLabel} htmlFor="my-polls-report-reason">Reason</label>
            <select
              id="my-polls-report-reason"
              className={cardStyles.reportSelect}
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
            >
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>

            <label className={cardStyles.reportLabel} htmlFor="my-polls-report-description">Optional description</label>
            <textarea
              id="my-polls-report-description"
              className={cardStyles.reportTextarea}
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              placeholder="Add context for the Rogue Rank team..."
              rows={5}
              maxLength={800}
            />

            <div className={cardStyles.reportActions}>
              <button type="button" className={cardStyles.reportCancelBtn} onClick={closeReportModal}>
                Cancel
              </button>
              <button type="button" className={cardStyles.reportDraftBtn} onClick={handleDraftReport}>
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
