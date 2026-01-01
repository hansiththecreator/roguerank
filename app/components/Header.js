"use client";
import { useState, useEffect } from "react";
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

  // Keep username/pfp synced
  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username || "");
      setPfp(currentUser.pfp || "");
    }
  }, [currentUser]);

  // ✅ FIXED: Random poll (deep clone to avoid reference bugs)
  const handleRandomPoll = () => {
    if (!polls?.length) return;

    const randomIndex = Math.floor(Math.random() * polls.length);

    // 🔥 THIS LINE IS THE FIX
    const clonedPoll = structuredClone(polls[randomIndex]);

    setSelectedPoll(clonedPoll);
    setMenuOpen(false);
  };

  // Save user changes
  const handleSave = () => {
    const updatedUser = { ...currentUser, username, pfp };
    setCurrentUser(updatedUser);
    localStorage.setItem("rankr_user", JSON.stringify(updatedUser));
    setModalOpen(false);
  };

  // Upload profile image
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setPfp(event.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <>
      <header className={styles.headerWrapper}>
        <div className={styles.headerLeft}>
          <button
            aria-label="menu"
            onClick={() => setMenuOpen(true)}
            className={styles.barsBtn}
          >
            ☰
          </button>

          <img
  src="/RogueRank.jpeg"
  alt="Rogue Rank"
  className={styles.logo}
/>

          <p>Vote & Rank</p>
        </div>

        <div className={styles.headerRight}>
          <input
            placeholder="Search polls, tags, elements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <button onClick={onCreateClick} className="voteButton">
            ＋ Create
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className={styles.profileBtn}
            title="Profile"
          >
            {pfp ? (
              <img src={pfp} alt="pfp" className={styles.profileCircleImg} />
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
            <div
              className={styles.imageUpload}
              onClick={() => document.getElementById("pfpInput").click()}
            >
              {pfp ? (
                <img src={pfp} alt="Preview" className={styles.imagePreview} />
              ) : (
                "Click to upload"
              )}
              <input
                id="pfpInput"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>

            <label className={styles.modalLabel}>Username</label>
            <input
              type="text"
              className={styles.modalInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username..."
            />

            <div className={styles.modalActions}>
              <button onClick={handleSave} className={styles.saveBtn}>
                Save
              </button>
              <button
                onClick={() => setModalOpen(false)}
                className={styles.cancelBtn}
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
