// src/app/api/team/route.ts — CRUD for team members (local, no auth).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { TeamRole } from "@/lib/team/store";

export const dynamic = "force-dynamic";

// GET /api/team — list all team members
export async function GET() {
  try {
    const rows = await db.teamMember.findMany({ orderBy: { createdAt: "asc" } });
    const members = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role as TeamRole,
      initials: r.initials,
      color: r.color,
      isCurrentUser: r.isCurrentUser,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
    return NextResponse.json({ members });
  } catch (e) {
    console.error("[GET /api/team]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

// POST /api/team — create a team member
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name: string;
      email?: string | null;
      role: TeamRole;
      initials: string;
      color: string;
      isCurrentUser: boolean;
    };
    // If isCurrentUser, flip all others off first.
    if (body.isCurrentUser) {
      const existing = await db.teamMember.findMany({ where: { isCurrentUser: true } });
      for (const m of existing) {
        await db.teamMember.update({ where: { id: m.id }, data: { isCurrentUser: false } });
      }
    }
    const created = await db.teamMember.create({
      data: {
        name: body.name,
        email: body.email ?? null,
        role: body.role,
        initials: body.initials,
        color: body.color,
        isCurrentUser: body.isCurrentUser,
      },
    });
    return NextResponse.json({
      member: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role as TeamRole,
        initials: created.initials,
        color: created.color,
        isCurrentUser: created.isCurrentUser,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[POST /api/team]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

// PUT /api/team — update a team member (or set current user)
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { id: string; patch: Partial<import("@/lib/team/store").TeamMember> };
    if (body.patch.isCurrentUser) {
      const existing = await db.teamMember.findMany({ where: { isCurrentUser: true } });
      for (const m of existing) {
        if (m.id !== body.id) {
          await db.teamMember.update({ where: { id: m.id }, data: { isCurrentUser: false } });
        }
      }
    }
    const updated = await db.teamMember.update({
      where: { id: body.id },
      data: {
        name: body.patch.name,
        email: body.patch.email,
        role: body.patch.role,
        initials: body.patch.initials,
        color: body.patch.color,
        isCurrentUser: body.patch.isCurrentUser,
      },
    });
    return NextResponse.json({ member: updated });
  } catch (e) {
    console.error("[PUT /api/team]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

// DELETE /api/team?id=<id>
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await db.teamMember.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/team]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
