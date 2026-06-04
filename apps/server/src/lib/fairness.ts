import { createHash, createHmac, randomBytes } from "node:crypto";
import { COLORS, type ColorName } from "../shared/colors";

/** 32 bytes of CSPRNG entropy → 64-char hex string. The secret server seed. */
export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/** SHA256(serverSeed) → hex. Published BEFORE any tap (the commitment). */
export function hashServerSeed(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

/**
 * The deterministic per-player message. Centralised so the server's compute and
 * the browser's verification recompute hash the *identical* string — this is the
 * single most important place to avoid a fairness bug (a stray space, reordered
 * field, or number/string drift).
 */
export function buildMessage(
  roundId: string,
  userId: string,
  playerPosition: number,
  nonce: number,
): string {
  return `${roundId}:${userId}:${playerPosition}:${nonce}`;
}

export interface ComputeInput {
  serverSeed: string;
  roundId: string;
  userId: string;
  playerPosition: number;
  nonce: number; // == round.roundNumber
}

export interface ComputeOutput {
  inputString: string;
  finalHash: string; // hex HMAC-SHA256
  resultColor: ColorName;
}

/**
 * Deterministic result for one player's tap.
 *   finalHash = HMAC_SHA256(key=serverSeed, msg=`${roundId}:${userId}:${pos}:${nonce}`)
 *   number    = parseInt(finalHash[0..8], 16)
 *   colour    = COLORS[number % 6]
 */
export function computeResult(input: ComputeInput): ComputeOutput {
  const inputString = buildMessage(
    input.roundId,
    input.userId,
    input.playerPosition,
    input.nonce,
  );
  const finalHash = createHmac("sha256", input.serverSeed)
    .update(inputString)
    .digest("hex");
  const number = parseInt(finalHash.substring(0, 8), 16);
  const resultColor = COLORS[number % 6];
  return { inputString, finalHash, resultColor };
}

/** Recompute and assert the stored result matches (used by /verify and tests). */
export function verifyResult(
  input: ComputeInput,
  expected: { finalHash: string; resultColor: string },
): { valid: boolean; computed: ComputeOutput; hashMatches: boolean; colorMatches: boolean } {
  const computed = computeResult(input);
  const hashMatches = computed.finalHash.toLowerCase() === expected.finalHash.toLowerCase();
  const colorMatches = computed.resultColor === expected.resultColor;
  return { valid: hashMatches && colorMatches, computed, hashMatches, colorMatches };
}

/** Verify the published commitment: SHA256(revealedSeed) === publishedHash. */
export function verifyServerSeed(serverSeed: string, serverSeedHash: string): boolean {
  return hashServerSeed(serverSeed) === serverSeedHash.toLowerCase();
}
