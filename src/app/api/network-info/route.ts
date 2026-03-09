import { NextRequest, NextResponse } from "next/server";
import os from "os";

export async function GET(request: NextRequest) {
  const interfaces = os.networkInterfaces();
  let ip = "localhost";

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ip = iface.address;
        break;
      }
    }
    if (ip !== "localhost") break;
  }

  const port = process.env.PORT || 1337;

  // Detect HTTPS from the actual request — only true when server is running with --experimental-https
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:";

  const protocol = isHttps ? "https" : "http";

  return NextResponse.json({
    ip,
    port: Number(port),
    protocol,
    https: isHttps,
    url: `${protocol}://${ip}:${port}/mobile`,
  });
}
