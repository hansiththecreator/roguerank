"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import LeftMenu from "../components/LeftMenu";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { supabase } from "../lib/supabaseClient";
import pageStyles from "../page.module.css";
import feedStyles from "../components/MultiPoll.module.css";
import styles from "./AllHashtags.module.css";

const TAG_PAGE_SIZE = 20;
const TAB_OPTIONS = [
  { id: "popular", label: "Popular", sortColumn: "vote_count" },
  { id: "mostliked", label: "Most Liked", sortColumn: "like_count" },
];

function formatCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function normalizeTagSummary(row) {
  return {
    tag: row.tag,
    polls: row.poll_count ?? 0,
    votes: row.vote_count ?? 0,
    likes: row.like_count ?? 0,
  };
}

function getSortColumn(activeTab) {
  return TAB_OPTIONS.find((tab) => tab.id === activeTab)?.sortColumn || "vote_count";
}

export default function HashtagsPage() {
  const router = useRouter();
  const loadMoreRef = useRef(null);
  const isFetchingMoreRef = useRef(false);
  const { currentUser, setCurrentUser, isCurrentUserLoading } = useCurrentUser();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [activeTab, setActiveTab] = useState("popular");
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMoreTags, setIsFetchingMoreTags] = useState(false);
  const [nextTagOffset, setNextTagOffset] = useState(0);
  const [hasMoreTags, setHasMoreTags] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");

  const fetchTagPage = useCallback(async (from, tabId) => {
    const sortColumn = getSortColumn(tabId);

    return supabase
      .from("hashtag_summaries")
      .select("tag, poll_count, vote_count, like_count")
      .order(sortColumn, { ascending: false })
      .order("tag", { ascending: true })
      .range(from, from + TAG_PAGE_SIZE - 1);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadTags() {
      setIsLoading(true);
      setLoadError("");
      setTags([]);
      setNextTagOffset(0);
      setHasMoreTags(true);
      isFetchingMoreRef.current = false;

      const { data, error } = await fetchTagPage(0, activeTab);
      if (!isActive) return;

      if (error) {
        console.error("Error loading hashtags:", error);
        setLoadError("Tags could not be loaded. Check the backend connection and try again.");
        setHasMoreTags(false);
        setIsLoading(false);
        return;
      }

      const rows = data || [];
      setTags(rows.map(normalizeTagSummary));
      setNextTagOffset(rows.length);
      setHasMoreTags(rows.length === TAG_PAGE_SIZE);
      setIsLoading(false);
    }

    loadTags();

    return () => {
      isActive = false;
    };
  }, [activeTab, fetchTagPage]);

  const loadMoreTags = useCallback(async () => {
    if (isFetchingMoreRef.current || isLoading || !hasMoreTags) return;

    isFetchingMoreRef.current = true;
    setIsFetchingMoreTags(true);

    const { data, error } = await fetchTagPage(nextTagOffset, activeTab);
    if (error) {
      console.error("Error loading more hashtags:", error);
      isFetchingMoreRef.current = false;
      setIsFetchingMoreTags(false);
      return;
    }

    const rows = data || [];
    const nextTags = rows.map(normalizeTagSummary);
    setTags((prev) => {
      const existingTags = new Set(prev.map((item) => item.tag));
      return [
        ...prev,
        ...nextTags.filter((item) => !existingTags.has(item.tag)),
      ];
    });
    setNextTagOffset((value) => value + rows.length);
    setHasMoreTags(rows.length === TAG_PAGE_SIZE);
    isFetchingMoreRef.current = false;
    setIsFetchingMoreTags(false);
  }, [activeTab, fetchTagPage, hasMoreTags, isLoading, nextTagOffset]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || isLoading || !hasMoreTags) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMoreTags();
        }
      },
      { rootMargin: "420px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreTags, isLoading, loadMoreTags]);

  return (
    <div className={pageStyles.appShell}>
      <LeftMenu
        isOpen={isMenuOpen}
        onClose={() => setMenuOpen(false)}
        onRandomPoll={() => {}}
        currentUser={currentUser}
        polls={[]}
        onSelectPoll={() => {}}
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
          polls={[]}
        />

        <div className={pageStyles.contentScroll}>
          <div className={styles.wrap}>
            <section className={styles.hero}>
              <div>
                <p className={styles.eyebrow}>Explore</p>
                <h1 className={styles.title}>Browse all tags</h1>
                <p className={styles.subtext}>
                  {isLoading ? "Loading tags..." : `${formatCount(tags.length)} tag${tags.length === 1 ? "" : "s"} loaded`}
                </p>
              </div>
              <button className={styles.createButton} onClick={() => router.push("/?create=1")} type="button">
                Create Poll
              </button>
            </section>

            <div className={feedStyles.tabRow}>
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  className={`${feedStyles.tab} ${activeTab === tab.id ? feedStyles.tabActive : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadError && <div className={styles.statePanel}>{loadError}</div>}
            {!loadError && isLoading && <div className={styles.statePanel}>Loading tags...</div>}
            {!loadError && !isLoading && tags.length === 0 && (
              <div className={styles.statePanel}>No tags found yet.</div>
            )}

            <section className={styles.grid}>
              {tags.map((item) => (
                <Link
                  key={item.tag}
                  href={`/hashtags/${encodeURIComponent(item.tag)}`}
                  className={styles.tagCard}
                >
                  <span className={styles.hash}>#</span>
                  <div className={styles.tagText}>
                    <h2>{item.tag}</h2>
                    <p>
                      {formatCount(item.polls)} polls | {formatCount(item.votes)} votes | {formatCount(item.likes)} likes
                    </p>
                  </div>
                </Link>
              ))}
              {isFetchingMoreTags && (
                <>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`tag-skeleton-${index}`} className={feedStyles.feedSkeletonCard} aria-hidden="true" />
                  ))}
                </>
              )}
            </section>

            <div ref={loadMoreRef} className={feedStyles.feedSentinel} aria-hidden="true" />
            {!isLoading && !hasMoreTags && tags.length > 0 && (
              <div className={feedStyles.feedEndMessage}>You've reached the end.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
