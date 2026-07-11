"use client";
import { useState, useEffect } from "react";
import styles from "./ProfilePage.module.css";
import { supabase } from "../lib/supabaseClient";

export default function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);
  const [userPolls, setUserPolls] = useState([]);

  useEffect(() => {
    async function loadData() {
      if (!userId) return;

      // ---------- FETCH POLLS FROM SUPABASE ----------
      const { data, error } = await supabase
        .from("polls")
        .select(`*, poll_options(id, text, image_url, rating, votes)`);

      if (error) {
        console.error(error);
        return;
      }

      // ---------- FILTER USER POLLS ----------
      const targetPolls = (data || []).filter(
        (p) => String(p.creatorid) === String(userId)
      );

      setUserPolls(targetPolls);

      // ---------- SET USER ----------
      if (targetPolls.length > 0) {
        setUser({
          id: userId,
          username: targetPolls[0].creator || "Anonymous",
          pfp: "/default-avatar.png",
        });
      } else {
        setUser({
          id: userId,
          username: "Anonymous",
          pfp: "/default-avatar.png",
        });
      }
    }

    loadData();
  }, [userId]);

  if (!user) return <p style={{ textAlign: "center" }}>Loading user...</p>;

  return (
    <div className={styles.profileWrapper}>
      <div className={styles.profileHeader}>
        <img
          src={user.pfp}
          alt="pfp"
          className={styles.profilePic}
        />
        <h1 className={styles.username}>{user.username}</h1>
        <p className={styles.userId}>@{user.id}</p>
      </div>

      <h2 className={styles.sectionTitle}>
        Polls by {user.username}
      </h2>

      <div className={styles.pollList}>
        {userPolls.length > 0 ? (
          userPolls.map((p) => (
            <div key={p.id} className={styles.pollCard}>
              <strong>{p.title}</strong>

              <p style={{ fontSize: 13, color: "#9AA6C2" }}>
                {p.poll_options?.length || 0} options —{" "}
                {p.poll_options?.reduce(
                  (sum, o) => sum + (o.votes || 0),
                  0
                )}{" "}
                votes
              </p>
            </div>
          ))
        ) : (
          <p>No polls created yet.</p>
        )}
      </div>
    </div>
  );
}
