"use client";
import { useState, useEffect } from "react";
import styles from "./ProfilePage.module.css";

export default function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);
  const [userPolls, setUserPolls] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const allPolls = JSON.parse(localStorage.getItem("rankr_polls") || "[]");
    const targetPolls = allPolls.filter(p => p.creator?.id === userId);
    setUserPolls(targetPolls);

    // Try to find the user from localStorage or from polls
    const savedUser = JSON.parse(localStorage.getItem("rankr_user"));
    if (savedUser?.id === userId) setUser(savedUser);
    else if (targetPolls[0]) setUser(targetPolls[0].creator);
  }, [userId]);

  if (!user) return <p style={{ textAlign: "center" }}>Loading user...</p>;

  return (
    <div className={styles.profileWrapper}>
      <div className={styles.profileHeader}>
        <img
          src={user.pfp || "/default-avatar.png"}
          alt="pfp"
          className={styles.profilePic}
        />
        <h1 className={styles.username}>{user.username}</h1>
        <p className={styles.userId}>@{user.id}</p>
      </div>

      <h2 className={styles.sectionTitle}>Polls by {user.username}</h2>
      <div className={styles.pollList}>
        {userPolls.length > 0 ? (
          userPolls.map((p) => (
            <div key={p.id} className={styles.pollCard}>
              <strong>{p.title}</strong>
              <p style={{ fontSize: 13, color: "#9AA6C2" }}>
                {p.options.length} options — {p.totalVotes || 0} votes
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
