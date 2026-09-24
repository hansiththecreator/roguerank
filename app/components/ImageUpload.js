"use client";
import React, { useState } from "react";
import styles from "./styles.module.css";
import ThemedModal from "./ThemedModal";
import { makePollImagePath, uploadPollImage } from "../lib/storageImages";

const OPTION_IMAGE_MAX_MB = 3;
const MB = 1024 * 1024;

const ImageUpload = ({ onImageSelect }) => {
  const [preview, setPreview] = useState(null);
  const [noticeDialog, setNoticeDialog] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > OPTION_IMAGE_MAX_MB * MB) {
        setNoticeDialog({ title: "Image too large", message: `Image must be under ${OPTION_IMAGE_MAX_MB}MB.` });
        e.target.value = "";
        return;
      }

      try {
        const url = await uploadPollImage(file, makePollImagePath());
        setPreview(url);
        onImageSelect(url);
      } catch (err) {
        console.error("Image upload failed:", err);
        setNoticeDialog({ title: "Image upload failed", message: err?.message || "Please try again." });
      } finally {
        e.target.value = "";
      }
    }
  };

  return (
    <div className={styles.imageUpload}>
      <label htmlFor="pollImageUpload" className={styles.uploadLabel}>
        📸 Upload Image
      </label>
      <input
        id="pollImageUpload"
        name="poll-image-upload"
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      {preview && (
        <img src={preview} alt="Poll preview" className={styles.previewImage} />
      )}
      <ThemedModal
        open={Boolean(noticeDialog)}
        title={noticeDialog?.title}
        message={noticeDialog?.message}
        confirmLabel="OK"
        onConfirm={() => setNoticeDialog(null)}
      />
    </div>
  );
};

export default ImageUpload;
