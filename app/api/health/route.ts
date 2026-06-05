import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/config";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    service: "FireScout",
    ...integrationStatus(),
    timestamp: new Date().toISOString(),
  });
}
