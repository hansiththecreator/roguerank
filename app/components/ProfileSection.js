"use client";
import React, { useState } from "react";
import styles from "./styles.module.css";

const ProfileSection = ({ polls = [], currentUser, onDeletePoll, onEditPoll }) => {
  const [editingPoll, setEditingPoll] = useState(null);
  const [newQuestion, setNewQuestion] = useState("");

  if (!currentUser) {
    return (
      <div className={styles.profileSection}>
        <p className={styles.notice}>⚠️ Please log in to see your profile.</p>
      </div>
    );
  }

  const userPolls = Array.isArray(polls)
    ? polls.filter((p) => p?.creator?.id === currentUser?.id)
    : [];

  return (
    <section className={styles.profileSection}>
      <div className={styles.profileHeader}>
        <img
          src={currentUser.pfp || "/defaultpfp.jpeg"}
          alt="User"
          className={styles.profilePic}
        />
        <div>
          <h2 className={styles.username}>{currentUser.username || "Anonymous"}</h2>
          <p className={styles.userId}>@{currentUser.id}</p>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>My Polls</h3>
      <div className={styles.myPollsList}>
        {userPolls.length === 0 ? (
          <p className={styles.notice}>You haven’t created any polls yet.</p>
        ) : (
          userPolls.map((poll) => (
            <div key={poll.id} className={styles.myPollItem}>
              {editingPoll === poll.id ? (
                <div className={styles.editPollBox}>
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="Edit question..."
                  />
                  <button
                    onClick={() => {
                      onEditPoll(poll.id, newQuestion);
                      setEditingPoll(null);
                    }}
                    className={styles.saveBtn}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingPoll(null)}
                    className={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span>{poll.question}</span>
                  <div className={styles.pollActions}>
                    <button
                      onClick={() => {
                        setEditingPoll(poll.id);
                        setNewQuestion(poll.question);
                      }}
                      className={styles.editBtn}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDeletePoll(poll.id)}
                      className={styles.deleteBtn}
                    >
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default ProfileSection;
