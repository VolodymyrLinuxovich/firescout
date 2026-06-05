import { NextRequest, NextResponse } from "next/server";
import * as BB from "@/lib/integrations/butterbase";
import { getNasaGibsTileLayer, todayDateString } from "@/lib/officialData/nasaGibs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
): Promise<NextResponse> {
  const { reportId } = await params;

  const report = await BB.getReportById(reportId).catch(() => null);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const satelliteLayer = getNasaGibsTileLayer(todayDateString());

  return NextResponse.json({
    report,
    layers: {
      userLocation: {
        lat: 37.8715,
        lon: -122.2730,
        name: "Berkeley",
      },
      aqi: report.air_quality ?? null,
      fires: report.fires ?? [],
      wind: report.wind ?? null,
      plumeGeoJson: report.plume_geojson ?? null,
      satelliteLayer,
    },
  });
}
