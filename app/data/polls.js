// app/data/polls.js
export const polls = [
  {
    id: "1",
    title: "Most Goated Anime Character (All Time)",
    creator: "Admin",
    creatorId: "admin",
    hashtags: ["anime", "goat", "characters"],
    options: [
      { id: "1-1", text: "Naruto Uzumaki", rating: 1000, votes: 0, image: null },
      { id: "1-2", text: "Satoru Gojo", rating: 1000, votes: 0, image: null },
      { id: "1-3", text: "Saitama", rating: 1000, votes: 0, image: null },
      { id: "1-4", text: "Goku", rating: 1000, votes: 0, image: null }
    ],
    createdAt: Date.now()
  },
  {
    id: "2",
    title: "Greatest Footballer (All Time)",
    creator: "Admin",
    creatorId: "admin",
    hashtags: ["football", "goat"],
    options: [
      { id: "2-1", text: "Cristiano Ronaldo", rating: 1000, votes: 0, image: null },
      { id: "2-2", text: "Lionel Messi", rating: 1000, votes: 0, image: null },
      { id: "2-3", text: "Pele", rating: 1000, votes: 0, image: null }
    ],
    createdAt: Date.now()
  }
];
