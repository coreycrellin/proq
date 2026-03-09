import { NextRequest, NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import path from "path";

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

  // Detect if we're serving over HTTPS by checking for the cert files
  // (Next.js --experimental-https sets up HTTPS transparently)
  const certsDir = path.join(process.cwd(), "certs");
  const hasHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.url.startsWith("https") ||
    (fs.existsSync(path.join(certsDir, "cert.pem")) &&
      fs.existsSync(path.join(certsDir, "key.pem")) &&
      // Check if the cert covers this IP (means dev:mobile was used)
      (() => {
        try {
          const { execSync } = require("child_process");
          const certText = execSync(
            `openssl x509 -in "${path.join(certsDir, "cert.pem")}" -text -noout 2>/dev/null`,
            { encoding: "utf8" }
          );
          return certText.includes(`IP Address:${ip}`);
        } catch {
          return false;
        }
      })());

  const protocol = hasHttps ? "https" : "http";

  return NextResponse.json({
    ip,
    port: Number(port),
    protocol,
    https: hasHttps,
    url: `${protocol}://${ip}:${port}/mobile`,
  });
}
