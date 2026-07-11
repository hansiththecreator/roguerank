"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./styles.module.css";

const Icon = ({ name }) => {
  const icons = {
    random: "🎲",
    liked: "♥",
    visited: "🕐",
    info: "ℹ",
  };
  return <span className={styles.menuIcon}>{icons[name]}</span>;
};

export default function LeftMenu({
  isOpen,
  onClose,
  onRandomPoll,
  currentUser,
  polls,
  onSelectPoll,
}) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(null);
  const [visitedPollIds, setVisitedPollIds] = useState([]);
  const [pulsingItem, setPulsingItem] = useState(null);

  // ✅ Load visited polls from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("rankr_visited_polls");
    if (saved) {
      try {
        setVisitedPollIds(JSON.parse(saved));
      } catch {
        setVisitedPollIds([]);
      }
    }
  }, []);

  const handleSelectSection = (section) => {
    setPulsingItem(section);
    setTimeout(() => setPulsingItem(null), 260);
    setActiveSection(activeSection === section ? null : section);
  };

  const handlePollClick = (poll) => {
    onSelectPoll?.(poll);
    onClose?.();
    setActiveSection(null);
  };

  const handleRandomPoll = () => {
    setPulsingItem("random");
    onRandomPoll?.();
    onClose?.();
    setActiveSection(null);
  };

  const handleMyPolls = () => {
    setPulsingItem("mine");
    router.push("/my-polls");
    onClose?.();
    setActiveSection(null);
  };

  // ✅ Get liked polls
  const likedPolls = polls.filter((p) =>
    currentUser?.likes?.includes(p.id)
  );

  // ✅ Get visited polls
  const visitedPolls = polls.filter((p) =>
    visitedPollIds.includes(p.id)
  );

  return (
    <>
      {isOpen && (
        <button
          className={styles.overlay}
          onClick={onClose}
          aria-label="Close menu"
          type="button"
        />
      )}

      <aside
        className={`${styles.leftMenu} ${isOpen ? styles.showMenu : ""}`}
        aria-hidden={!isOpen}
      >
        <div className={styles.menuTopRow}>
          <h2 className={styles.menuTitle}>Rogue Rank</h2>
          <button className={styles.closeMenuBtn} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <nav className={styles.menuNav} aria-label="Main menu">
          {/* RANDOM POLL */}
          <button
            className={`${styles.menuItem} ${styles.randomMenuItem} ${pulsingItem === "random" ? styles.menuItemPulse : ""}`}
            onClick={handleRandomPoll}
            type="button"
          >
            <Icon name="random" /> Random Poll
          </button>

          <button
            className={`${styles.menuItem} ${pulsingItem === "mine" ? styles.menuItemPulse : ""}`}
            onClick={handleMyPolls}
            type="button"
          >
            <span className={styles.menuIcon}>★</span> My Polls
          </button>

          {/* LIKED POLLS */}
          <button
            className={`${styles.menuItem} ${activeSection === "liked" ? styles.active : ""} ${pulsingItem === "liked" ? styles.menuItemPulse : ""}`}
            onClick={() => handleSelectSection("liked")}
            type="button"
          >
            <Icon name="liked" /> Liked Polls
            {likedPolls.length > 0 && (
              <span className={styles.badge}>{likedPolls.length}</span>
            )}
          </button>

          {/* VISITED POLLS */}
          <button
            className={`${styles.menuItem} ${activeSection === "visited" ? styles.active : ""} ${pulsingItem === "visited" ? styles.menuItemPulse : ""}`}
            onClick={() => handleSelectSection("visited")}
            type="button"
          >
            <Icon name="visited" /> Visited Polls
            {visitedPolls.length > 0 && (
              <span className={styles.badge}>{visitedPolls.length}</span>
            )}
          </button>

          {/* ABOUT */}
          <button
            className={`${styles.menuItem} ${activeSection === "about" ? styles.active : ""} ${pulsingItem === "about" ? styles.menuItemPulse : ""}`}
            onClick={() => handleSelectSection("about")}
            type="button"
          >
            <Icon name="info" /> About Rogue Rank
          </button>
        </nav>

        {/* ✅ LIKED POLLS SECTION */}
        {activeSection === "liked" && (
          <section className={styles.contentSection}>
            {likedPolls.length > 0 ? (
              <div className={styles.pollList}>
                {likedPolls.map((poll) => (
                  <button
                    key={poll.id}
                    className={styles.pollItem}
                    onClick={() => handlePollClick(poll)}
                    type="button"
                  >
                    {poll.options?.[0]?.image && (
                      <img
                        src={poll.options[0].image}
                        alt={poll.title}
                        className={styles.pollThumb}
                      />
                    )}
                    <div className={styles.pollInfo}>
                      <h4 className={styles.pollTitle}>{poll.title}</h4>
                      <p className={styles.pollMeta}>
                        {poll.options?.length || 0} options · {poll.total_votes || 0} votes
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p>No liked polls yet</p>
                <span className={styles.emptyEmoji}>❤️</span>
              </div>
            )}
          </section>
        )}

        {/* ✅ VISITED POLLS SECTION */}
        {activeSection === "visited" && (
          <section className={styles.contentSection}>
            {visitedPolls.length > 0 ? (
              <div className={styles.pollList}>
                {visitedPolls.map((poll) => (
                  <button
                    key={poll.id}
                    className={styles.pollItem}
                    onClick={() => handlePollClick(poll)}
                    type="button"
                  >
                    {poll.options?.[0]?.image && (
                      <img
                        src={poll.options[0].image}
                        alt={poll.title}
                        className={styles.pollThumb}
                      />
                    )}
                    <div className={styles.pollInfo}>
                      <h4 className={styles.pollTitle}>{poll.title}</h4>
                      <p className={styles.pollMeta}>
                        {poll.options?.length || 0} options · {poll.total_votes || 0} votes
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p>No visited polls yet</p>
                <span className={styles.emptyEmoji}>🕐</span>
              </div>
            )}
          </section>
        )}

        {/* ✅ ABOUT SECTION */}
        {activeSection === "about" && (
          <section className={styles.contentSection}>
            <div className={styles.aboutPanel}>
              <div className={styles.aboutHeader}>
                <h3 className={styles.aboutTitle}>Rogue Rank</h3>
                <p className={styles.aboutTagline}>Vote. Rank. Decide.</p>
              </div>

              <p className={styles.aboutText}>
                Rogue Rank is a community-driven ranking platform where users create polls, 
                vote head-to-head, and watch rankings evolve through real-time ELO comparisons.
              </p>

              <p className={styles.aboutText}>
                User-generated content is not pre-screened and may not reflect the views of Rogue Rank.
              </p>

              <div className={styles.aboutContact}>
                <p className={styles.aboutLabel}>Issues or takedowns:</p>
                <a
                  href="mailto:roguerankofficial@gmail.com"
                  className={styles.aboutLink}
                >
                  roguerankofficial@gmail.com
                </a>
              </div>

              <div className={styles.aboutFooter}>
                <p>Built by Hansith Kurra 🚀</p>
                <p className={styles.aboutSub}>Built for Ranking</p>
              </div>
            </div>
          </section>
        )}
      </aside>
    </>
  );
}
