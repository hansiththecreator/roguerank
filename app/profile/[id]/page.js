"use client";

import { useParams, useRouter } from "next/navigation";
import ProfilePage from "../../components/ProfilePage";
import styles from "./ProfileRoute.module.css";

export default function ProfileRoute() {
  const params = useParams();
  const { id } = params;
  const router = useRouter();

  return (
    <main className={styles.profileRoute}>
      <button
        onClick={() => router.back()}
        className={styles.backButton}
        type="button"
      >
        Back
      </button>

      <ProfilePage userId={id} />
    </main>
  );
}
