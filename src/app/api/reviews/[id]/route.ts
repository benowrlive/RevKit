// src/app/api/reviews/[id]/route.ts — GET + DELETE a single review.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadReviewTree } from "../route";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await db.review.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    const review = await loadReviewTree(row);
    return NextResponse.json({ review });
  } catch (e) {
    console.error("[GET /api/reviews/:id]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Cascade deletes via Prisma schema onDelete rules.
    await db.review.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/reviews/:id]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
