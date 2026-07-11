"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./styles.module.css";

const PROFILE_IMAGE_MAX_MB = 1;
const MB = 1024 * 1024;
const USERNAME_MAX = 32;
const BIO_MAX = 150;

function formatFileSize(bytes) {
  if (!bytes) return "";
  return `${(bytes / MB).toFixed(1)}MB selected`;
}

function formatJoinedDate(timestamp) {
  const joined = Number(timestamp) || Date.now();
  const diffMs = Date.now() - joined;
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(0, Math.floor(diffMs / dayMs));

  if (days === 0) return "Joined today";
  if (days === 1) return "Joined 1 day ago";
  if (days < 30) return `Joined ${days} days ago`;

  const months = Math.floor(days / 30);
  if (months === 1) return "Joined 1 month ago";
  if (months < 12) return `Joined ${months} months ago`;

  const years = Math.floor(days / 365);
  return years === 1 ? "Joined 1 year ago" : `Joined ${years} years ago`;
}

function readJsonArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function Header({
  onMenuClick,
  onCreateClick,
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  currentUser,
  setCurrentUser,
}) {
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const [username, setUsername] = useState(currentUser?.username || "");
  const [pfp, setPfp] = useState(currentUser?.pfp || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [joinDate, setJoinDate] = useState(currentUser?.joinedAt || Date.now());
  const [selectedFileSize, setSelectedFileSize] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [profileStats, setProfileStats] = useState({
    created: 0,
    votesCast: 0,
    likesGiven: 0,
  });

  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username || "");
      setPfp(currentUser.pfp || "");
      setBio(currentUser.bio || "");
      setJoinDate(currentUser.joinedAt || Date.now());
    }
  }, [currentUser]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("account") !== "1") return;

    setModalOpen(true);
    params.delete("account");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;

    const createdPolls = readJsonArray("rankr_created_polls");
    const visitedPolls = readJsonArray("rankr_visited_polls");
    setProfileStats({
      created: createdPolls.length,
      votesCast: visitedPolls.length,
      likesGiven: currentUser?.likes?.length || 0,
    });
  }, [isModalOpen, currentUser]);

  const buildUpdatedUser = (overrides = {}) => ({
    ...(currentUser || {}),
    username: username.trim().slice(0, USERNAME_MAX) || "Guest",
    pfp,
    joinedAt: currentUser?.joinedAt || joinDate || Date.now(),
    bio: bio.trim().slice(0, BIO_MAX),
    ...overrides,
  });

  const handleSave = () => {
    const updatedUser = buildUpdatedUser();
    setCurrentUser(updatedUser);
    localStorage.setItem("rankr_user", JSON.stringify(updatedUser));
    setSavePulse(true);
    setTimeout(() => {
      setSavePulse(false);
      setModalOpen(false);
    }, 500);
  };

  const handleBioBlur = () => {
    const updatedUser = buildUpdatedUser({ bio: bio.trim().slice(0, BIO_MAX) });
    setCurrentUser(updatedUser);
    localStorage.setItem("rankr_user", JSON.stringify(updatedUser));
  };

  const handleCopyUserId = async () => {
    const userId = currentUser?.id || "";
    if (!userId) return;

    try {
      await navigator.clipboard.writeText(userId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1200);
    } catch {
      alert("Could not copy User ID.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > PROFILE_IMAGE_MAX_MB * MB) {
      alert(`Image must be under ${PROFILE_IMAGE_MAX_MB}MB`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPfp(event.target.result);
      setSelectedFileSize(formatFileSize(file.size));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <>
      <header className={`${styles.headerWrapper} ${isSearchOpen ? styles.searchOpen : ""}`}>
        <div className={styles.headerLeft}>
          <button
            aria-label="Open menu"
            onClick={onMenuClick}
            className={styles.barsBtn}
            type="button"
          >
            Menu
          </button>

          <Link href="/" className={styles.brandLink}>
            <img src="/RogueRank.jpeg" alt="Rogue Rank" className={styles.logo} />
            <div>
              <h1 className={styles.siteTitle}>Rogue Rank</h1>
              <p className={styles.siteTagline}>Vote and rank</p>
            </div>
          </Link>
        </div>

        <div className={styles.headerRight}>
          <button
            aria-label={isSearchOpen ? "Close search" : "Open search"}
            className={styles.searchToggleBtn}
            onClick={() => setSearchOpen((value) => !value)}
            type="button"
          >
            &#128269;
          </button>

          <div className={styles.searchWrap}>
            <select
              className={styles.searchFilter}
              value={searchFilter || "all"}
              onChange={(e) => setSearchFilter?.(e.target.value)}
            >
              <option value="all">All</option>
              <option value="polls">Polls</option>
              <option value="options">Options</option>
              <option value="creators">Creators</option>
              <option value="hashtags">Hashtags</option>
            </select>
            <input
              ref={searchInputRef}
              placeholder="Search polls, tags, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <button onClick={onCreateClick} className={styles.createBtn} type="button">
            + Create
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

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHero}>
              <label className={styles.profilePhotoUpload}>
                {pfp ? (
                  <img src={pfp} alt="Preview" className={styles.imagePreview} />
                ) : (
                  <span className={styles.profileInitial}>{username ? username[0].toUpperCase() : "G"}</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </label>
              <h2 className={styles.modalTitle}>Account Settings</h2>
              <p className={styles.joinDate}>{formatJoinedDate(joinDate)}</p>
              {selectedFileSize && <p className={styles.fileSizeText}>{selectedFileSize}</p>}
            </div>
            <section className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>👤 Profile</h3>

              <label className={styles.modalLabel}>User ID</label>
              <div className={styles.copyRow}>
                <input
                  type="text"
                  className={styles.modalInput}
                  value={currentUser?.id || ""}
                  readOnly
                />
                <button className={styles.copyBtn} type="button" onClick={handleCopyUserId}>
                  {copiedId ? "Copied" : "Copy"}
                </button>
              </div>

              <div className={styles.labelRow}>
                <label className={styles.modalLabel}>Username</label>
                <span className={styles.charCount}>{username.length}/{USERNAME_MAX}</span>
              </div>
              <input
                type="text"
                className={styles.modalInput}
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, USERNAME_MAX))}
                placeholder="Guest"
                maxLength={USERNAME_MAX}
              />

              <div className={styles.labelRow}>
                <label className={styles.modalLabel}>Bio</label>
                <span className={styles.charCount}>{bio.length}/{BIO_MAX}</span>
              </div>
              <textarea
                className={`${styles.modalInput} ${styles.bioInput}`}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                onBlur={handleBioBlur}
                placeholder="Tell voters a little about you..."
                maxLength={BIO_MAX}
                rows={4}
              />
            </section>

            <section className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Stats</h3>
              <div className={styles.profileStatsRow}>
                <div><strong>{profileStats.created}</strong><span>polls created</span></div>
                <div><strong>{profileStats.votesCast}</strong><span>votes cast</span></div>
                <div><strong>{profileStats.likesGiven}</strong><span>likes given</span></div>
              </div>
            </section>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className={`${styles.saveBtn} ${savePulse ? styles.savePulse : ""}`} onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



