Rogue Rank — quick start
1. npm install
2. npm run dev
3. Open http://localhost:3000

Files:
- app/components/MultiPoll.js : main feed + poll selection
- app/components/PairPoll.js  : pairwise swipe/vote + ELO
- app/components/PollCreator.js : create polls
- app/data/polls.js : seed data
- app/utils/elo.js : ELO helper

Notes:
- Data is saved to localStorage key `rankr_polls`.
- Guest account stored in `rankr_user`.
- This is an offline-first MVP; later swap localStorage with a backend.
