"use client";

import { useEffect, useState } from "react";
import styles from "./ProfilePage.module.css";
import { supabase } from "../lib/supabaseClient";
import { getUserProfile } from "../lib/pollEngagement";

export default function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);
  const [userPolls, setUserPolls] = useState([]);

  useEffect(() => {
    async function loadData() {
      if (!userId) return;

      const [{ data, error }, profileResult] = await Promise.all([
        supabase
          .from("polls")
          .select("*, poll_options(id, text, image_url, rating, votes)"),
        getUserProfile(userId),
      ]);

      if (error) {
        console.error("Profile polls load failed:", error);
        return;
      }

      const targetPolls = (data || []).filter(
        (poll) => String(poll.creatorid) === String(userId)
      );

      setUserPolls(targetPolls);

      const profile = profileResult.data || {};
      setUser({
        id: userId,
        name: profile.name || "",
        username: profile.username || targetPolls[0]?.creator || "anonymous",
        pfp: profile.profile_pic || "/default-avatar.png",
      });
    }

    loadData();
  }, [userId]);

  if (!user) return <p className={styles.loadingState}>Loading user...</p>;

  return (
    <div className={styles.profileWrapper}>
      <div className={styles.profileHeader}>
        <div className={styles.profilePicFrame}>
          <img src={user.pfp} alt="" className={styles.profilePic} />
        </div>

        {user.name && user.name.toLowerCase() !== user.username.toLowerCase() && (
          <p className={styles.userId}>{user.name}</p>
        )}
        <h1 className={styles.username}>@{user.username}</h1>
      </div>

      <h2 className={styles.sectionTitle}>Polls by @{user.username}</h2>

      <div className={styles.pollList}>
        {userPolls.length > 0 ? (
          userPolls.map((poll) => (
            <div key={poll.id} className={styles.pollCard}>
              <strong>{poll.title}</strong>

              <p className={styles.pollMeta}>
                {poll.poll_options?.length || 0} options ·{" "}
                {poll.poll_options?.reduce(
                  (sum, option) => sum + (option.votes || 0),
                  0
                )}{" "}
                votes
              </p>
            </div>
          ))
        ) : (
          <p className={styles.emptyState}>No polls created yet.</p>
        )}
      </div>
    </div>
  );
}
