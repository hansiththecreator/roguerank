"use client";
import React, { useState } from "react";
import styles from "./styles.module.css";

const ImageUpload = ({ onImageSelect }) => {
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target.result);
        onImageSelect(event.target.result); // Pass image back up to parent
      };
      reader.readAsDataURL(file);
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
