"use client";

import { useMemo, useState } from "react";
import styles from "./PollCreator.module.css";

const MIN_OPTIONS = 5;
const MAX_OPTIONS = 199;
const MAX_IMAGE_MB = 2;

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
      ? poll.options.map((o, i) => ({
          ...o,
          id: o.id || `opt-${Date.now()}-${i}`,
          rating: o.rating ?? 1000,
          votes: o.votes ?? 0,
        }))
      : Array.from({ length: MIN_OPTIONS }, (_, i) => makeEmptyOption(i))
  );
  const [hashtags, setHashtags] = useState(poll?.hashtags?.join(", ") || "");
  const [loading, setLoading] = useState(false);

  const validOptionCount = useMemo(
    () => options.filter((option) => option.text.trim()).length,
    [options]
  );

  const handleImageUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      alert(`Please use an image under ${MAX_IMAGE_MB}MB.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setOptions((prev) =>
        prev.map((option, i) =>
          i === index ? { ...option, image: ev.target.result } : option
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) {
      alert(`Maximum ${MAX_OPTIONS} options allowed.`);
      return;
    }
    setOptions((prev) => [...prev, makeEmptyOption(prev.length)]);
  };

  const removeOption = (index) => {
    if (options.length <= MIN_OPTIONS) {
      alert(`You must keep at least ${MIN_OPTIONS} options.`);
      return;
    }
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOptionText = (index, value) => {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === index ? { ...option, text: value } : option
      )
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("Enter a title.");
      return;
    }

    const validOptions = options.filter((option) => option.text.trim());
    if (validOptions.length < MIN_OPTIONS) {
      alert(`Enter at least ${MIN_OPTIONS} valid options.`);
      return;
    }

    const updatedPoll = {
      ...(poll || {}),
      id: poll?.id || `poll-${Date.now()}`,
      title: title.trim(),
      options: validOptions.map((option, i) => ({
        id: option.id || `opt-${Date.now()}-${i}`,
        text: option.text.trim(),
        image: option.image || null,
        rating: option.rating ?? 1000,
        votes: option.votes ?? 0,
      })),
      hashtags: hashtags
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
      creator: poll?.creator || currentUser?.username || "Anonymous",
      creatorId: poll?.creatorId || currentUser?.id || "guest",
      likes: poll?.likes ?? 0,
      total_votes: poll?.total_votes ?? 0,
      createdAt: poll?.createdAt ?? Date.now(),
    };

    setLoading(true);

    try {
      await onCreate(updatedPoll);
    } catch (err) {
      console.error(err);
      alert("Failed to save poll. Please check the backend connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.creator}>
      <div className={styles.creatorHeader}>
        <div>
          <h2>{mode === "edit" ? "Edit Poll" : "Create a Poll"}</h2>
          <p>
            {validOptionCount}/{MIN_OPTIONS} required options ready
          </p>
        </div>
        <button onClick={onCancel} className={styles.closeBtn} type="button">
          Close
        </button>
      </div>

      <label>Title</label>
      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Who's the GOAT?"
        maxLength={90}
      />

      <div className={styles.optionHeader}>
        <label>Options</label>
        <span>{options.length} total</span>
      </div>

      <div className={styles.optionList}>
        {options.map((option, index) => (
          <div key={option.id} className={styles.optionRow}>
            <span className={styles.optionNumber}>{index + 1}</span>
            <input
              className={styles.input}
              value={option.text}
              onChange={(e) => updateOptionText(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              maxLength={70}
            />

            <label className={styles.fileLabel}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(index, e)}
              />
              Upload
            </label>

            {option.image ? (
              <img
                src={option.image}
                alt={`Option ${index + 1}`}
                className={styles.previewImg}
              />
            ) : (
              <div className={styles.previewPlaceholder}>IMG</div>
            )}

            {options.length > MIN_OPTIONS && (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => removeOption(index)}
                aria-label={`Remove option ${index + 1}`}
              >
                X
              </button>
            )}
          </div>
        ))}
      </div>

      <button className={styles.addBtn} onClick={addOption} type="button">
        Add option
      </button>

      <label>Hashtags</label>
      <input
        className={styles.input}
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
        placeholder="football, legends"
      />

      <div className={styles.actions}>
        <button onClick={handleSubmit} disabled={loading} type="button">
          {loading
            ? "Saving..."
            : mode === "edit"
            ? "Save Changes"
            : "Create Poll"}
        </button>

        <button onClick={onCancel} className={styles.cancelBtn} type="button">
          Cancel
        </button>
      </div>

      <p className={styles.notice}>
        Please avoid offensive, hateful, or misleading content. You are
        responsible for what you publish.
      </p>
    </div>
  );
}
