import { NextResponse } from "next/server";
import { getRandomPosition } from "@/lib/sample-positions";

export async function GET() {
  const position = getRandomPosition();
  return NextResponse.json(position);
}
