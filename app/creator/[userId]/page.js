"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import LeftMenu from "../../components/LeftMenu";
import { supabase } from "../../lib/supabaseClient";
import pageStyles from "../../page.module.css";
import styles from "./CreatorProfile.module.css";

function makeGuestUser() {
  return {
    id: `guest-${Math.random().toString(36).slice(2, 10)}`,
    username: "Guest",
    likes: [],
  };
}

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
  const joined = Number(timestamp) || Date.now();
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

function getPollThumbnail(poll) {
  if (poll.thumbnail) return poll.thumbnail;
  const withImage = (poll.options || []).filter((option) => option.image);
  if (!withImage.length) return null;
  return [...withImage].sort((a, b) => (b.votes || 0) - (a.votes || 0))[0].image;
}

export default function CreatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = decodeURIComponent(String(params?.userId || ""));
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [polls, setPolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");

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
  }, []);

  const loadPolls = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("polls")
      .select("*, poll_options (id, text, image_url, rating, votes)")
      .order("createdate", { ascending: false });

    if (error) {
      console.error("Error loading creator profile:", error);
      setLoadError("Creator profile could not be loaded.");
      setIsLoading(false);
      return;
    }

    setPolls((data || []).map(normalizePoll));
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

  const creatorPolls = useMemo(
    () =>
      polls
        .filter((poll) => String(poll.creatorId || poll.creator) === userId)
        .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)),
    [polls, userId]
  );

  const isOwnProfile = currentUser?.id && String(currentUser.id) === userId;
  const creatorName = isOwnProfile
    ? currentUser?.username || "Guest"
    : creatorPolls[0]?.creator || "";
  const creatorExists = isOwnProfile || creatorPolls.length > 0;
  const joinedAt = isOwnProfile
    ? currentUser?.joinedAt || Date.now()
    : creatorPolls.reduce((oldest, poll) => {
        const created = Number(poll.createdAt) || oldest;
        return Math.min(oldest, created);
      }, Number(creatorPolls[0]?.createdAt) || Date.now());
  const totalVotes = creatorPolls.reduce((sum, poll) => sum + (poll.total_votes || 0), 0);
  const totalLikes = creatorPolls.reduce((sum, poll) => sum + (poll.likes || 0), 0);

  const openPoll = (poll) => {
    if (!poll?.id) return;
    setMenuOpen(false);
    router.push(`/polls/${poll.id}`);
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

            {!isLoading && !loadError && creatorExists && (
              <>
                <section className={styles.profileHeader}>
                  <div className={styles.profileMeta}>
                    <p className={styles.eyebrow}>Creator Profile</p>
                    <h1 className={styles.creatorName}>{creatorName}</h1>
                    <p className={styles.joinDate}>{formatJoinedDate(joinedAt)}</p>
                  </div>

                  {isOwnProfile && (
                    <Link href="/?account=1" className={styles.editButton}>
                      Edit profile
                    </Link>
                  )}

                  <div className={styles.statsRow}>
                    <div><strong>{formatCount(creatorPolls.length)}</strong><span>polls created</span></div>
                    <div><strong>{formatCount(totalVotes)}</strong><span>total votes</span></div>
                    <div><strong>{formatCount(totalLikes)}</strong><span>total likes</span></div>
                  </div>
                </section>

                <section className={styles.pollsSection}>
                  <h2 className={styles.sectionTitle}>Polls by {creatorName}</h2>

                  {creatorPolls.length === 0 ? (
                    <div className={styles.statePanel}>No polls created yet.</div>
                  ) : (
                    <div className={styles.pollGrid}>
                      {creatorPolls.map((poll) => {
                        const thumbnail = getPollThumbnail(poll);
                        const voteCount = poll.total_votes ?? poll.options.reduce((sum, option) => sum + (option.votes || 0), 0);

                        return (
                          <article key={poll.id} className={styles.pollCard}>
                            <Link href={`/polls/${poll.id}`} className={styles.thumb}>
                              {thumbnail ? (
                                <img src={thumbnail} alt={poll.title} className={styles.thumbImg} />
                              ) : (
                                <div className={styles.thumbPlaceholder}>{poll.title?.[0]?.toUpperCase() || "?"}</div>
                              )}
                            </Link>

                            <div className={styles.cardBody}>
                              <h3 className={styles.cardTitle}>{poll.title}</h3>
                              {poll.hashtags?.length > 0 && (
                                <div className={styles.tagRow}>
                                  {poll.hashtags.slice(0, 4).map((tag) => (
                                    <span key={tag} className={styles.tag}>#{tag}</span>
                                  ))}
                                </div>
                              )}
                              <div className={styles.cardStats}>
                                <span>{formatCount(poll.options.length)} options</span>
                                <span>{formatCount(voteCount)} votes</span>
                                <span>{formatCount(poll.likes)} likes</span>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
