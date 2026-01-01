"use client";
import { useParams, useRouter } from "next/navigation";
import ProfilePage from "../../components/ProfilePage";

export default function ProfileRoute() {
  const params = useParams();
  const { id } = params;
  const router = useRouter();

  return (
    <main style={{ padding: 24 }}>
      <button
        onClick={() => router.back()}
        style={{
          background: "#0ea5e9",
          border: "none",
          color: "#001218",
          padding: "6px 12px",
          borderRadius: 8,
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        ← Back
      </button>

      <ProfilePage userId={id} />
    </main>
  );
}
