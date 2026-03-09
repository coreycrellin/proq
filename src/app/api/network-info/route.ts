import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
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
  return NextResponse.json({
    ip,
    port: Number(port),
    url: `http://${ip}:${port}/mobile`,
  });
}
