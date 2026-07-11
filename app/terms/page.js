import Link from "next/link";
import styles from "../components/LegalPage.module.css";

export const metadata = {
  title: "Terms of Service | Rogue Rank",
};

const sections = [
  {
    title: "1. Acceptance",
    paragraphs: ["By using Rogue Rank, you agree to these terms."],
  },
  {
    title: "2. User Content",
    paragraphs: ["You are responsible for:"],
    items: ["Polls", "Images", "Usernames", "Comments (if added later)"],
    secondaryLabel: "You must not post:",
    secondaryItems: [
      "Illegal content",
      "Copyright-infringing content",
      "Harassment or threats",
      "Malware or phishing links",
      "Explicit sexual content involving minors",
    ],
  },
  {
    title: "3. Content Ownership",
    paragraphs: [
      "You retain ownership of content you upload.",
      "You grant Rogue Rank a license to:",
    ],
    items: ["Display", "Store", "Rank", "Distribute the content on the platform"],
  },
  {
    title: "4. No Guarantee of Accuracy",
    paragraphs: ["Rankings are generated from user votes and may not reflect objective truth."],
  },
  {
    title: "5. Moderation Rights",
    paragraphs: ["Rogue Rank may remove content or accounts at any time for any reason."],
  },
  {
    title: "6. Disclaimer",
    paragraphs: ['The platform is provided "as is" without warranties of any kind.'],
  },
  {
    title: "7. Limitation of Liability",
    paragraphs: ["Rogue Rank and its operators are not liable for:"],
    items: [
      "User-generated content",
      "Data loss",
      "Service interruptions",
      "Decisions made based on rankings",
    ],
  },
  {
    title: "8. Termination",
    paragraphs: ["We may suspend or terminate access at our discretion."],
  },
  {
    title: "9. Changes",
    paragraphs: ["These terms may be updated without prior notice."],
  },
  {
    title: "10. Contact",
    contact: "Roguerankofficial@gmail.com",
  },
];

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <Link href="/" className={styles.backLink}>Back to Rogue Rank</Link>
        <article className={styles.panel}>
          <span className={styles.eyebrow}>Rogue Rank</span>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.intro}>
            These terms describe the rules for using Rogue Rank and posting content on the platform.
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
              {section.secondaryLabel && <p>{section.secondaryLabel}</p>}
              {section.secondaryItems && (
                <ul>
                  {section.secondaryItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
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
