"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ImageCropper from "./ImageCropper";
import ThemedModal from "./ThemedModal";
import styles from "./MultiPoll.module.css";
import { getPollCreatorHandle } from "../lib/creatorProfiles";
import { supabase } from "../lib/supabaseClient";

const COVER_IMAGE_MAX_MB = 2;
const MB = 1024 * 1024;

function formatCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function formatTimeAgo(value) {
  const timestamp = Number(value);
  if (!timestamp) return "Created recently";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Created just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Created ${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Created ${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `Created ${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `Created ${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(days / 365);
  return `Created ${years} year${years === 1 ? "" : "s"} ago`;
}

function getPollThumbnail(poll) {
  if (poll.thumbnail) return poll.thumbnail;
  const withImage = (poll.options || []).filter((option) => option.image);
  if (!withImage.length) return null;
  return [...withImage].sort((a, b) => (b.votes || 0) - (a.votes || 0))[0].image;
}

function getHashtagHref(tag) {
  return `/hashtags/${encodeURIComponent(String(tag).replace(/^#/, ""))}`;
}

function getCreatorHref(poll) {
  return `/creator/${encodeURIComponent(poll.creatorId || poll.creator || "unknown")}`;
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="m21 16-5-5L5 21" />
    </svg>
  );
}

export default function PollGridCard({
  poll,
  currentUser,
  menuOpen,
  isDeleting = false,
  onOpen,
  onShare,
  onLikeToggle,
  onMenuToggle,
  onReport,
  onDelete,
  onCoverUpdated,
  showMenu = true,
}) {
  const fileInputRef = useRef(null);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);
  const [noticeDialog, setNoticeDialog] = useState(null);
  const [createdAtLabel, setCreatedAtLabel] = useState("Created recently");
  const liked = currentUser?.likes?.includes(poll.id);
  const canManage =
    currentUser?.id === poll.creatorId || (!poll.creatorId && currentUser?.username === poll.creator);
  const voteCount =
    poll.total_votes ?? (poll.options || []).reduce((sum, option) => sum + (option.votes || 0), 0);
  const thumbnail = getPollThumbnail(poll);

  useEffect(() => {
    return () => {
      if (imageToCrop?.startsWith("blob:")) {
        URL.revokeObjectURL(imageToCrop);
      }
    };
  }, [imageToCrop]);

  useEffect(() => {
    setCreatedAtLabel(formatTimeAgo(poll.createdAt || poll.createdate));
  }, [poll.createdAt, poll.createdate]);

  const closeCoverCropper = () => {
    if (imageToCrop?.startsWith("blob:")) {
      URL.revokeObjectURL(imageToCrop);
    }
    setImageToCrop(null);
  };

  const handleEditCoverClick = (event) => {
    event.stopPropagation();
    onMenuToggle?.(poll.id);
    fileInputRef.current?.click();
  };

  const handleCoverFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > COVER_IMAGE_MAX_MB * MB) {
      setNoticeDialog({
        title: "Image too large",
        message: `Cover image must be under ${COVER_IMAGE_MAX_MB}MB.`,
      });
      event.target.value = "";
      return;
    }

    closeCoverCropper();
    setImageToCrop(URL.createObjectURL(file));
    event.target.value = "";
  };

  const handleCoverCropComplete = async (coverUrl) => {
    if (!coverUrl || isUpdatingCover) return;
    setIsUpdatingCover(true);

    const previousThumbnail = poll.thumbnail || null;
    onCoverUpdated?.(poll.id, coverUrl);

    try {
      const { error } = await supabase
        .from("polls")
        .update({ thumbnail: coverUrl })
        .eq("id", poll.id);

      if (error) throw error;
      closeCoverCropper();
    } catch (err) {
      console.error("Cover image update failed:", err);
      onCoverUpdated?.(poll.id, previousThumbnail);
      setNoticeDialog({
        title: "Cover update failed",
        message: err?.message || "Please try again.",
      });
    } finally {
      setIsUpdatingCover(false);
    }
  };

  return (
    <article className={styles.pollCard}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label={`Edit cover image for ${poll.title}`}
        style={{ display: "none" }}
        onChange={handleCoverFileChange}
      />

      <div className={styles.cardThumb} onClick={() => onOpen?.(poll)} style={{ cursor: "pointer" }}>
        {thumbnail ? (
          <img src={thumbnail} alt={poll.title} className={styles.cardThumbImg} />
        ) : (
          <div className={styles.cardThumbPlaceholder}>
            {poll.title?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>

      <div className={styles.cardTop}>
        <div className={styles.cardTitleGroup}>
          <strong className={styles.cardTitle}>{poll.title}</strong>
          <span className={styles.cardCreator}>
            by <Link href={getCreatorHref(poll)} className={styles.creatorLink}>{getPollCreatorHandle(poll)}</Link>
          </span>
          <span className={styles.cardCreatedAt}>{createdAtLabel}</span>
        </div>
        {showMenu && (
        <div className={styles.menuWrap}>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onMenuToggle?.(poll.id);
            }}
            className={styles.iconButton}
            aria-label="Poll actions"
            type="button"
          >
            &bull;&bull;&bull;
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onReport?.(poll);
                }}
              >
                &#9888; Report
              </button>
              {canManage && (
                <>
                  <button
                    type="button"
                    disabled={isUpdatingCover}
                    onClick={handleEditCoverClick}
                  >
                    <ImageIcon /> Edit cover image
                  </button>
                  <button
                    type="button"
                    className={styles.dangerItem}
                    disabled={isDeleting}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete?.(poll);
                    }}
                  >
                    &#128465; {isDeleting ? "Deleting..." : "Delete poll"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {poll.hashtags?.length > 0 && (
        <div className={styles.tagRow}>
          {poll.hashtags.map((tag) => (
            <Link key={tag} href={getHashtagHref(tag)} className={styles.tag}>#{tag}</Link>
          ))}
        </div>
      )}

      <div className={styles.cardStats}>
        <span>{formatCount((poll.options || []).length)} options</span>
        <span>{formatCount(voteCount)} votes</span>
        <span>{formatCount(poll.likes)} likes</span>
      </div>

      <div className={styles.cardBottom}>
        <button className={styles.cardButton} onClick={() => onOpen?.(poll)} type="button">Vote</button>
        <button
          className={styles.cardButtonShare}
          onClick={() => onShare?.(poll)}
          aria-label={`Share ${poll.title}`}
          type="button"
        >
          <ShareIcon />
        </button>
        <button
          className={`${styles.cardButtonLike} ${liked ? styles.liked : ""}`}
          onClick={() => onLikeToggle?.(poll.id)}
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
          type="button"
        >
          <span aria-hidden="true">{liked ? "\u2665" : "\u2661"}</span>
          <span className={styles.likeCount}>{formatCount(poll.likes)}</span>
        </button>
      </div>

      {imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCoverCropComplete}
          onCancel={closeCoverCropper}
          forThumbnail
        />
      )}

      <ThemedModal
        open={Boolean(noticeDialog)}
        title={noticeDialog?.title}
        message={noticeDialog?.message}
        confirmLabel="OK"
        onConfirm={() => setNoticeDialog(null)}
      />
    </article>
  );
}
