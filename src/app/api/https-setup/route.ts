import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const CERTS_DIR = path.join(process.cwd(), "certs");
const CERT_PATH = path.join(CERTS_DIR, "cert.pem");
const KEY_PATH = path.join(CERTS_DIR, "key.pem");
const GEN_SCRIPT = path.join(process.cwd(), "scripts", "gen-cert.js");

/** GET — check status or download cert */
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  // Download the certificate file for iOS installation
  if (action === "download-cert") {
    if (!fs.existsSync(CERT_PATH)) {
      return NextResponse.json({ error: "No certificate generated yet" }, { status: 404 });
    }
    const certData = fs.readFileSync(CERT_PATH);
    return new NextResponse(certData, {
      headers: {
        "Content-Type": "application/x-pem-file",
        "Content-Disposition": 'attachment; filename="proq-cert.pem"',
      },
    });
  }

  // Check current HTTPS status
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:";
  const certsExist = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

  return NextResponse.json({
    httpsActive: isHttps,
    certsExist,
    needsRestart: certsExist && !isHttps,
  });
}

/** POST — generate certificates */
export async function POST() {
  try {
    // Run the gen-cert script
    execSync(`node "${GEN_SCRIPT}"`, {
      cwd: process.cwd(),
      stdio: "pipe",
      encoding: "utf8",
    });

    return NextResponse.json({
      success: true,
      certsExist: true,
      message: "Certificates generated. Restart with: npm run dev:mobile",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate certs: ${msg}` }, { status: 500 });
  }
}
