function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val && process.env.USE_MOCK_DATA !== "true") {
    console.warn(`[FireScout] Missing env var: ${name} — set USE_MOCK_DATA=true to use mock data`);
  }
  return val ?? "";
}

export const config = {
  useMockData: process.env.USE_MOCK_DATA === "true",
  airnowApiKey: process.env.AIRNOW_API_KEY ?? "",
  nasaFirmsMapKey: process.env.NASA_FIRMS_MAP_KEY ?? "",
  butterbaseApiKey: process.env.BUTTERBASE_API_KEY ?? "",
  butterbaseProjectId: process.env.BUTTERBASE_PROJECT_ID ?? "",
  xtraceApiKey: process.env.XTRACE_API_KEY ?? "",
  xtraceAppId: process.env.XTRACE_APP_ID ?? "firescout",
  photonApiKey: process.env.PHOTON_API_KEY ?? "",
  photonProjectId: process.env.PHOTON_PROJECT_ID ?? "",
  photonProjectSecret: process.env.PHOTON_PROJECT_SECRET ?? "",
  photonWebhookSecret: process.env.PHOTON_WEBHOOK_SECRET ?? "",
  imessageNumber: process.env.IMESSAGE_NUMBER ?? process.env.WHATSAPP_NUMBER ?? "+13417669597",
  whatsappNumber: process.env.WHATSAPP_NUMBER ?? "",
  whatsappApiKey: process.env.WHATSAPP_APIKEY ?? "",
  loopMessageApiKey: process.env.LOOPMESSAGE_API_KEY ?? "",
  nwsUserAgent: process.env.NWS_USER_AGENT ?? "FireScout Hackathon [contact@example.com]",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  mapboxToken: process.env.MAPBOX_TOKEN ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
} as const;

export function integrationStatus() {
  return {
    butterbase: config.butterbaseApiKey ? "ok" : "missing",
    xtrace: config.xtraceApiKey ? "ok" : "missing",
    photon: config.photonApiKey ? "ok" : "missing",
    rocketride: "fallback",
    airnow: config.airnowApiKey ? "ok" : "missing",
    firms: config.nasaFirmsMapKey ? "ok" : "missing",
    nws: "ok",
    mockMode: config.useMockData,
  };
}
