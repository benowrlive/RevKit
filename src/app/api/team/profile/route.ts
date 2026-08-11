// src/app/api/team/profile/route.ts — GET / PUT the singleton user profile.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_PROFILE, type UserProfile } from "@/lib/team/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = await db.userProfile.findUnique({ where: { id: "singleton" } });
    if (!row) {
      // Create the singleton row on first access with defaults.
      const created = await db.userProfile.create({
        data: {
          id: "singleton",
          density: DEFAULT_PROFILE.density,
          fontScale: DEFAULT_PROFILE.fontScale,
          reduceMotion: DEFAULT_PROFILE.reduceMotion,
          tooltipsEnabled: DEFAULT_PROFILE.tooltipsEnabled,
          tooltipsDensity: DEFAULT_PROFILE.tooltipsDensity,
          defaultEffectMeasure: DEFAULT_PROFILE.defaultEffectMeasure,
          defaultMethod: DEFAULT_PROFILE.defaultMethod,
          defaultModel: DEFAULT_PROFILE.defaultModel,
          defaultConfidence: DEFAULT_PROFILE.defaultConfidence,
          decimalPlaces: DEFAULT_PROFILE.decimalPlaces,
          autoBackupMinutes: DEFAULT_PROFILE.autoBackupMinutes,
          maxRecentFiles: DEFAULT_PROFILE.maxRecentFiles,
        },
      });
      return NextResponse.json({ profile: rowToProfile(created) });
    }
    return NextResponse.json({ profile: rowToProfile(row) });
  } catch (e) {
    console.error("[GET /api/team/profile]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as UserProfile;
    // Upsert the singleton row.
    const updated = await db.userProfile.upsert({
      where: { id: "singleton" },
      update: {
        density: body.density,
        fontScale: body.fontScale,
        reduceMotion: body.reduceMotion,
        tooltipsEnabled: body.tooltipsEnabled,
        tooltipsDensity: body.tooltipsDensity,
        defaultEffectMeasure: body.defaultEffectMeasure,
        defaultMethod: body.defaultMethod,
        defaultModel: body.defaultModel,
        defaultConfidence: body.defaultConfidence,
        decimalPlaces: body.decimalPlaces,
        autoBackupMinutes: body.autoBackupMinutes,
        maxRecentFiles: body.maxRecentFiles,
      },
      create: {
        id: "singleton",
        density: body.density,
        fontScale: body.fontScale,
        reduceMotion: body.reduceMotion,
        tooltipsEnabled: body.tooltipsEnabled,
        tooltipsDensity: body.tooltipsDensity,
        defaultEffectMeasure: body.defaultEffectMeasure,
        defaultMethod: body.defaultMethod,
        defaultModel: body.defaultModel,
        defaultConfidence: body.defaultConfidence,
        decimalPlaces: body.decimalPlaces,
        autoBackupMinutes: body.autoBackupMinutes,
        maxRecentFiles: body.maxRecentFiles,
      },
    });
    return NextResponse.json({ profile: rowToProfile(updated) });
  } catch (e) {
    console.error("[PUT /api/team/profile]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

function rowToProfile(row: {
  density: string;
  fontScale: string;
  reduceMotion: boolean;
  tooltipsEnabled: boolean;
  tooltipsDensity: string;
  defaultEffectMeasure: string;
  defaultMethod: string;
  defaultModel: string;
  defaultConfidence: number;
  decimalPlaces: number;
  autoBackupMinutes: number;
  maxRecentFiles: number;
}): UserProfile {
  return {
    density: row.density as UserProfile["density"],
    fontScale: row.fontScale as UserProfile["fontScale"],
    reduceMotion: row.reduceMotion,
    tooltipsEnabled: row.tooltipsEnabled,
    tooltipsDensity: row.tooltipsDensity as UserProfile["tooltipsDensity"],
    defaultEffectMeasure: row.defaultEffectMeasure,
    defaultMethod: row.defaultMethod,
    defaultModel: row.defaultModel as "fixed" | "random",
    defaultConfidence: row.defaultConfidence,
    decimalPlaces: row.decimalPlaces,
    autoBackupMinutes: row.autoBackupMinutes,
    maxRecentFiles: row.maxRecentFiles,
  };
}
