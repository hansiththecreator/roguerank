"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import LeftMenu from "../../components/LeftMenu";
import PairPoll from "../../components/PairPoll";
import { supabase } from "../../lib/supabaseClient";

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

function makeGuestUser() {
  return {
    id: `guest-${Math.random().toString(36).slice(2, 10)}`,
    username: "Guest",
    likes: [],
  };
}

export default function PollSessionPage() {
  const params = useParams();
  const router = useRouter();
  const pollId = params?.id;
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [polls, setPolls] = useState([]);
  const [poll, setPoll] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");

  const goHome = () => {
    router.push("/");
  };

  const openPoll = (nextPoll) => {
    if (!nextPoll?.id) return;
    setMenuOpen(false);
    router.push(`/polls/${nextPoll.id}`);
  };

  const openRandomPoll = () => {
    if (!polls.length) return;
    const randomIndex = Math.floor(Math.random() * polls.length);
    openPoll(polls[randomIndex]);
  };

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
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        goHome();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadPoll() {
      if (!pollId) return;

      setIsLoading(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("polls")
        .select("*, poll_options (id, text, image_url, rating, votes)")
        .eq("id", pollId)
        .single();

      if (!isActive) return;

      if (error) {
        console.error("Failed loading poll:", error);
        setLoadError("This poll could not be loaded. It may have been removed.");
        setIsLoading(false);
        return;
      }

      setPoll(normalizePoll(data));
      setIsLoading(false);
    }

    loadPoll();

    return () => {
      isActive = false;
    };
  }, [pollId]);

  useEffect(() => {
    let isActive = true;

    async function loadPolls() {
      const { data, error } = await supabase
        .from("polls")
        .select(`*, poll_options (id, text, image_url, rating, votes)`)
        .order("createdate", { ascending: false });

      if (!isActive) return;

      if (error) {
        console.error("Error loading polls:", error);
        return;
      }

      setPolls((data || []).map(normalizePoll));
    }

    loadPolls();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!poll?.id) return;

    const visited = JSON.parse(
      localStorage.getItem("rankr_visited_polls") || "[]"
    );
    if (!visited.includes(poll.id)) {
      visited.unshift(poll.id);
      localStorage.setItem(
        "rankr_visited_polls",
        JSON.stringify(visited.slice(0, 50))
      );
    }
  }, [poll?.id]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#0a0f1a" }}>
      <LeftMenu
        isOpen={isMenuOpen}
        onClose={() => setMenuOpen(false)}
        onRandomPoll={openRandomPoll}
        currentUser={currentUser}
        polls={polls}
        onSelectPoll={openPoll}
      />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header
          onMenuClick={() => setMenuOpen(true)}
          onCreateClick={() => router.push("/?create=1")}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
        />

        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
      <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto" }}>
        {isLoading && (
          <div
            style={{
              maxWidth: 640,
              margin: "48px auto",
              border: "1px solid #243246",
              borderRadius: 8,
              background: "rgba(7, 17, 39, 0.84)",
              color: "#b9c4d8",
              padding: 16,
              textAlign: "center",
            }}
          >
            Loading poll...
          </div>
        )}

        {!isLoading && loadError && (
          <div
            style={{
              maxWidth: 640,
              margin: "48px auto",
              border: "1px solid #243246",
              borderRadius: 8,
              background: "rgba(7, 17, 39, 0.84)",
              color: "#b9c4d8",
              padding: 16,
              textAlign: "center",
            }}
          >
            {loadError}
          </div>
        )}

        {!isLoading && poll && (
          <PairPoll
            poll={poll}
            onBack={goHome}
            onUpdate={(updatedPoll) => {
              setPoll((current) =>
                current?.id === updatedPoll.id ? { ...current, ...updatedPoll } : current
              );
            }}
          />
        )}
      </div>
        </div>
      </main>
    </div>
  );
}
