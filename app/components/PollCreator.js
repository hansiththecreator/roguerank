"use client";
import { useState } from "react";
import styles from "./PollCreator.module.css";

const makeEmptyOption = (seed = 0) => ({
  text: "",
  image: null,
  id: `opt-${Date.now()}-${seed}`,
  rating: 1000,
  votes: 0,
});

export default function PollCreator({
  onCreate,
  onCancel,
  currentUser,
  poll,
  mode = "create",
}) {
  const [title, setTitle] = useState(poll?.title || "");
  const [options, setOptions] = useState(
    poll?.options?.length
      ? poll.options.map((o, i) => ({ ...o, id: o.id || `opt-${Date.now()}-${i}` }))
      : Array.from({ length: 5 }, (_, i) => makeEmptyOption(i))
  );
  const [hashtags, setHashtags] = useState(
    poll?.hashtags?.join(", ") || ""
  );

  // ---------- IMAGE UPLOAD ----------
  const handleImageUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target.result;
      setOptions((prev) =>
        prev.map((o, i) => (i === index ? { ...o, image: data } : o))
      );
    };
    reader.readAsDataURL(file);
  };

  // ---------- ADD / REMOVE OPTIONS ----------
  const addOption = () => {
    if (options.length >= 199) return alert("Maximum 199 options allowed.");
    setOptions((s) => [...s, makeEmptyOption(s.length)]);
  };

  const removeOption = (index) => {
    if (options.length <= 5)
      return alert("You must keep at least 5 options!");
    setOptions((s) => s.filter((_, i) => i !== index));
  };

  // ---------- CREATE / SAVE ----------
  const handleSubmit = () => {
    if (!title.trim()) return alert("Enter a title!");

    const validCount = options.filter((o) => o.text.trim()).length;
    if (validCount < 5)
      return alert("Enter at least 5 valid options!");

    const updatedPoll = {
      ...(poll || {}),
      id: poll?.id || `poll-${Date.now()}`,
      title: title.trim(),
      options: options
        .filter((o) => o.text.trim())
        .map((o, i) => ({
          id: o.id || `opt-${Date.now()}-${i}`,
          text: o.text.trim(),
          image: o.image || null,
          rating: o.rating ?? 1000,
          votes: o.votes ?? 0,
        })),
      hashtags: hashtags
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
      creator: poll?.creator || currentUser?.username || "Anonymous",
      creatorId: poll?.creatorId || currentUser?.id || "guest",
      likes: poll?.likes ?? 0,
      createdAt: poll?.createdAt ?? Date.now(),
    };

    onCreate(updatedPoll);
  };

  return (
    <div className={styles.creator}>
      <h2>{mode === "edit" ? "Edit Poll" : "Create a Poll"}</h2>

      {/* ---------- TITLE ---------- */}
      <label>Title</label>
      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Who's the GOAT?"
      />

      {/* ---------- OPTIONS ---------- */}
      <label>Options</label>
      {options.map((opt, index) => (
        <div key={opt.id} className={styles.optionRow}>
          <input
            className={styles.input}
            value={opt.text}
            onChange={(e) => {
              const v = e.target.value;
              setOptions((prev) =>
                prev.map((o, i) =>
                  i === index ? { ...o, text: v } : o
                )
              );
            }}
            placeholder={`Option ${index + 1}`}
          />

          <label className={styles.fileLabel}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(index, e)}
              style={{ display: "none" }}
            />
            <span className={styles.fileBtn}>📷</span>
          </label>

          {opt.image ? (
            <img
              src={opt.image}
              alt={`option-${index}`}
              className={styles.previewImg}
            />
          ) : (
            <div className={styles.previewPlaceholder}>⭐</div>
          )}

          {options.length > 5 && (
            <button
              className={styles.deleteBtn}
              onClick={() => removeOption(index)}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button className={styles.addBtn} onClick={addOption}>
        + Add Option
      </button>

      {/* ---------- HASHTAGS ---------- */}
      <label>Hashtags (comma-separated)</label>
      <input
        className={styles.input}
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
        placeholder="football, legends"
      />

      {/* ---------- ACTIONS ---------- */}
      <div className={styles.actions}>
        <button
          onClick={handleSubmit}
          disabled={
            options.filter((o) => o.text.trim()).length < 5 || !title.trim()
          }
        >
          {mode === "edit" ? "Save Changes" : "Create Poll"}
        </button>

        <button onClick={onCancel} className={styles.cancelBtn}>
          Cancel
        </button>
      </div>

      {/* ⚠️ CONTENT GUIDELINE NOTICE */}
      <p
        style={{
          marginTop: 10,
          fontSize: 12,
          color: "#9AA6C2",
          textAlign: "center",
        }}
      >
        Please avoid offensive, hateful, or misleading content. You are
        responsible for what you publish.
      </p>
    </div>
  );
}
