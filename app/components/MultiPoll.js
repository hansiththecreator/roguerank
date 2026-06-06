"use client";

import { useEffect, useState } from "react";
import styles from "./MultiPoll.module.css";
import PairPoll from "./PairPoll";
import PollCreator from "./PollCreator";
import { supabase } from "../lib/supabaseClient";

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
      image: o.image,
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
    options,
  };
}

export default function MultiPoll({
  selectedPoll,
  setSelectedPoll,
  searchQuery,
  currentUser,
  setCurrentUser,
  polls,
  setPolls,
  showCreator,
  setShowCreator,
}) {
  const [editingPoll, setEditingPoll] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingPollId, setDeletingPollId] = useState(null);
  const [activeTab, setActiveTab] = useState("latest");

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
        .select(
          `
          *,
          poll_options (
            id,
            text,
            image,
            rating,
            votes
          )
        `
        )
        .order("createdate", { ascending: false });

      if (error) {
        console.error("Error loading polls:", error);
        setLoadError(
          "Polls could not be loaded. Check the backend connection and try again."
        );
        setIsLoadingPolls(false);
        return;
      }

      setPolls((data || []).map(normalizePoll));
      setIsLoadingPolls(false);
    }

    loadPolls();
  }, [setPolls]);

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
    setPolls((prev) =>
      prev.map((p) => (p.id === pollId ? { ...p, likes: nextLikes } : p))
    );

    const { error } = await supabase
      .from("polls")
      .update({ likes: nextLikes })
      .eq("id", pollId);

    if (error) {
      console.error("Like update failed:", error);
      setCurrentUser(currentUser);
      localStorage.setItem("rankr_user", JSON.stringify(currentUser));
      setPolls((prev) =>
        prev.map((p) => (p.id === pollId ? { ...p, likes: poll.likes } : p))
      );
    }
  };

  const handleDelete = async (pollId) => {
    if (!confirm("Delete this poll?")) return;
    setDeletingPollId(pollId);

    const { error: optionsError } = await supabase
      .from("poll_options")
      .delete()
      .eq("poll_id", pollId);

    if (optionsError) {
      console.error("Poll option delete failed:", optionsError);
      alert("Could not delete poll options.");
      setDeletingPollId(null);
      return;
    }

    const { error: pollError } = await supabase
      .from("polls")
      .delete()
      .eq("id", pollId);

    if (pollError) {
      console.error("Poll delete failed:", pollError);
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
    const alreadyReported = reports.some(
      (report) => report.pollId === poll.id && report.userId === currentUser?.id
    );

    if (alreadyReported) {
      alert("You already reported this poll. Thanks for helping keep voting fair.");
      setMenuOpenFor(null);
      return;
    }

    const nextReports = [
      ...reports,
      {
        pollId: poll.id,
        title: poll.title,
        userId: currentUser?.id || "guest",
        createdAt: Date.now(),
      },
    ];

    localStorage.setItem("rankr_reports", JSON.stringify(nextReports));
    alert("Poll reported. Thanks for helping keep Rogue Rank fair.");
    setMenuOpenFor(null);
  };

  const handleSavePoll = async (poll) => {
    const pollRow = {
      title: poll.title,
      creator: poll.creator,
      creatorid: poll.creatorId,
      likes: poll.likes ?? 0,
      hashtags: poll.hashtags ?? [],
    };

    if (editingPoll) {
      const { error: pollError } = await supabase
        .from("polls")
        .update(pollRow)
        .eq("id", poll.id);
      if (pollError) throw pollError;

      const { error: deleteError } = await supabase
        .from("poll_options")
        .delete()
        .eq("poll_id", poll.id);
      if (deleteError) throw deleteError;
    } else {
      const { error: pollError } = await supabase.from("polls").insert({
        id: poll.id,
        ...pollRow,
        createdate: Date.now(),
        total_votes: 0,
      });
      if (pollError) throw pollError;
    }

    const optionRows = poll.options.map((option) => ({
      id: option.id,
      poll_id: poll.id,
      text: option.text,
      image: option.image ?? null,
      rating: option.rating ?? 1000,
      votes: option.votes ?? 0,
    }));

    const { error: optionsError } = await supabase
      .from("poll_options")
      .insert(optionRows);
    if (optionsError) throw optionsError;

    const normalized = normalizePoll({
      ...poll,
      creatorid: poll.creatorId,
      total_votes: poll.total_votes ?? 0,
    });

    setShowCreator(false);
    setEditingPoll(null);
    setPolls((prev) =>
      editingPoll
        ? prev.map((item) => (item.id === poll.id ? normalized : item))
        : [normalized, ...prev]
    );
  };

  const query = searchQuery?.trim().toLowerCase() || "";
  const visiblePolls = polls.filter((poll) => {
    if (!query) return true;

    return [poll.title, poll.creator, ...(poll.hashtags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  // Calculate hero stats
  const totalPolls = visiblePolls.length;
  const totalVotes = visiblePolls.reduce((sum, p) => sum + (p.total_votes ?? 0), 0);
  const totalOptions = visiblePolls.reduce((sum, p) => sum + p.options.length, 0);

  // Sort by active tab
  const sortedPolls = [...visiblePolls].sort((a, b) => {
    if (activeTab === "popular") {
      return (b.total_votes ?? 0) - (a.total_votes ?? 0);
    } else if (activeTab === "liked") {
      return (b.likes ?? 0) - (a.likes ?? 0);
    }
    // latest (default)
    return 0;
  });

  // Featured poll is the first one (highest votes)
  const featuredPoll = [...visiblePolls].sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))[0];

  return (
    <div className={styles.pollContainer}>
      {!selectedPoll && !showCreator && !editingPoll && (
        <>
          <div className={styles.feedHeader}>
            <div>
              <h2 className={styles.sectionHeading}>Trending Polls</h2>
              <p className={styles.feedSubtext}>
                Choose between options and watch the ranking update.
              </p>
            </div>
            <button
              className={styles.primaryAction}
              onClick={() => setShowCreator(true)}
            >
              Create poll
            </button>
          </div>

          {/* Hero Stats Section */}
          {!isLoadingPolls && !loadError && visiblePolls.length > 0 && (
            <div className={styles.heroSection}>
              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNumber}>{totalPolls}</span>
                  <span className={styles.heroStatLabel}>Polls</span>
                </div>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNumber}>{totalVotes}</span>
                  <span className={styles.heroStatLabel}>Total Votes</span>
                </div>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNumber}>{totalOptions}</span>
                  <span className={styles.heroStatLabel}>Options</span>
                </div>
              </div>
            </div>
          )}

          {isLoadingPolls && (
            <div className={styles.statePanel}>Loading polls...</div>
          )}
          {loadError && <div className={styles.statePanel}>{loadError}</div>}
          {!isLoadingPolls && !loadError && visiblePolls.length === 0 && (
            <div className={styles.statePanel}>
              No polls found. Start one from the create button.
            </div>
          )}

          {/* Featured/Trending Banner */}
          {!isLoadingPolls && !loadError && featuredPoll && (
            <div className={styles.featuredBanner}>
              <div className={styles.featuredLabel}>🔥 Trending Now</div>
              {featuredPoll.options[0]?.image && (
                <img
                  src={featuredPoll.options[0].image}
                  alt={featuredPoll.title}
                  className={styles.featuredImage}
                />
              )}
              <div className={styles.featuredContent}>
                <h3 className={styles.featuredTitle}>{featuredPoll.title}</h3>
                <div className={styles.featuredCreator}>by {featuredPoll.creator}</div>
                {featuredPoll.hashtags?.length > 0 && (
                  <div className={styles.featuredTags}>
                    {featuredPoll.hashtags.slice(0, 3).map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                )}
                <div className={styles.featuredVotes}>
                  <strong>{featuredPoll.total_votes ?? 0}</strong> votes • <strong>{featuredPoll.likes ?? 0}</strong> likes
                </div>
                <button
                  className={styles.featuredButton}
                  onClick={() => setSelectedPoll(featuredPoll)}
                >
                  Vote Now
                </button>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          {!isLoadingPolls && !loadError && visiblePolls.length > 0 && (
            <div className={styles.tabNav}>
              <button
                className={`${styles.tabButton} ${activeTab === "latest" ? styles.active : ""}`}
                onClick={() => setActiveTab("latest")}
              >
                Latest
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === "popular" ? styles.active : ""}`}
                onClick={() => setActiveTab("popular")}
              >
                Popular
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === "liked" ? styles.active : ""}`}
                onClick={() => setActiveTab("liked")}
              >
                Most Liked
              </button>
            </div>
          )}

          <section className={styles.cardGrid}>
            {sortedPolls.map((poll) => {
              const liked = currentUser?.likes?.includes(poll.id);
              const canManage =
                currentUser?.id === poll.creatorId ||
                (!poll.creatorId && currentUser?.username === poll.creator);
              const isDeleting = deletingPollId === poll.id;
              const voteCount =
                poll.total_votes ??
                poll.options.reduce((sum, option) => sum + (option.votes || 0), 0);
              
              // Get display hashtags (max 3)
              const displayTags = poll.hashtags?.slice(0, 3) || [];
              const hiddenTagsCount = (poll.hashtags?.length || 0) - displayTags.length;

              return (
                <article key={poll.id} className={styles.pollCard}>
                  {poll.options[0]?.image && (
                    <img
                      src={poll.options[0].image}
                      alt={poll.title}
                      className={styles.cardImage}
                    />
                  )}

                  <div className={styles.cardContent}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardTitleGroup}>
                        <strong className={styles.cardTitle}>{poll.title}</strong>
                        <span className={styles.cardCreator}>by {poll.creator}</span>
                      </div>

                      <div className={styles.menuWrap}>
                        <button
                          onClick={() =>
                            setMenuOpenFor(menuOpenFor === poll.id ? null : poll.id)
                          }
                          className={styles.iconButton}
                          aria-label="Poll actions"
                        >
                          ⋮
                        </button>

                        {menuOpenFor === poll.id && (
                          <div className={styles.menu}>
                            <button onClick={() => handleReport(poll)}>
                              <span aria-hidden="true">{"\u26A0"}</span> Report
                            </button>

                            {canManage && (
                              <button
                                className={styles.dangerItem}
                                disabled={isDeleting}
                                onClick={() => handleDelete(poll.id)}
                              >
                                <span aria-hidden="true">{"\u{1F5D1}"}</span>{" "}
                                {isDeleting ? "Deleting..." : "Delete poll"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {displayTags.length > 0 && (
                      <div className={styles.tagRow}>
                        {displayTags.map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                        {hiddenTagsCount > 0 && <span>+{hiddenTagsCount} more</span>}
                      </div>
                    )}

                    <div className={styles.cardStats}>
                      <span>{poll.options.length} options</span>
                      <span>{voteCount} votes</span>
                      <span>{poll.likes} likes</span>
                    </div>

                    <div className={styles.cardBottom}>
                      <button
                        className={styles.cardButton}
                        onClick={() => setSelectedPoll(poll)}
                      >
                        Vote / View
                      </button>

                      <button
                        className={styles.cardButtonAlt}
                        onClick={() => handleLikeToggle(poll.id)}
                      >
                        {liked ? "Liked" : "Like"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}

      {(showCreator || editingPoll) && (
        <PollCreator
          mode={editingPoll ? "edit" : "create"}
          poll={editingPoll}
          currentUser={currentUser}
          onCancel={() => {
            setShowCreator(false);
            setEditingPoll(null);
          }}
          onCreate={handleSavePoll}
        />
      )}

      {selectedPoll && (
        <PairPoll
          poll={selectedPoll}
          onBack={() => setSelectedPoll(null)}
          onUpdate={(updatedPoll) => {
            setSelectedPoll((current) =>
              current?.id === updatedPoll.id
                ? { ...current, ...updatedPoll }
                : current
            );
            setPolls((prev) =>
              prev.map((poll) =>
                poll.id === updatedPoll.id
                  ? {
                      ...poll,
                      options: updatedPoll.options,
                      total_votes: updatedPoll.total_votes,
                    }
                  : poll
              )
            );
          }}
        />
      )}
    </div>
  );
}
