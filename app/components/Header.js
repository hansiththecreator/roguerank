"use client";

import { useEffect, useState } from "react";
import styles from "./styles.module.css";
import LeftMenu from "./LeftMenu";

export default function Header({
  onCreateClick,
  searchQuery,
  setSearchQuery,
  currentUser,
  setCurrentUser,
  polls,
  setSelectedPoll,
}) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState(currentUser?.username || "");
  const [pfp, setPfp] = useState(currentUser?.pfp || "");

  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username || "");
      setPfp(currentUser.pfp || "");
    }
  }, [currentUser]);

  const handleRandomPoll = () => {
    if (!polls?.length) return;

    const randomIndex = Math.floor(Math.random() * polls.length);
    const poll = structuredClone(polls[randomIndex]);

    setSelectedPoll(poll);
    setMenuOpen(false);
  };

  const handleSave = () => {
    const updatedUser = {
      ...(currentUser || {}),
      username: username.trim() || "Guest",
      pfp,
    };

    setCurrentUser(updatedUser);
    localStorage.setItem("rankr_user", JSON.stringify(updatedUser));
    setModalOpen(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Please use an image under 2MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => setPfp(event.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <>
      <header className={styles.headerWrapper}>
        <div className={styles.headerLeft}>
          <button
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className={styles.barsBtn}
            type="button"
          >
            Menu
          </button>

          <img src="/RogueRank.jpeg" alt="Rogue Rank" className={styles.logo} />

          <div>
            <h1 className={styles.siteTitle}>Rogue Rank</h1>
            <p className={styles.siteTagline}>Vote and rank</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <input
            placeholder="Search polls, tags, creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <button onClick={onCreateClick} className="voteButton" type="button">
            Create
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className={styles.profileBtn}
            title="Profile"
            type="button"
          >
            {pfp ? (
              <img src={pfp} alt="Profile" className={styles.profileCircleImg} />
            ) : (
              <div className={styles.profileCircle}>
                {username ? username[0].toUpperCase() : "G"}
              </div>
            )}
          </button>
        </div>
      </header>

      <LeftMenu
        isOpen={isMenuOpen}
        onClose={() => setMenuOpen(false)}
        onRandomPoll={handleRandomPoll}
      />

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h2 className={styles.modalTitle}>Account Settings</h2>

            <label className={styles.modalLabel}>User ID</label>
            <input
              type="text"
              className={styles.modalInput}
              value={currentUser?.id || ""}
              readOnly
            />

            <label className={styles.modalLabel}>Profile Picture</label>
            <label className={styles.imageUpload}>
              {pfp ? (
                <img src={pfp} alt="Preview" className={styles.imagePreview} />
              ) : (
                "Click to upload"
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </label>

            <label className={styles.modalLabel}>Username</label>
            <input
              type="text"
              className={styles.modalInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username..."
              maxLength={32}
            />

            <div className={styles.modalActions}>
              <button onClick={handleSave} className={styles.saveBtn} type="button">
                Save
              </button>
              <button
                onClick={() => setModalOpen(false)}
                className={styles.cancelBtn}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
