import { NextResponse } from 'next/server';
import { updateElo } from '@/lib/elo';

export async function POST(request, { params }) {
  const { optionA, optionB, winner } = await request.json();
  
  const newRatings = {};
  const [newW, newL] = updateElo(optionA.rating, optionB.rating);
  
  if (winner.id === optionA.id) {
    newRatings[optionA.id] = newW;
    newRatings[optionB.id] = newL;
  } else {
    newRatings[optionA.id] = newL;
    newRatings[optionB.id] = newW;
  }

  return NextResponse.json({ success: true, newRatings });
}

export async function DELETE(request, { params }) {
  // Here you’d delete poll from DB if connected.
  // For now, mock success.
  return NextResponse.json({ success: true, message: "Poll deleted." });
}
