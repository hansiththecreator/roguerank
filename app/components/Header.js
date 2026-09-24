"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./styles.module.css";
import ThemedModal from "./ThemedModal";
import { isUsernameAvailable, upsertUserProfile } from "../lib/pollEngagement";
import { makePollImagePath, uploadPollImage } from "../lib/storageImages";

const PROFILE_IMAGE_MAX_MB = 1;
const MB = 1024 * 1024;
const NAME_MAX = 32;
const USERNAME_MAX = 30;
const BIO_MAX = 150;
const USERNAME_DEBOUNCE_MS = 400;
const USERNAME_FORMAT_MESSAGE = "3-30 characters, letters/numbers/underscores/periods only";

function validateUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) return USERNAME_FORMAT_MESSAGE;
  if (!/^[a-z0-9]/.test(username)) return USERNAME_FORMAT_MESSAGE;
  if (username.includes("..")) return USERNAME_FORMAT_MESSAGE;
  return "";
}

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

function makeProfileImagePath(userId) {
  return makePollImagePath({
    pollId: "profile",
    optionId: userId || Math.random().toString(36).slice(2, 10),
  });
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
  isCurrentUserLoading = false,
}) {
  const pathname = usePathname();
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [pfp, setPfp] = useState(currentUser?.pfp || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [joinDate, setJoinDate] = useState(null);
  const [selectedFileSize, setSelectedFileSize] = useState("");
  const [selectedProfileFile, setSelectedProfileFile] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [noticeDialog, setNoticeDialog] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState({
    state: "idle",
    message: "",
  });
  const [profileStats, setProfileStats] = useState({
    created: 0,
    votesCast: 0,
    likesGiven: 0,
  });

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setUsername(currentUser.username || "");
      setPfp(currentUser.pfp || "");
      setBio(currentUser.bio || "");
      setJoinDate(currentUser.joinedAt || Date.now());
      setSaveError("");
    } else {
      setJoinDate(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isModalOpen) return;

    const trimmed = username.trim().toLowerCase().slice(0, USERNAME_MAX);
    if (!trimmed) {
      setUsernameStatus({ state: "idle", message: "" });
      return;
    }

    const formatError = validateUsername(trimmed);
    if (formatError) {
      setUsernameStatus({ state: "error", message: formatError });
      return;
    }

    let isActive = true;
    setUsernameStatus({ state: "checking", message: "Checking..." });

    const timeout = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(trimmed, currentUser?.id);
        if (!isActive) return;
        setUsernameStatus(
          available
            ? { state: "available", message: "✓ Available" }
            : { state: "taken", message: "✗ Username taken" }
        );
      } catch (err) {
        console.error("Username availability check failed:", err);
        if (!isActive) return;
        setUsernameStatus({
          state: "error",
          message: "Could not check username.",
        });
      }
    }, USERNAME_DEBOUNCE_MS);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [username, currentUser?.id, isModalOpen]);

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
    name: name.trim().slice(0, NAME_MAX),
    username: username.trim().toLowerCase().slice(0, USERNAME_MAX) || "guest",
    pfp,
    joinedAt: currentUser?.joinedAt || joinDate || Date.now(),
    bio: bio.trim().slice(0, BIO_MAX),
    ...overrides,
  });

  const handleSave = async () => {
    const cleanUsername = username.trim().toLowerCase().slice(0, USERNAME_MAX);
    const usernameFormatError = validateUsername(cleanUsername);
    if (usernameFormatError) {
      setUsernameStatus({ state: "error", message: usernameFormatError });
      return;
    }

    if (!currentUser?.id || isSavingProfile || usernameStatus.state === "checking" || usernameStatus.state === "taken") {
      return;
    }

    setIsSavingProfile(true);
    setSaveError("");

    try {
      const cleanName = name.trim().slice(0, NAME_MAX);
      const cleanBio = bio.trim().slice(0, BIO_MAX);
      let profilePicUrl = pfp;

      if (selectedProfileFile) {
        profilePicUrl = await uploadPollImage(
          selectedProfileFile,
          makeProfileImagePath(currentUser.id)
        );
      }

      const { data, error } = await upsertUserProfile({
        id: currentUser.id,
        name: cleanName,
        username: cleanUsername,
        profile_pic: profilePicUrl || null,
        bio: cleanBio,
      });

      if (error) throw error;

      const updatedUser = buildUpdatedUser({
        name: data?.name || cleanName,
        username: data?.username || cleanUsername,
        pfp: data?.profile_pic || profilePicUrl || "",
        bio: data?.bio || cleanBio,
      });
      setCurrentUser(updatedUser);
      setSelectedProfileFile(null);
      setSelectedFileSize("");
      setSavePulse(true);
      setTimeout(() => {
        setSavePulse(false);
        setModalOpen(false);
      }, 500);
    } catch (err) {
      console.error("Profile save failed:", err);
      setSaveError(err?.message || "Could not save profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleBioBlur = () => {
    const updatedUser = {
      ...(currentUser || {}),
      bio: bio.trim().slice(0, BIO_MAX),
      joinedAt: currentUser?.joinedAt || joinDate || Date.now(),
    };
    setCurrentUser(updatedUser);
  };

  const handleCopyUserId = async () => {
    const userId = currentUser?.id || "";
    if (!userId) return;

    try {
      await navigator.clipboard.writeText(userId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1200);
    } catch {
      setNoticeDialog({ title: "Copy failed", message: "Could not copy User ID." });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > PROFILE_IMAGE_MAX_MB * MB) {
      setNoticeDialog({ title: "Image too large", message: `Image must be under ${PROFILE_IMAGE_MAX_MB}MB.` });
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPfp(event.target.result);
      setSelectedProfileFile(file);
      setSelectedFileSize(formatFileSize(file.size));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const isActivePath = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(`${href}/`);
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
            title={isCurrentUserLoading ? "Loading profile" : "Profile"}
            type="button"
            disabled={isCurrentUserLoading}
            aria-busy={isCurrentUserLoading}
          >
            {isCurrentUserLoading ? (
              <div className={styles.profileCircleSkeleton} aria-hidden="true" />
            ) : pfp ? (
              <img src={pfp} alt="Profile" className={styles.profileCircleImg} />
            ) : (
              <div className={styles.profileCircle}>
                {username ? username[0].toUpperCase() : "G"}
              </div>
            )}
          </button>
        </div>
      </header>

      <nav className={styles.mobileTabBar} aria-label="Mobile primary navigation">
        <Link
          href="/"
          className={`${styles.mobileTabItem} ${isActivePath("/") ? styles.mobileTabActive : ""}`}
        >
          <span className={`${styles.mobileTabIcon} ${styles.mobileTabIconHome}`} aria-hidden="true" />
          <span>Home</span>
        </Link>

        <Link
          href="/hashtags"
          className={`${styles.mobileTabItem} ${isActivePath("/hashtags") ? styles.mobileTabActive : ""}`}
        >
          <span className={`${styles.mobileTabIcon} ${styles.mobileTabIconExplore}`} aria-hidden="true" />
          <span>Explore</span>
        </Link>

        <button
          className={styles.mobileCreateTab}
          onClick={onCreateClick}
          type="button"
          aria-label="Create poll"
        >
          <span className={styles.mobileCreatePlus} aria-hidden="true" />
        </button>

        <Link
          href="/notifications"
          className={`${styles.mobileTabItem} ${isActivePath("/notifications") ? styles.mobileTabActive : ""}`}
        >
          <span className={`${styles.mobileTabIcon} ${styles.mobileTabIconBell}`} aria-hidden="true" />
          <span>Notifications</span>
        </Link>

        <button
          className={`${styles.mobileTabItem} ${isModalOpen ? styles.mobileTabActive : ""}`}
          onClick={() => setModalOpen(true)}
          type="button"
        >
          <span className={`${styles.mobileTabIcon} ${styles.mobileTabIconProfile}`} aria-hidden="true" />
          <span>Profile</span>
        </button>
      </nav>

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
              <p className={styles.joinDate}>{joinDate ? formatJoinedDate(joinDate) : "Loading account..."}</p>
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
                <label className={styles.modalLabel}>Name</label>
                <span className={styles.charCount}>{name.length}/{NAME_MAX}</span>
              </div>
              <input
                type="text"
                className={styles.modalInput}
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, NAME_MAX));
                  setSaveError("");
                }}
                placeholder="Display name"
                maxLength={NAME_MAX}
              />

              <div className={styles.labelRow}>
                <label className={styles.modalLabel}>Username</label>
                <span className={styles.charCount}>{username.length}/{USERNAME_MAX}</span>
              </div>
              <input
                type="text"
                className={styles.modalInput}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().slice(0, USERNAME_MAX));
                  setSaveError("");
                }}
                placeholder="username"
                maxLength={USERNAME_MAX}
              />
              {usernameStatus.message && (
                <p className={`${styles.usernameStatus} ${styles[`usernameStatus_${usernameStatus.state}`]}`}>
                  {usernameStatus.state === "available"
                    ? "Available"
                    : usernameStatus.state === "taken"
                      ? "Taken"
                      : usernameStatus.message}
                </p>
              )}

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

            <div className={styles.modalLegalLinks}>
              <Link href="/terms" onClick={() => setModalOpen(false)}>Terms</Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacy" onClick={() => setModalOpen(false)}>Privacy</Link>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.saveBtn} ${savePulse ? styles.savePulse : ""}`}
                onClick={handleSave}
                disabled={isCurrentUserLoading || !currentUser?.id || isSavingProfile || usernameStatus.state === "checking" || usernameStatus.state === "taken" || usernameStatus.state === "error"}
              >
                {isCurrentUserLoading ? "Loading..." : isSavingProfile ? "Saving..." : "Save"}
              </button>
            </div>
            {saveError && <p className={styles.saveError}>{saveError}</p>}
          </div>
        </div>
      )}

      <ThemedModal
        open={Boolean(noticeDialog)}
        title={noticeDialog?.title}
        message={noticeDialog?.message}
        confirmLabel="OK"
        onConfirm={() => setNoticeDialog(null)}
      />
    </>
  );
}



