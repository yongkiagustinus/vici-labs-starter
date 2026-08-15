import { NextResponse } from "next/server";
import { env, hasDatabase } from "@/lib/env";

/**
 * Liveness / hello endpoint. Used by CI smoke checks and the deployed
 * "hello" environment to prove the pipeline is wired end-to-end.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "vici-labs-starter",
    message: "Hello from the Vici Labs studio starter 👋",
    env: process.env.NODE_ENV,
    database: hasDatabase ? "postgres" : "in-memory",
    billing: env.billing.provider,
    time: new Date().toISOString(),
  });
}
