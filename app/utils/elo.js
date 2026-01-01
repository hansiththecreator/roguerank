// app/utils/elo.js
export function updateElo(winnerRating, loserRating, k = 32) {
  const expectedWinner = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + 10 ** ((winnerRating - loserRating) / 400));
  const newWinner = winnerRating + k * (1 - expectedWinner);
  const newLoser = loserRating + k * (0 - expectedLoser);
  return [newWinner, newLoser];
}
