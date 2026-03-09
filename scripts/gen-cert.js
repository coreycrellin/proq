#!/usr/bin/env node
/**
 * Generate a self-signed certificate with the local network IP as a SAN.
 * This allows mobile devices on the same WiFi to connect via HTTPS,
 * which is required for Web Speech API / getUserMedia.
 */

const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Find local IPv4 address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const ip = getLocalIP();
const certsDir = path.join(__dirname, '..', 'certs');

// Create certs directory
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');

// Check if existing cert already covers this IP
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  try {
    const certText = execSync(`openssl x509 -in "${certPath}" -text -noout 2>/dev/null`, { encoding: 'utf8' });
    if (certText.includes(`IP Address:${ip}`)) {
      console.log(`Certificate already covers ${ip}, skipping generation.`);
      process.exit(0);
    }
  } catch {
    // Cert is invalid or unreadable, regenerate
  }
}

console.log(`Generating self-signed certificate for ${ip}...`);

// Generate cert with SAN including the local IP and localhost
const opensslConf = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = proq-mobile

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ${ip}
`;

const confPath = path.join(certsDir, 'openssl.cnf');
fs.writeFileSync(confPath, opensslConf);

try {
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" ` +
    `-days 365 -nodes -config "${confPath}" 2>/dev/null`,
    { stdio: 'pipe' }
  );
  // Clean up temp config
  fs.unlinkSync(confPath);
  console.log(`Certificate generated for ${ip}`);
  console.log(`  Key:  ${keyPath}`);
  console.log(`  Cert: ${certPath}`);
} catch (err) {
  console.error('Failed to generate certificate. Make sure openssl is installed.');
  process.exit(1);
}
