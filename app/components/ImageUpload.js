"use client";
import React, { useState } from "react";
import styles from "./styles.module.css";
import { makePollImagePath, uploadPollImage } from "../lib/storageImages";

const OPTION_IMAGE_MAX_MB = 3;
const MB = 1024 * 1024;

const ImageUpload = ({ onImageSelect }) => {
  const [preview, setPreview] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > OPTION_IMAGE_MAX_MB * MB) {
        alert(`Image must be under ${OPTION_IMAGE_MAX_MB}MB`);
        e.target.value = "";
        return;
      }

      try {
        const url = await uploadPollImage(file, makePollImagePath());
        setPreview(url);
        onImageSelect(url);
      } catch (err) {
        console.error("Image upload failed:", err);
        alert(`Image upload failed. ${err?.message || "Please try again."}`);
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
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      {preview && (
        <img src={preview} alt="Poll preview" className={styles.previewImage} />
      )}
    </div>
  );
};

export default ImageUpload;
