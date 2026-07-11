"use client";

import { useEffect, useState } from "react";
import styles from "./PollCreator.module.css";
import ImageCropper from "./ImageCropper";

const MIN_OPTIONS = 5;
const OPTION_IMAGE_MAX_MB = 3;
const THUMBNAIL_IMAGE_MAX_MB = 2;
const MB = 1024 * 1024;

function makeId(prefix) {
  const random = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now()}-${random}`;
}

function makeEmptyOption() {
  return {
    id: makeId("opt"),
    text: "",
    image: null,
  };
}

export default function PollCreator({
  mode = "create",
  poll = null,
  currentUser,
  onCancel,
  onCreate,
}) {
  const [title, setTitle] = useState(poll?.title || "");
  const [options, setOptions] = useState(
    poll?.options && poll.options.length > 0
      ? poll.options
      : Array.from({ length: MIN_OPTIONS }, makeEmptyOption)
  );
  const [hashtags, setHashtags] = useState(
    poll?.hashtags?.join(" ") || ""
  );
  const [thumbnail, setThumbnail] = useState(poll?.thumbnail || null);
  const [croppingOption, setCroppingOption] = useState(null);
  const [croppingThumbnail, setCroppingThumbnail] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ Edit mode — lock option names
  const isEditing = mode === "edit";

  useEffect(() => {
    return () => {
      if (imageToCrop?.startsWith("blob:")) {
        URL.revokeObjectURL(imageToCrop);
      }
    };
  }, [imageToCrop]);

  const handleAddOption = () => {
    setOptions([...options, makeEmptyOption()]);
  };

  const handleRemoveOption = (id) => {
    if (options.length > MIN_OPTIONS) {
      setOptions(options.filter((o) => o.id !== id));
    }
  };

  const handleOptionChange = (id, field, value) => {
    // ✅ In edit mode, don't allow name changes
    if (isEditing && field === "text") return;

    setOptions(
      options.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const handleImageUpload = (e, optionId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > OPTION_IMAGE_MAX_MB * MB) {
      alert(`Image must be under ${OPTION_IMAGE_MAX_MB}MB`);
      e.target.value = "";
      return;
    }

    setImageToCrop(URL.createObjectURL(file));
    setCroppingOption(optionId);
    e.target.value = "";
  };

  const handleThumbnailUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > THUMBNAIL_IMAGE_MAX_MB * MB) {
      alert(`Image must be under ${THUMBNAIL_IMAGE_MAX_MB}MB`);
      e.target.value = "";
      return;
    }

    setImageToCrop(URL.createObjectURL(file));
    setCroppingThumbnail(true);
    e.target.value = "";
  };

  const handleCropComplete = (croppedImage) => {
    if (croppingOption) {
      setOptions(
        options.map((o) =>
          o.id === croppingOption ? { ...o, image: croppedImage } : o
        )
      );
      setCroppingOption(null);
    } else if (croppingThumbnail) {
      setThumbnail(croppedImage);
      setCroppingThumbnail(false);
    }
    setImageToCrop(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Poll title is required.");
      return;
    }

    const validOptions = options.filter((o) => o.text.trim());
    if (validOptions.length < MIN_OPTIONS) {
      alert(`At least ${MIN_OPTIONS} options with names are required.`);
      return;
    }

    setIsSaving(true);

    const newPoll = {
      id: poll?.id || makeId("poll"),
      isNew: !poll?.id,
      title: title.trim(),
      creator: currentUser?.username || "Guest",
      creatorId: currentUser?.id,
      hashtags: hashtags
        .trim()
        .split(/\s+/)
        .filter(Boolean),
      thumbnail,
      options: validOptions,
      likes: poll?.likes || 0,
      total_votes: poll?.total_votes || 0,
      createdAt: poll?.createdAt,
    };

    try {
      await onCreate?.(newPoll);
    } catch (err) {
      console.error("Save failed:", err);
      alert(`Failed to save poll. ${err?.message || "Please try again."}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.creatorContainer}>
      <div className={styles.creatorBox}>
        <h2 className={styles.creatorTitle}>
          {isEditing ? "Edit Poll" : "Create Poll"}
        </h2>

        {/* ✅ POLL TITLE — locked in edit mode */}
        <label className={styles.label}>Poll Title</label>
        <input
          type="text"
          className={`${styles.input} ${isEditing ? styles.locked : ""}`}
          value={title}
          onChange={(e) => !isEditing && setTitle(e.target.value)}
          placeholder="What's your poll about?"
          disabled={isEditing}
          maxLength={120}
        />

        {/* ✅ POLL THUMBNAIL */}
        <label className={styles.label}>Poll Cover Image (Optional)</label>
        <div className={styles.thumbnailUpload}>
          {thumbnail && (
            <img src={thumbnail} alt="Cover" className={styles.thumbnailPreview} />
          )}
          <label className={styles.uploadBtn}>
            {thumbnail ? "Change Cover" : "Upload Cover"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleThumbnailUpload}
            />
          </label>
        </div>

        {/* ✅ OPTIONS — names locked in edit mode */}
        <label className={styles.label}>Options</label>
        {options.map((option, idx) => (
          <div key={option.id} className={styles.optionRow}>
            <div className={styles.optionGroup}>
              <input
                type="text"
                className={`${styles.optionInput} ${isEditing ? styles.locked : ""}`}
                value={option.text}
                onChange={(e) =>
                  handleOptionChange(option.id, "text", e.target.value)
                }
                placeholder={`Option ${idx + 1}`}
                disabled={isEditing}
                maxLength={80}
              />
              {option.image && (
                <img
                  src={option.image}
                  alt={`${option.text || `Option ${idx + 1}`} preview`}
                  className={styles.optionPreview}
                />
              )}
              {isEditing && (
                <span className={styles.lockHint}>Name locked to protect voting integrity</span>
              )}
            </div>

            {/* ✅ OPTION IMAGE — editable in both modes */}
            <label className={styles.optionImageBtn}>
              {option.image ? "✓ Image" : "Add Image"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleImageUpload(e, option.id)}
              />
            </label>

            {options.length > MIN_OPTIONS && (
              <button
                className={styles.removeBtn}
                onClick={() => handleRemoveOption(option.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button className={styles.addOptionBtn} onClick={handleAddOption}>
          + Add Option
        </button>

        {/* ✅ HASHTAGS */}
        <label className={styles.label}>Hashtags (space-separated)</label>
        <input
          type="text"
          className={styles.input}
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="e.g. cars sports racing"
        />

        {/* ✅ ACTIONS */}
        <div className={styles.actions}>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEditing ? "Update Poll" : "Create Poll"}
          </button>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>

      {/* ✅ IMAGE CROPPER — multi-viewport */}
      {(croppingOption || croppingThumbnail) && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setCroppingOption(null);
            setCroppingThumbnail(false);
            setImageToCrop(null);
          }}
          forThumbnail={croppingThumbnail}
        />
      )}
    </div>
  );
}
