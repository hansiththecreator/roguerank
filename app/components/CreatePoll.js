// app/components/CreatePoll.js
"use client";
import React, { useState } from "react";
import styles from "./styles.module.css";
import { makePollImagePath, uploadPollImage } from "../lib/storageImages";

const OPTION_IMAGE_MAX_MB = 3;
const MB = 1024 * 1024;

const makeEmptyOption = (seed = 0) => ({
  id: `opt-${Date.now()}-${seed}`,
  text: "",
  image: null,
  rating: 1000,
  votes: 0,
});

export default function CreatePoll({ onCreate }) {
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState(Array.from({ length: 5 }, (_, i) => makeEmptyOption(i)));

  const handleAddOption = () => {
    if (options.length >= 199) return alert("You’ve reached the max limit (199).");
    setOptions((s) => [...s, makeEmptyOption(s.length)]);
  };

  const handleRemove = (id) => {
    if (options.length <= 5) return alert("You must have at least 5 options!");
    setOptions((s) => s.filter((o) => o.id !== id));
  };

  const handleText = (id, value) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text: value } : o)));
  };

  const handleImageUpload = async (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > OPTION_IMAGE_MAX_MB * MB) {
      alert(`Image must be under ${OPTION_IMAGE_MAX_MB}MB`);
      e.target.value = "";
      return;
    }

    try {
      const url = await uploadPollImage(file, makePollImagePath());
      setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, image: url } : o)));
    } catch (err) {
      console.error("Image upload failed:", err);
      alert(`Image upload failed. ${err?.message || "Please try again."}`);
    } finally {
      e.target.value = "";
    }
  };

  const handleCreate = () => {
    if (!title.trim()) return alert("Enter a poll title!");
    const valid = options.filter((o) => o.text.trim());
    if (valid.length < 5) return alert("You must have at least 5 valid options!");
    const newPoll = {
      id: `poll-${Date.now()}`,
      title: title.trim(),
      options: valid.map((o) => ({
        id: o.id,
        text: o.text.trim(),
        image: o.image || null,
        rating: o.rating ?? 1000,
        votes: o.votes ?? 0,
      })),
      hashtags: [],
      creator: "You",
      creatorId: "local-guest",
      likes: 0,
      createdAt: Date.now(),
    };
    onCreate(newPoll);
    setTitle("");
    setOptions(Array.from({ length: 5 }, (_, i) => makeEmptyOption(i)));
  };

  return (
    <div className={styles.createPoll}>
      <input
        placeholder="Enter poll question..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={styles.input}
      />

      {options.map((opt, idx) => (
        <div key={opt.id} className={styles.optionRow}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
            <input
              placeholder={`Option ${idx + 1}`}
              value={opt.text}
              onChange={(e) => handleText(opt.id, e.target.value)}
              className={styles.input}
              style={{ flex: 1 }}
            />

            <label className={styles.fileLabel}>
              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(opt.id, e)} style={{ display: "none" }} />
              <span className={styles.fileBtn}>📷</span>
            </label>

            {options.length > 5 && (
              <button type="button" onClick={() => handleRemove(opt.id)} className={styles.deleteOption}>✕</button>
            )}
          </div>

          <div style={{ marginTop: 6 }}>
            {opt.image ? <img src={opt.image} alt="preview" className={styles.previewSmall} /> : <div className={styles.previewPlaceholder}>⭐</div>}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={handleAddOption} className={styles.addOption}>+ Add Option</button>
        <button type="button" onClick={handleCreate} className={styles.createButton} disabled={!title.trim() || options.filter((o) => o.text.trim()).length < 5}>Create Poll</button>
      </div>
    </div>
  );
}
