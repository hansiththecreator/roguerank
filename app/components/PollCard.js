// app/components/PollCard.js
"use client";
import React, { useState } from "react";
import Link from "next/link";
import styles from "./PollCard.module.css";

function getCreatorHref(poll) {
  return `/creator/${encodeURIComponent(poll?.creatorId || poll?.creator || "unknown")}`;
}

const PollCard = ({
  poll,
  onVote,
  onLike,
  onSave,
  onCreatorClick,
  currentUser,
  onDelete,
  onEdit,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [liked, setLiked] = useState(!!poll.liked);
  const [saved, setSaved] = useState(!!poll.saved);
  const [menuOpen, setMenuOpen] = useState(false);

  const isCreator = currentUser?.id === poll.creatorId;

  const handleVote = (optionId) => {
    if (selectedId) return;
    setSelectedId(optionId);
    onVote?.(poll.id, optionId);
  };

  const handleLike = () => {
    setLiked((v) => !v);
    onLike?.(poll.id);
  };

  const handleSave = () => {
    setSaved((v) => !v);
    onSave?.(poll.id, !saved);
  };

  return (
    <div className={styles.pollCard}>
      <div className={styles.creatorHeader}>
        <Link className={styles.creatorInfo} href={getCreatorHref(poll)}>
          <div className={styles.creatorName}>{poll.creator}</div>
          <div className={styles.creatorId}>{poll.creatorId}</div>
        </Link>

        {isCreator && (
          <div className={styles.menuWrapper}>
            <button
              className={styles.menuBtn}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋮
            </button>

            {menuOpen && (
              <div className={styles.menu}>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(poll);
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  className={styles.danger}
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(poll.id);
                  }}
                >
                  🗑 Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <h3 className={styles.pollQuestion}>{poll.title}</h3>

      <div className={styles.pollOptions}>
        {poll.options.map((opt) => (
          <button
            key={opt.id}
            className={`${styles.pollOption} ${
              selectedId === opt.id ? styles.selected : ""
            }`}
            onClick={() => handleVote(opt.id)}
            disabled={!!selectedId}
          >
            {opt.image ? (
              <img src={opt.image} className={styles.optionImg} />
            ) : (
              <div className={styles.optionImgPlaceholder}>⭐</div>
            )}
            <div className={styles.optionText}>{opt.text}</div>
          </button>
        ))}
      </div>

      <div className={styles.pollActions}>
        <button className={styles.iconBtn} onClick={handleLike}>
          <span style={{ color: poll.liked ? "red" : "#9AA6C2" }}>
            {poll.liked ? "♥︎" : "♡"}
          </span>
        </button>
        <span>{poll.likes || 0}</span>

        <button className={styles.iconBtn} onClick={handleSave}>💾</button>
      </div>
    </div>
  );
};

export default PollCard;
