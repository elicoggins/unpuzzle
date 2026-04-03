import { NextRequest, NextResponse } from "next/server";

// Persist attempt results (placeholder until DB is connected).
// Scoring is done entirely client-side via Stockfish WASM.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { positionId, move, centipawnLoss, timeSpentMs } = body;

  if (!positionId || !move || centipawnLoss === undefined) {
    return NextResponse.json(
      { error: "positionId, move, and centipawnLoss are required" },
      { status: 400 }
    );
  }

  // TODO: persist to DB when connected
  return NextResponse.json({
    status: "saved",
    positionId,
    move,
    centipawnLoss,
    timeSpentMs,
  });
}
