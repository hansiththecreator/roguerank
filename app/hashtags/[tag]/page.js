"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import LeftMenu from "../../components/LeftMenu";
import { supabase } from "../../lib/supabaseClient";
import pageStyles from "../../page.module.css";
import styles from "./HashtagPage.module.css";

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
    creatorId: row.creatorid,
    likes: row.likes ?? 0,
    total_votes:
      row.total_votes ??
      options.reduce((sum, option) => sum + (option.votes || 0), 0),
    hashtags: row.hashtags || [],
    createdAt: row.createdate,
    thumbnail: row.thumbnail || null,
    options,
  };
}

function normalizeTag(tag) {
  return decodeURIComponent(String(tag || ""))
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
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

export default function HashtagPage() {
  const params = useParams();
  const router = useRouter();
  const tag = normalizeTag(params?.tag);
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

  useEffect(() => {
    let isActive = true;

    async function loadPolls() {
      setIsLoading(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("polls")
        .select("*, poll_options (id, text, image_url, rating, votes)")
        .order("createdate", { ascending: false });

      if (!isActive) return;

      if (error) {
        console.error("Error loading hashtag polls:", error);
        setLoadError("Polls could not be loaded. Check the backend connection and try again.");
        setIsLoading(false);
        return;
      }

      setPolls((data || []).map(normalizePoll));
      setIsLoading(false);
    }

    loadPolls();

    return () => {
      isActive = false;
    };
  }, []);

  const taggedPolls = useMemo(
    () =>
      polls.filter((poll) =>
        (poll.hashtags || []).some((pollTag) => normalizeTag(pollTag) === tag)
      ),
    [polls, tag]
  );

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
            <div className={styles.headerRow}>
              <div>
                <span className={styles.eyebrow}>Hashtag</span>
                <h1 className={styles.title}>#{tag || "unknown"}</h1>
                <p className={styles.subtext}>
                  {isLoading ? "Loading polls..." : `${taggedPolls.length} poll${taggedPolls.length === 1 ? "" : "s"} found`}
                </p>
              </div>
              <button className={styles.closeButton} onClick={() => router.push("/")} type="button">
                Close
              </button>
            </div>

            {loadError && <div className={styles.statePanel}>{loadError}</div>}
            {!loadError && isLoading && <div className={styles.statePanel}>Loading polls...</div>}
            {!loadError && !isLoading && taggedPolls.length === 0 && (
              <div className={styles.statePanel}>No polls found for #{tag}.</div>
            )}

            <section className={styles.grid}>
              {taggedPolls.map((poll) => {
                const thumbnail = getPollThumbnail(poll);

                return (
                  <article key={poll.id} className={styles.card}>
                    <Link className={styles.thumb} href={`/polls/${poll.id}`}>
                      {thumbnail ? (
                        <img src={thumbnail} alt={poll.title} className={styles.thumbImg} />
                      ) : (
                        <div className={styles.thumbPlaceholder}>{poll.title?.[0]?.toUpperCase() || "?"}</div>
                      )}
                    </Link>

                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{poll.title}</h2>
                      <p className={styles.creator}>by {poll.creator || "Guest"}</p>
                      <div className={styles.stats}>
                        <span>{formatCount(poll.options.length)} options</span>
                        <span>{formatCount(poll.total_votes)} votes</span>
                        <span>{formatCount(poll.likes)} likes</span>
                      </div>
                      <button className={styles.voteButton} onClick={() => openPoll(poll)} type="button">
                        Vote / View
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
