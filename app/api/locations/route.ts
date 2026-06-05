import { NextRequest, NextResponse } from "next/server";
import * as BB from "@/lib/integrations/butterbase";
import { geocode } from "@/lib/geocode";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { ownerType, ownerId, name, lat, lon, radiusKm } = body;

  if (!ownerType || !ownerId || (!name && (lat === undefined || lon === undefined))) {
    return NextResponse.json({ error: "ownerType, ownerId, and (name or lat/lon) required" }, { status: 400 });
  }

  let resolvedLat = lat;
  let resolvedLon = lon;
  let resolvedName = name;

  if (name && (lat === undefined || lon === undefined)) {
    const geo = await geocode(name);
    if (!geo) return NextResponse.json({ error: `Could not geocode "${name}"` }, { status: 422 });
    resolvedLat = geo.lat;
    resolvedLon = geo.lon;
    resolvedName = geo.name;
  }

  const saved = await BB.saveLocation({
    ownerType,
    ownerId,
    name: resolvedName,
    lat: resolvedLat,
    lon: resolvedLon,
    radiusKm: radiusKm ?? 150,
  });

  return NextResponse.json(saved);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const ownerType = searchParams.get("ownerType") ?? "user";
  const ownerId = searchParams.get("ownerId") ?? "";

  if (!ownerId) return NextResponse.json({ error: "ownerId required" }, { status: 400 });

  const locations = await BB.getActiveLocations(ownerType, ownerId);
  return NextResponse.json(locations);
}
