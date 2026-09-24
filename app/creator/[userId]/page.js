"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import LeftMenu from "../../components/LeftMenu";
import PollGridCard from "../../components/PollGridCard";
import ThemedModal from "../../components/ThemedModal";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { applyCreatorProfilesToPolls } from "../../lib/creatorProfiles";
import { getUserProfile } from "../../lib/pollEngagement";
import { supabase } from "../../lib/supabaseClient";
import cardStyles from "../../components/MultiPoll.module.css";
import pageStyles from "../../page.module.css";
import styles from "./CreatorProfile.module.css";

const REPORT_EMAIL = "roguerankofficial@gmail.com";

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

export default function CreatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = decodeURIComponent(String(params?.userId || ""));
  const [isMenuOpen, setMenuOpen] = useState(false);
  const { currentUser, setCurrentUser, isCurrentUserLoading } = useCurrentUser();
  const [polls, setPolls] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [deletingPollId, setDeletingPollId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [noticeDialog, setNoticeDialog] = useState(null);

  const loadProfileData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    const [pollResult, profileResult] = await Promise.all([
      supabase
        .from("polls")
        .select("*, poll_options (id, text, image_url, rating, votes)")
        .order("createdate", { ascending: false }),
      getUserProfile(userId),
    ]);

    if (pollResult.error) {
      console.error("Error loading creator profile:", pollResult.error);
      setLoadError("Creator profile could not be loaded.");
      setIsLoading(false);
      return;
    }

    if (profileResult.error) {
      console.error("Error loading user profile:", profileResult.error);
    }

    setPolls(await applyCreatorProfilesToPolls((pollResult.data || []).map(normalizePoll)));
    setUserProfile(profileResult.data || null);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    function handleFocus() {
      loadProfileData();
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadProfileData]);

  useEffect(() => {
    if (!menuOpenFor) return;
    function handleOutsideClick() {
      setMenuOpenFor(null);
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [menuOpenFor]);

  const creatorPolls = useMemo(
    () =>
      polls
        .filter((poll) => String(poll.creatorId || poll.creator) === userId)
        .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)),
    [polls, userId]
  );

  const isOwnProfile = currentUser?.id && String(currentUser.id) === userId;
  const legacyCreatorName = isOwnProfile
    ? currentUser?.username || "Guest"
    : creatorPolls[0]?.creator || "";
  const creatorUsername = userProfile?.username || (isOwnProfile ? currentUser?.username : "") || creatorPolls[0]?.creatorUsername || legacyCreatorName || "guest";
  const creatorName = userProfile?.name || (isOwnProfile ? currentUser?.name : "") || creatorPolls[0]?.creatorName || "";
  const showCreatorName = creatorName.trim() && creatorName.trim().toLowerCase() !== creatorUsername.trim().toLowerCase();
  const creatorBio = userProfile?.bio || (isOwnProfile ? currentUser?.bio : "");
  const creatorProfilePic = userProfile?.profile_pic || (isOwnProfile ? currentUser?.pfp : "");
  const creatorExists =
    Boolean(userProfile) || isOwnProfile || creatorPolls.length > 0 || isCurrentUserLoading;
  const joinedAt = userProfile?.created_at || (isOwnProfile
    ? currentUser?.joinedAt || Date.now()
    : creatorPolls.reduce((oldest, poll) => {
        const created = Number(poll.createdAt) || oldest;
        return Math.min(oldest, created);
      }, Number(creatorPolls[0]?.createdAt) || Date.now()));
  const totalVotes = creatorPolls.reduce((sum, poll) => sum + (poll.total_votes || 0), 0);
  const totalLikes = creatorPolls.reduce((sum, poll) => sum + (poll.likes || 0), 0);

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
      setNoticeDialog({ title: "Link copied", message: "The poll link is ready to share." });
    }
  };

  const handleLikeToggle = async (pollId) => {
    const poll = polls.find((item) => item.id === pollId);
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
    setPolls((prev) =>
      prev.map((item) => (item.id === pollId ? { ...item, likes: nextLikes } : item))
    );

    const { error } = await supabase.from("polls").update({ likes: nextLikes }).eq("id", pollId);
    if (error) {
      console.error("Like update failed:", error);
      setCurrentUser(currentUser);
      setPolls((prev) =>
        prev.map((item) => (item.id === pollId ? { ...item, likes: poll.likes } : item))
      );
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
    const alreadyReported = reports.some(
      (report) => report.pollId === poll.id && report.userId === currentUser?.id
    );
    if (alreadyReported) {
      setNoticeDialog({
        title: "Already reported",
        message: "You already reported this poll. Thanks for helping keep Rogue Rank fair.",
      });
      setMenuOpenFor(null);
      return;
    }

    const pollUrl = `${window.location.origin}/polls/${poll.id}`;
    const subject = `Report poll: ${poll.title}`;
    const body = [
      "Please review this poll.",
      "",
      `Poll ID: ${poll.id}`,
      `Title: ${poll.title}`,
      `Creator: ${poll.creator || "Unknown"}`,
      pollUrl,
    ].join("\n");
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(REPORT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.open(gmailUrl, "_blank", "noopener,noreferrer");
    localStorage.setItem(
      "rankr_reports",
      JSON.stringify([
        ...reports,
        {
          pollId: poll.id,
          title: poll.title,
          userId: currentUser?.id || "guest",
          reason: "Profile page report",
          description: "",
          createdAt: Date.now(),
        },
      ])
    );
    setMenuOpenFor(null);
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

            {isLoading && <div className={styles.statePanel}>Loading creator...</div>}
            {!isLoading && loadError && <div className={styles.statePanel}>{loadError}</div>}
            {!isLoading && !loadError && !creatorExists && (
              <div className={styles.statePanel}>Creator not found.</div>
            )}

            {!isLoading && !loadError && isCurrentUserLoading && !userProfile && creatorPolls.length === 0 && (
              <div className={styles.statePanel}>Loading creator...</div>
            )}

            {!isLoading && !loadError && !isCurrentUserLoading && creatorExists && (
              <>
                <section className={styles.profileHeader}>
                  <div className={styles.profileAvatar} aria-hidden="true">
                    {creatorProfilePic ? (
                      <img src={creatorProfilePic} alt="" className={styles.profileAvatarImg} />
                    ) : (
                      <span>{creatorUsername?.[0]?.toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <div className={styles.profileMeta}>
                    <p className={styles.eyebrow}>Creator Profile</p>
                    {showCreatorName && <p className={styles.displayName}>{creatorName}</p>}
                    <h1 className={styles.creatorName}>@{creatorUsername}</h1>
                    <p className={styles.joinDate}>{formatJoinedDate(joinedAt)}</p>
                    {creatorBio?.trim() && <p className={styles.creatorBio}>{creatorBio}</p>}
                  </div>

                  {isOwnProfile && (
                    <Link href="/?account=1" className={styles.editButton}>
                      Edit profile
                    </Link>
                  )}

                  <div className={styles.statsRow}>
                    <div><span className={styles.statIcon}><StatIcon name="polls" /></span><strong>{formatCount(creatorPolls.length)}</strong><span>polls created</span></div>
                    <div><span className={styles.statIcon}><StatIcon name="votes" /></span><strong>{formatCount(totalVotes)}</strong><span>total votes</span></div>
                    <div><span className={styles.statIcon}><StatIcon name="likes" /></span><strong>{formatCount(totalLikes)}</strong><span>total likes</span></div>
                  </div>
                </section>

                <section className={styles.pollsSection}>
                  <h2 className={styles.sectionTitle}>Polls by @{creatorUsername}</h2>

                  {creatorPolls.length === 0 ? (
                    <div className={styles.statePanel}>No polls created yet.</div>
                  ) : (
                    <div className={cardStyles.cardGrid}>
                      {creatorPolls.map((poll) => (
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
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </main>

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
