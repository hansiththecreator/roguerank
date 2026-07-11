"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import LeftMenu from "./components/LeftMenu";
import MultiPoll from "./components/MultiPoll";
import PairPoll from "./components/PairPoll";
import PollCreator from "./components/PollCreator";
import { supabase } from "./lib/supabaseClient";
import pageStyles from "./page.module.css";

function makeGuestUser() {
  return {
    id: `guest-${Math.random().toString(36).slice(2, 10)}`,
    username: "Guest",
    likes: [],
  };
}

export default function Home() {
  const router = useRouter();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [polls, setPolls] = useState([]);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");

  // ✅ Load user from localStorage
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") !== "1") return;
    setShowCreator(true);
    setMenuOpen(false);
    router.replace("/");
  }, [router]);

  // ✅ Load polls from Supabase
  useEffect(() => {
    const migrationNeeded = localStorage.getItem("images_migrated");
    if (!migrationNeeded) {
      console.log("Running image migration...");
      // Import and call migration
      import("./lib/migrateImages").then(({ migrateAllImages }) => {
        migrateAllImages().then(() => {
          localStorage.setItem("images_migrated", "true");
          console.log("Migration complete!");
        });
      });
    }
  }, []);

  useEffect(() => {
    async function loadPolls() {
      const { data, error } = await supabase
        .from("polls")
        .select(`*, poll_options (id, text, image_url, rating, votes)`)
        .order("createdate", { ascending: false });

      if (error) {
        console.error("Error loading polls:", error);
        return;
      }

      setPolls((data || []).map((poll) => ({
        id: poll.id,
        title: poll.title,
        creator: poll.creator,
        creatorId: poll.creatorid,
        likes: poll.likes ?? 0,
        total_votes: poll.total_votes ?? 0,
        hashtags: poll.hashtags || [],
        createdAt: poll.createdate,
        thumbnail: poll.thumbnail || null,
        options: (poll.poll_options || [])
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .map((o) => ({
            id: o.id,
            text: o.text,
            image: o.image_url ?? o.image,
            rating: o.rating ?? 1000,
            votes: o.votes ?? 0,
          })),
      })));
    }

    loadPolls();
  }, []);

  // ✅ Track visited polls
  useEffect(() => {
    if (!selectedPoll?.id) return;

    const visited = JSON.parse(
      localStorage.getItem("rankr_visited_polls") || "[]"
    );
    if (!visited.includes(selectedPoll.id)) {
      visited.unshift(selectedPoll.id);
      localStorage.setItem(
        "rankr_visited_polls",
        JSON.stringify(visited.slice(0, 50))
      );
    }
  }, [selectedPoll?.id]);

  const handleRandomPoll = () => {
    if (!polls.length) return;
    const randomIndex = Math.floor(Math.random() * polls.length);
    router.push(`/polls/${polls[randomIndex].id}`);
  };

  const handleCreateClick = () => {
    setShowCreator(true);
    setMenuOpen(false);
  };

  const handleSavePoll = async (poll) => {
    let insertedNewPoll = false;

    try {
      const createdate = poll.createdAt || Date.now();
      const pollRow = {
        title: poll.title,
        creator: poll.creator,
        creatorid: poll.creatorId,
        likes: poll.likes ?? 0,
        hashtags: poll.hashtags ?? [],
        thumbnail: poll.thumbnail || null,
        createdate,
      };

      const isNewPoll = poll.isNew || !polls.some((item) => item.id === poll.id);

      if (isNewPoll) {
        // New poll
        const { error: pollError } = await supabase.from("polls").insert({
          id: poll.id,
          ...pollRow,
          total_votes: 0,
        });
        if (pollError) throw pollError;
        insertedNewPoll = true;
      } else {
        // Edit existing poll
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
      }

      const optionRows = poll.options.map((option) => ({
        id: option.id,
        poll_id: poll.id,
        text: option.text,
        image: null,
        image_url: option.image ?? null,
        migrated: Boolean(option.image),
        rating: option.rating ?? 1000,
        votes: option.votes ?? 0,
      }));

      const { error: optionsError } = await supabase
        .from("poll_options")
        .insert(optionRows);
      if (optionsError) {
        if (insertedNewPoll) {
          await supabase.from("polls").delete().eq("id", poll.id);
        }
        throw optionsError;
      }

      setShowCreator(false);
      setPolls((prev) => [{ ...poll, isNew: undefined }, ...prev.filter((p) => p.id !== poll.id)]);
    } catch (err) {
      console.error("Save poll failed:", err);
      throw err;
    }
  };

  const handleOpenPoll = (poll) => {
    if (!poll?.id) return;
    router.push(`/polls/${poll.id}`);
  };

  return (
    <div className={pageStyles.appShell}>
      {/* ✅ LEFT MENU */}
      <LeftMenu
        isOpen={isMenuOpen}
        onClose={() => setMenuOpen(false)}
        onRandomPoll={handleRandomPoll}
        currentUser={currentUser}
        polls={polls}
        onSelectPoll={handleOpenPoll}
      />

      {/* MAIN CONTENT */}
      <main className={pageStyles.mainShell}>
        {/* HEADER */}
        <Header
          onMenuClick={() => setMenuOpen(true)}
          onCreateClick={handleCreateClick}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          polls={polls}
          setSelectedPoll={setSelectedPoll}
        />

        {/* CONTENT */}
        <div className={pageStyles.contentScroll}>
          {selectedPoll ? (
            <PairPoll
              poll={selectedPoll}
              onBack={() => setSelectedPoll(null)}
              onUpdate={(updatedPoll) => {
                setSelectedPoll(updatedPoll);
                setPolls((prev) =>
                  prev.map((p) =>
                    p.id === updatedPoll.id
                      ? {
                          ...p,
                          options: updatedPoll.options,
                          total_votes: updatedPoll.total_votes,
                        }
                      : p
                  )
                );
              }}
            />
          ) : showCreator ? (
            <PollCreator
              mode="create"
              currentUser={currentUser}
              onCancel={() => setShowCreator(false)}
              onCreate={handleSavePoll}
            />
          ) : (
            <div className={pageStyles.feedWrap}>
              <MultiPoll
                selectedPoll={null}
                setSelectedPoll={handleOpenPoll}
                searchQuery={searchQuery}
                searchFilter={searchFilter}
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                polls={polls}
                setPolls={setPolls}
                showCreator={false}
                setShowCreator={setShowCreator}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
