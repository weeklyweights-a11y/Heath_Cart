import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: { message: "Not implemented" } },
    { status: 501 },
  );
}
