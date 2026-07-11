import Link from "next/link";
import styles from "../components/LegalPage.module.css";

export const metadata = {
  title: "Privacy Policy | Rogue Rank",
};

const sections = [
  {
    title: "1. Information We Collect",
    items: [
      "Username",
      "Profile picture (if uploaded)",
      "Polls you create",
      "Votes you cast",
      "Likes you give",
      "Technical information (IP address, browser type, device information)",
    ],
  },
  {
    title: "2. How We Use Information",
    items: [
      "Operate Rogue Rank",
      "Store and display polls",
      "Generate rankings",
      "Improve platform performance",
      "Prevent abuse and spam",
    ],
  },
  {
    title: "3. User Content",
    paragraphs: [
      "Polls, images, usernames, and rankings may be publicly visible.",
      "Do not upload content you do not have permission to use.",
    ],
  },
  {
    title: "4. Third-Party Services",
    paragraphs: ["Rogue Rank uses:"],
    items: ["Supabase (database/authentication)", "Vercel (hosting)"],
    closing: "These providers may process data necessary to operate the platform.",
  },
  {
    title: "5. Data Retention",
    paragraphs: ["We may retain user content and voting data indefinitely unless removed."],
  },
  {
    title: "6. Children's Privacy",
    paragraphs: ["Users under 13 should not use the platform."],
  },
  {
    title: "7. Contact",
    contact: "Roguerankofficial@gmail.com",
  },
];

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <Link href="/" className={styles.backLink}>Back to Rogue Rank</Link>
        <article className={styles.panel}>
          <span className={styles.eyebrow}>Rogue Rank</span>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.intro}>
            This policy explains what information Rogue Rank collects and how it is used to operate the platform.
          </p>

          {sections.map((section) => (
            <section key={section.title} className={styles.section}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.closing && <p>{section.closing}</p>}
              {section.contact && (
                <a className={styles.contact} href={`mailto:${section.contact}`}>
                  {section.contact}
                </a>
              )}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
