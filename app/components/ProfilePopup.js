import React, { useState } from "react";
import { safeLocalSet } from "./utils/storage";
import { LS_KEYS } from "./utils/constants";
import styles from "./styles.module.css";
import ThemedModal from "./ThemedModal";

const PROFILE_IMAGE_MAX_MB = 1;
const MB = 1024 * 1024;

const ProfilePopup = ({ currentUser, setCurrentUser, onClose }) => {
  const [newName, setNewName] = useState(currentUser?.name || "");
  const [noticeDialog, setNoticeDialog] = useState(null);

  const handleNameChange = () => {
    const updated = { ...currentUser, name: newName };
    setCurrentUser(updated);
    safeLocalSet(LS_KEYS.USER, updated);
  };

  const handleImageUpload = e => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > PROFILE_IMAGE_MAX_MB * MB) {
        setNoticeDialog({ title: "Image too large", message: `Image must be under ${PROFILE_IMAGE_MAX_MB}MB.` });
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = { ...currentUser, avatar: reader.result };
        setCurrentUser(updated);
        safeLocalSet(LS_KEYS.USER, updated);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    }
  };

  return (
    <div className={styles.profilePopup}>
      <h3>Edit Profile</h3>
      <input value={newName} onChange={e => setNewName(e.target.value)} onBlur={handleNameChange} className={styles.input} />
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <button onClick={onClose}>Close</button>
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

export default ProfilePopup;
