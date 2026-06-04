import { COLORS } from "./colors";
import type { ColorName } from "./types";

// Browser-side recompute using the Web Crypto API. MUST stay byte-identical to
// the backend (apps/server/src/lib/fairness.ts): same message format, lowercase
// hex, parseInt(hash[0..8],16) % 6.

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return toHex(signature);
}

export interface VerifyInput {
  serverSeed: string;
  serverSeedHash?: string;
  roundId: string;
  userId: string;
  playerPosition: number | string;
  nonce: number | string;
  finalHash?: string;
  resultColor?: string;
}

export interface VerifyResult {
  inputString: string;
  computedHash: string;
  computedColor: ColorName;
  computedServerSeedHash: string;
  seedHashOk: boolean | null;
  finalHashOk: boolean | null;
  colorOk: boolean | null;
  verified: boolean;
}

export async function verifyRound(input: VerifyInput): Promise<VerifyResult> {
  const inputString = `${input.roundId}:${input.userId}:${input.playerPosition}:${input.nonce}`;
  const computedHash = await hmacSha256Hex(input.serverSeed, inputString);
  const number = parseInt(computedHash.substring(0, 8), 16);
  const computedColor = COLORS[number % 6];
  const computedServerSeedHash = await sha256Hex(input.serverSeed);

  const seedHashOk = input.serverSeedHash
    ? computedServerSeedHash === input.serverSeedHash.toLowerCase()
    : null;
  const finalHashOk = input.finalHash
    ? computedHash === input.finalHash.toLowerCase()
    : null;
  const colorOk = input.resultColor ? computedColor === input.resultColor : null;

  const verified = (seedHashOk ?? true) && (finalHashOk ?? true) && (colorOk ?? true);

  return {
    inputString,
    computedHash,
    computedColor,
    computedServerSeedHash,
    seedHashOk,
    finalHashOk,
    colorOk,
    verified,
  };
}
