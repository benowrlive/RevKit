// src/lib/stats/index.ts — public surface for the pure-TS stats engine.
//
// Re-exports everything from the stats submodules for convenient single-import
// usage:
//
//   import { computeEffect, pool, mantelHaenszelOR, normalCdf } from "@/lib/stats";

export * from "./normal";
export * from "./effect";
export * from "./pooling";
export * from "./dta";
