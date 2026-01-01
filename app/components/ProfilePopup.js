import React, { useState } from "react";
import { safeLocalSet } from "./utils/storage";
import { LS_KEYS } from "./utils/constants";
import styles from "./styles.module.css";

const ProfilePopup = ({ currentUser, setCurrentUser, onClose }) => {
  const [newName, setNewName] = useState(currentUser?.name || "");

  const handleNameChange = () => {
    const updated = { ...currentUser, name: newName };
    setCurrentUser(updated);
    safeLocalSet(LS_KEYS.USER, updated);
  };

  const handleImageUpload = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = { ...currentUser, avatar: reader.result };
        setCurrentUser(updated);
        safeLocalSet(LS_KEYS.USER, updated);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={styles.profilePopup}>
      <h3>Edit Profile</h3>
      <input value={newName} onChange={e => setNewName(e.target.value)} onBlur={handleNameChange} className={styles.input} />
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <button onClick={onClose}>Close</button>
    </div>
  );
};

export default ProfilePopup;
