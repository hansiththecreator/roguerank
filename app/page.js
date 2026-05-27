"use client";

import { useState } from "react";
import MultiPoll from "./components/MultiPoll";
import Header from "./components/Header";

export default function Home() {
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [polls, setPolls] = useState([]);
  const [showCreator, setShowCreator] = useState(false);

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <Header
          onCreateClick={() => setShowCreator(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          polls={polls}
          setSelectedPoll={setSelectedPoll}
        />

        <MultiPoll
          selectedPoll={selectedPoll}
          setSelectedPoll={setSelectedPoll}
          searchQuery={searchQuery}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          polls={polls}
          setPolls={setPolls}
          showCreator={showCreator}
          setShowCreator={setShowCreator}
        />
      </div>
    </main>
  );
}
