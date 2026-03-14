"use client";
import { useEffect, useState } from "react";
import styles from "./MultiPoll.module.css";
import PairPoll from "./PairPoll";
import PollCreator from "./PollCreator";
import Header from "./Header";
import { polls as seedPolls } from "../data/polls";
import { supabase } from "../lib/supabaseClient";

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
    const saved = localStorage.getItem("rankr_user");
    if (saved) {
      setCurrentUser(JSON.parse(saved));
    } else {
      const guest = {
        id: `guest-${Math.random().toString(36).slice(2, 10)}`,
        username: "Guest",
        likes: [],
      };
      localStorage.setItem("rankr_user", JSON.stringify(guest));
      setCurrentUser(guest);
    }
  }, []);

  // ---------- LOAD POLLS ----------
  useEffect(() => {
    async function loadPolls() {
      const { data } = await supabase
        .from("polls")
        .select(`*, poll_options(*)`)
        .order("created_at", { ascending: false });

      if (data?.length) {
        setPolls(
          data.map((p) => ({
            id: p.id,
            title: p.title,
            creator: p.creator,
            creatorId: p.creator_id,
            likes: p.likes,
            createdAt: p.created_at,
            options: p.poll_options || [],
          }))
        );
        return;
      }

      // ---------- SEED ONCE ----------
      for (const s of seedPolls) {
        const { error } = await supabase.from("polls").insert({
          id: s.id,
          title: s.title,
          creator: s.creator ?? "Admin",
          creator_id: s.creatorId ?? "admin",
          likes: s.likes ?? 0,
        });
        if (error) console.error(error);

        for (const o of s.options) {
          await supabase.from("poll_options").insert({
            id: o.id,
            poll_id: s.id,
            text: o.text,
            image: o.image ?? null,
            rating: o.rating ?? 1000,
            votes: o.votes ?? 0,
          });
        }
      }

      loadPolls(); // reload after seed
    }

    loadPolls();
  }, []);

  // ---------- LIKE ----------
  const handleLikeToggle = async (pollId) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll || !currentUser) return;

    const liked = currentUser.likes.includes(pollId);
    const newLikes = liked ? poll.likes - 1 : poll.likes + 1;

    await supabase.from("polls").update({ likes: newLikes }).eq("id", pollId);

    setCurrentUser((u) => {
      const updated = {
        ...u,
        likes: liked
          ? u.likes.filter((id) => id !== pollId)
          : [...u.likes, pollId],
      };
      localStorage.setItem("rankr_user", JSON.stringify(updated));
      return updated;
    });

    setPolls((prev) =>
      prev.map((p) =>
        p.id === pollId ? { ...p, likes: newLikes } : p
      )
    );
  };

  // ---------- DELETE ----------
  const handleDelete = async (pollId) => {
    if (!confirm("Delete this poll?")) return;

    await supabase.from("poll_options").delete().eq("poll_id", pollId);
    await supabase.from("polls").delete().eq("id", pollId);

    setPolls((p) => p.filter((x) => x.id !== pollId));
    setMenuOpenFor(null);
    setEditingPoll(null);
  };

  const visiblePolls = polls.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {!selectedPoll && !showCreator && !editingPoll && (
        <section className={styles.cardGrid}>
          {visiblePolls.map((poll) => {
            const canManage = currentUser?.id === poll.creatorId;

            return (
              <div key={poll.id} className={styles.pollCard}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{poll.title}</strong>

                  {canManage && (
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() =>
                          setMenuOpenFor(menuOpenFor === poll.id ? null : poll.id)
                        }
                        style={{ background: "none", border: "none" }}
                      >
                        ⋮
                      </button>

                      {menuOpenFor === poll.id && (
                        <div className={styles.menu}>
                          <button onClick={() => setEditingPoll(poll)}>
                            Edit poll
                          </button>
                          <button
                            style={{ color: "red" }}
                            onClick={() => handleDelete(poll.id)}
                          >
                            Delete poll
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: "#9AA6C2" }}>
                  by <strong>{poll.creator}</strong>
                </div>

                <div className={styles.actions}>
                  <button onClick={() => setSelectedPoll(poll)}>
                    Vote / View
                  </button>
                  <button onClick={() => handleLikeToggle(poll.id)}>
                    ♥ {poll.likes}
                  </button>
                </div>
              </div>
            );
          })}
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
          onCreate={async (poll) => {
            await supabase.from("polls").upsert({
              id: poll.id,
              title: poll.title,
              creator: poll.creator,
              creator_id: poll.creatorId,
              likes: poll.likes,
            });
            setShowCreator(false);
            setEditingPoll(null);
            location.reload();
          }}
        />
      )}

      {selectedPoll && (
        <PairPoll
          poll={selectedPoll}
          onBack={() => setSelectedPoll(null)}
          onUpdate={(u) =>
            setPolls((p) => p.map((x) => (x.id === u.id ? u : x)))
          }
        />
      )}
    </div>
  );
}
