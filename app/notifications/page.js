"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import LeftMenu from "../components/LeftMenu";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { applyCreatorProfilesToPolls } from "../lib/creatorProfiles";
import { supabase } from "../lib/supabaseClient";
import pageStyles from "../page.module.css";
import styles from "./Notifications.module.css";

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

export default function NotificationsPage() {
  const router = useRouter();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const { currentUser, setCurrentUser, isCurrentUserLoading } = useCurrentUser();
  const [polls, setPolls] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");

  useEffect(() => {
    let isActive = true;

    async function loadPolls() {
      const { data, error } = await supabase
        .from("polls")
        .select("*, poll_options (id, text, image_url, rating, votes)")
        .order("createdate", { ascending: false });

      if (!isActive || error) return;
      setPolls(await applyCreatorProfilesToPolls((data || []).map(normalizePoll)));
    }

    loadPolls();

    return () => {
      isActive = false;
    };
  }, []);

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
          isCurrentUserLoading={isCurrentUserLoading}
          polls={polls}
        />

        <div className={pageStyles.contentScroll}>
          <div className={styles.wrap}>
            <section className={styles.panel}>
              <div className={styles.bell} aria-hidden="true" />
              <p className={styles.eyebrow}>Notifications</p>
              <h1>Coming soon</h1>
              <p>Activity alerts, creator updates, and poll milestones will live here.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
