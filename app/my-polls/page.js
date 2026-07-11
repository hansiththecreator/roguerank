"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import LeftMenu from "../components/LeftMenu";
import { supabase } from "../lib/supabaseClient";
import pageStyles from "../page.module.css";
import styles from "./MyPolls.module.css";

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

function getPollThumbnail(poll) {
  if (poll.thumbnail) return poll.thumbnail;
  const withImage = (poll.options || []).filter((option) => option.image);
  if (!withImage.length) return null;
  return [...withImage].sort((a, b) => (b.votes || 0) - (a.votes || 0))[0].image;
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

export default function MyPollsPage() {
  const router = useRouter();
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
      console.error("Error loading my polls:", error);
      setLoadError("Your polls could not be loaded.");
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

  const myPolls = useMemo(
    () =>
      polls.filter((poll) => currentUser?.id && String(poll.creatorId) === String(currentUser.id)),
    [polls, currentUser]
  );
  const totalVotes = myPolls.reduce((sum, poll) => sum + (poll.total_votes || 0), 0);
  const totalLikes = myPolls.reduce((sum, poll) => sum + (poll.likes || 0), 0);

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
            <section className={styles.hero}>
              <div>
                <p className={styles.eyebrow}>Your Studio</p>
                <h1 className={styles.title}>My Polls</h1>
                <p className={styles.subtext}>All the polls you created, collected in one place.</p>
              </div>
              <button className={styles.createButton} onClick={() => router.push("/?create=1")} type="button">
                Create Poll
              </button>
              <div className={styles.statsRow}>
                <div><strong>{formatCount(myPolls.length)}</strong><span>polls</span></div>
                <div><strong>{formatCount(totalVotes)}</strong><span>votes</span></div>
                <div><strong>{formatCount(totalLikes)}</strong><span>likes</span></div>
              </div>
            </section>

            {isLoading && <div className={styles.statePanel}>Loading your polls...</div>}
            {!isLoading && loadError && <div className={styles.statePanel}>{loadError}</div>}
            {!isLoading && !loadError && myPolls.length === 0 && (
              <div className={styles.emptyState}>
                <h2>No polls created yet</h2>
                <p>Start a poll and it will appear here automatically.</p>
                <button className={styles.createButton} onClick={() => router.push("/?create=1")} type="button">
                  Create your first poll
                </button>
              </div>
            )}

            {!isLoading && !loadError && myPolls.length > 0 && (
              <section className={styles.grid}>
                {myPolls.map((poll) => {
                  const thumbnail = getPollThumbnail(poll);
                  const voteCount = poll.total_votes ?? poll.options.reduce((sum, option) => sum + (option.votes || 0), 0);

                  return (
                    <article key={poll.id} className={styles.card}>
                      <Link href={`/polls/${poll.id}`} className={styles.thumb}>
                        {thumbnail ? (
                          <img src={thumbnail} alt={poll.title} className={styles.thumbImg} />
                        ) : (
                          <div className={styles.thumbPlaceholder}>{poll.title?.[0]?.toUpperCase() || "?"}</div>
                        )}
                      </Link>
                      <div className={styles.cardBody}>
                        <h2 className={styles.cardTitle}>{poll.title}</h2>
                        <p className={styles.createdAt}>{formatTimeAgo(poll.createdAt)}</p>
                        {poll.hashtags?.length > 0 && (
                          <div className={styles.tagRow}>
                            {poll.hashtags.slice(0, 5).map((tag) => (
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
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
