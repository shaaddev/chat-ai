import { NextResponse } from "next/server";

// Auth is now handled via Convex and server actions
// This route is kept for backwards compatibility but returns 404

export async function POST() {
  return NextResponse.json(
    { error: "Auth has been migrated to Convex. Use server actions instead." },
    { status: 404 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Auth has been migrated to Convex. Use server actions instead." },
    { status: 404 }
  );
}
