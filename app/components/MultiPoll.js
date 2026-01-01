"use client";
import { useEffect, useState } from "react";
import styles from "./MultiPoll.module.css";
import PairPoll from "./PairPoll";
import PollCreator from "./PollCreator";
import Header from "./Header";
import { polls as seedPolls } from "../data/polls";

function loadPollsFromStorage() {
  try {
    const raw = localStorage.getItem("rankr_polls");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function MultiPoll() {
  const [polls, setPolls] = useState([]);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [editingPoll, setEditingPoll] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // ---------- USER INIT ----------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("rankr_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      setCurrentUser({
        ...parsed,
        likes: parsed.likes || [],
        saved: parsed.saved || [],
      });
    } else {
      const guest = {
        id: `guest-${Math.random().toString(36).slice(2, 10)}`,
        username: "Guest",
        likes: [],
        saved: [],
      };
      localStorage.setItem("rankr_user", JSON.stringify(guest));
      setCurrentUser(guest);
    }
  }, []);

  // ---------- LOAD + MIGRATE POLLS ----------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = loadPollsFromStorage();
    let loadedPolls = [];

    if (stored?.length) {
      // 🔥 LEGACY MIGRATION
      loadedPolls = stored.map((p) => {
        if (!p.creatorId) {
          return {
            ...p,
            creator: p.creator || "Legacy",
            creatorId: "legacy",
          };
        }
        return p;
      });

      localStorage.setItem("rankr_polls", JSON.stringify(loadedPolls));
      setPolls(loadedPolls);
    } else {
      const now = Date.now();
      const normalizedSeed = (seedPolls || []).map((s, idx) => ({
        ...s,
        id: s.id || `seed-${now}-${idx}`,
        options: (s.options || []).map((o, i) => ({
          id: o.id || `opt-${now}-${idx}-${i}`,
          text: o.text || "",
          image: o.image ?? null,
          rating: o.rating ?? 1000,
          votes: o.votes ?? 0,
        })),
        creator: s.creator ?? "Admin",
        creatorId: s.creatorId ?? "admin",
        likes: s.likes ?? 0,
        createdAt: s.createdAt ?? now,
      }));

      setPolls(normalizedSeed);
      localStorage.setItem("rankr_polls", JSON.stringify(normalizedSeed));
    }
  }, []);

  // ---------- LIKE ----------
  const handleLikeToggle = (pollId) => {
    if (!currentUser) return;

    const alreadyLiked = currentUser.likes.includes(pollId);

    const updatedUser = {
      ...currentUser,
      likes: alreadyLiked
        ? currentUser.likes.filter((id) => id !== pollId)
        : [...currentUser.likes, pollId],
    };

    setCurrentUser(updatedUser);
    localStorage.setItem("rankr_user", JSON.stringify(updatedUser));

    setPolls((prev) =>
      prev.map((p) =>
        p.id === pollId
          ? {
              ...p,
              liked: !alreadyLiked,
              likes: alreadyLiked
                ? Math.max((p.likes || 1) - 1, 0)
                : (p.likes || 0) + 1,
            }
          : p
      )
    );
  };

  // ---------- DELETE ----------
  const handleDelete = (pollId) => {
    if (!confirm("Delete this poll?")) return;

    const updated = polls.filter((p) => p.id !== pollId);
    setPolls(updated);
    localStorage.setItem("rankr_polls", JSON.stringify(updated));

    setMenuOpenFor(null);
    if (editingPoll?.id === pollId) setEditingPoll(null);
  };

  // ---------- FILTER ----------
  const visiblePolls = polls.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.options?.some((o) => o.text.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <Header
        onCreateClick={() => setShowCreator(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        polls={polls}
        setSelectedPoll={setSelectedPoll}
      />

      <p style={{ textAlign: "center", marginTop: 6, color: "#9AA6C2" }}>
        Rogue Rank is social ranking — swipe pairwise, let the people decide.
      </p>

      {!selectedPoll && !showCreator && !editingPoll && (
        <section style={{ marginTop: 20 }}>
          <h2 className={styles.sectionHeading}>Trending polls</h2>
          <div className={styles.cardGrid}>
            {visiblePolls.map((poll) => {
              const totalVotes = poll.options.reduce(
                (a, b) => a + (b.votes || 0),
                0
              );

              const canManage =
                currentUser?.id === poll.creatorId ||
                poll.creatorId === "legacy";

              return (
                <div className={styles.pollCard} key={poll.id}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{poll.title}</strong>

                    {canManage && (
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() =>
                            setMenuOpenFor(
                              menuOpenFor === poll.id ? null : poll.id
                            )
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#9AA6C2",
                            cursor: "pointer",
                            fontSize: 18,
                          }}
                        >
                          ⋮
                        </button>

                        {menuOpenFor === poll.id && (
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              top: 22,
                              background: "#0f172a",
                              border: "1px solid #1f2b3b",
                              borderRadius: 8,
                              zIndex: 10,
                              minWidth: 120,
                            }}
                          >
                            <button
                              onClick={() => {
                                setEditingPoll(poll);
                                setMenuOpenFor(null);
                              }}
                              style={menuBtn}
                            >
                              Edit poll
                            </button>
                            <button
                              onClick={() => handleDelete(poll.id)}
                              style={{ ...menuBtn, color: "#ef4444" }}
                            >
                              Delete poll
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: "#9AA6C2", marginTop: 2 }}>
                    by{" "}
                    <strong style={{ color: "#e6eef8" }}>
                      {poll.creator}
                    </strong>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
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
                      <span style={{ color: poll.liked ? "red" : "#9AA6C2" }}>
                        {poll.liked ? "♥︎" : "♡"}
                      </span>{" "}
                      {poll.likes || 0}
                    </button>

                    <div style={{ marginLeft: "auto", color: "#9AA6C2" }}>
                      {totalVotes} votes
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
          onCreate={(poll) => {
            setPolls((prev) =>
              editingPoll
                ? prev.map((p) => (p.id === poll.id ? poll : p))
                : [poll, ...prev]
            );
            setShowCreator(false);
            setEditingPoll(null);
          }}
        />
      )}

      {selectedPoll && (
        <PairPoll
          poll={selectedPoll}
          onBack={() => setSelectedPoll(null)}
          onUpdate={(u) =>
            setPolls((prev) => prev.map((p) => (p.id === u.id ? u : p)))
          }
        />
      )}
    </div>
  );
}

const menuBtn = {
  width: "100%",
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
  color: "#e6eef8",
};
