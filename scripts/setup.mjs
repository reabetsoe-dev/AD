import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { database } from "./database.mjs";
mkdirSync(".demo", { recursive: true });
mkdirSync("public", { recursive: true });
mkdirSync("private-storage/audio", { recursive: true });
if (!existsSync(".env")) {
  const password = `Demo-${randomBytes(9).toString("hex")}`;
  writeFileSync(
    ".env",
    `DATABASE_URL="postgresql://ad_demo@127.0.0.1:55432/ad_demo"\nAUTH_SECRET="${randomBytes(32).toString("hex")}"\nAPP_URL="http://127.0.0.1:3000"\nDEMO_MODE="true"\nDEMO_SEED_PASSWORD="${password}"\nPAYMENT_PROVIDER="mock-mpesa"\nPAYMENT_CALLBACK_SECRET="${randomBytes(32).toString("hex")}"\nSTORE_CURRENCY="LSL"\nSTORAGE_PROVIDER="local"\nSTORAGE_ROOT="private-storage"\n`,
  );
  writeFileSync(
    ".demo/accounts.txt",
    `FICTIONAL LOCAL DEMO ACCOUNTS\nPassword: ${password}\n\nsuper@demo.invalid\nadmin@demo.invalid\nmedia@demo.invalid\nfinance@demo.invalid\neditor@demo.invalid\nsecretary-a@demo.invalid\nsecretary-b@demo.invalid\n`,
  );
}
const logo =
  "C:/Users/reabe/Downloads/ChatGPT Image Oct 1, 2026, 11_01_35 AM.png";
if (!existsSync("public/ad-logo.png") && existsSync(logo))
  copyFileSync(logo, "public/ad-logo.png");
// Synthesised demonstration audio, never described as official AD music.
function wav(seconds, shift) {
  const rate = 22050;
  const size = rate * seconds * 2;
  const buffer = Buffer.alloc(44 + size);
  buffer.write("RIFF");
  buffer.writeUInt32LE(36 + size, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(size, 40);
  const notes = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 261.63];
  for (let i = 0; i < rate * seconds; i++) {
    const t = i / rate,
      beat = t % 0.5,
      frequency = notes[Math.floor(t * 2) % notes.length] * shift;
    const envelope =
      Math.exp(-beat * 7) * Math.min(t * 3, 1) * Math.min((seconds - t) * 3, 1);
    const tone =
      Math.sin(2 * Math.PI * frequency * t) +
      0.35 * Math.sin(2 * Math.PI * frequency * 0.5 * t);
    buffer.writeInt16LE(Math.round(tone * envelope * 4500), 44 + i * 2);
  }
  return buffer;
}
for (let i = 1; i <= 3; i++) {
  writeFileSync(
    `private-storage/audio/demo-${i}.wav`,
    wav(45, 1 + (i - 1) * 0.12),
  );
  writeFileSync(`public/preview-${i}.wav`, wav(12, 1 + (i - 1) * 0.12));
}
database();
console.log("Local setup ready. Demo credentials are in .demo/accounts.txt.");
