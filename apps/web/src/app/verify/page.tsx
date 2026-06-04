"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, HashChip, Input, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { verifyRound, type VerifyResult } from "@/lib/fairness";
import { COLOR_HEX, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import type { ColorName } from "@/lib/types";

interface FairnessPlayer {
  userId: string;
  username: string;
  playerPosition: number;
  resultColor: ColorName | null;
  finalHash: string | null;
  tapTime: string | null;
  inputString: string;
}
interface FairnessData {
  roundId: string;
  roundNumber: number;
  roomType: string;
  nonce: number;
  serverSeedHash: string;
  serverSeed: string;
  players: FairnessPlayer[];
}

interface Fields {
  roundId: string;
  userId: string;
  playerPosition: string;
  nonce: string;
  serverSeed: string;
  serverSeedHash: string;
  finalHash: string;
  resultColor: string;
}

const emptyFields: Fields = {
  roundId: "",
  userId: "",
  playerPosition: "",
  nonce: "",
  serverSeed: "",
  serverSeedHash: "",
  finalHash: "",
  resultColor: "",
};

function VerifyInner() {
  const search = useSearchParams();
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [lookupId, setLookupId] = useState("");
  const [data, setData] = useState<FairnessData | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Fields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const runVerify = useCallback(async (f: Fields) => {
    setError(null);
    try {
      const r = await verifyRound({
        serverSeed: f.serverSeed,
        serverSeedHash: f.serverSeedHash || undefined,
        roundId: f.roundId,
        userId: f.userId,
        playerPosition: f.playerPosition,
        nonce: f.nonce,
        finalHash: f.finalHash || undefined,
        resultColor: f.resultColor || undefined,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    }
  }, []);

  const lookup = useCallback(
    async (roundId: string) => {
      if (!roundId) return;
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const d = await api.get<FairnessData>(`/api/verify/${roundId}`);
        setData(d);
        setLookupId(roundId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Round not found or not completed");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fillFromPlayer = useCallback(
    (d: FairnessData, p: FairnessPlayer) => {
      const f: Fields = {
        roundId: d.roundId,
        userId: p.userId,
        playerPosition: String(p.playerPosition),
        nonce: String(d.nonce),
        serverSeed: d.serverSeed,
        serverSeedHash: d.serverSeedHash,
        finalHash: p.finalHash ?? "",
        resultColor: p.resultColor ?? "",
      };
      setFields(f);
      void runVerify(f);
    },
    [runVerify],
  );

  // Prefill from query params (deep link from a round summary / history).
  useEffect(() => {
    const qpRound = search.get("roundId");
    const hasManual = search.get("serverSeed");
    if (hasManual) {
      const f: Fields = {
        roundId: search.get("roundId") ?? "",
        userId: search.get("userId") ?? "",
        playerPosition: search.get("playerPosition") ?? "",
        nonce: search.get("nonce") ?? "",
        serverSeed: search.get("serverSeed") ?? "",
        serverSeedHash: search.get("serverSeedHash") ?? "",
        finalHash: search.get("finalHash") ?? "",
        resultColor: search.get("resultColor") ?? "",
      };
      setFields(f);
      void runVerify(f);
    } else if (qpRound) {
      setLookupId(qpRound);
      void lookup(qpRound);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold">Fairness verification</h1>
        <p className="text-zinc-400">
          Recompute any completed result in your own browser — nothing is trusted from the server.
        </p>
      </div>

      {/* Lookup by Round ID */}
      <Card className="space-y-4">
        <h2 className="font-semibold">Look up a round</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grow">
            <Input
              label="Round ID"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Paste a completed round id"
            />
          </div>
          <Button onClick={() => lookup(lookupId)} disabled={loading || !lookupId}>
            {loading ? "Looking up…" : "Look up"}
          </Button>
        </div>

        {data && (
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Round #{data.roundNumber}</Badge>
              <Badge>{data.roomType === "three_player" ? "3-Player" : "2-Player"}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              <HashChip label="seed hash" value={data.serverSeedHash} />
              <HashChip label="server seed" value={data.serverSeed} />
              <HashChip label="nonce" value={String(data.nonce)} />
            </div>
            <div className="space-y-2">
              {data.players.map((p) => (
                <div
                  key={p.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs font-bold">
                      {p.playerPosition}
                    </span>
                    <span className="text-sm">{p.username}</span>
                    {p.resultColor && (
                      <span
                        className="rounded px-2 py-0.5 text-xs font-bold"
                        style={{
                          backgroundColor: COLOR_HEX[p.resultColor],
                          color: COLOR_TEXT_ON[p.resultColor],
                        }}
                      >
                        {colorLabel(p.resultColor)}
                      </span>
                    )}
                  </div>
                  <Button variant="subtle" onClick={() => fillFromPlayer(data, p)} className="px-3 py-1.5">
                    Verify this
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Manual fields */}
      <Card className="space-y-4">
        <h2 className="font-semibold">Manual verification</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Round ID" value={fields.roundId} onChange={(e) => set("roundId", e.target.value)} />
          <Input label="User ID" value={fields.userId} onChange={(e) => set("userId", e.target.value)} />
          <Input
            label="Player position"
            value={fields.playerPosition}
            onChange={(e) => set("playerPosition", e.target.value)}
          />
          <Input label="Nonce" value={fields.nonce} onChange={(e) => set("nonce", e.target.value)} />
          <Input
            label="Server seed"
            value={fields.serverSeed}
            onChange={(e) => set("serverSeed", e.target.value)}
          />
          <Input
            label="Server seed hash"
            value={fields.serverSeedHash}
            onChange={(e) => set("serverSeedHash", e.target.value)}
          />
          <Input
            label="Final hash (expected)"
            value={fields.finalHash}
            onChange={(e) => set("finalHash", e.target.value)}
          />
          <Input
            label="Result colour (expected)"
            value={fields.resultColor}
            onChange={(e) => set("resultColor", e.target.value)}
          />
        </div>
        <Button onClick={() => runVerify(fields)} disabled={!fields.serverSeed || !fields.roundId}>
          Verify result
        </Button>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        {result && (
          <div
            className={`space-y-3 rounded-xl border p-4 ${
              result.verified
                ? "border-emerald-400/40 bg-emerald-500/10"
                : "border-rose-400/40 bg-rose-500/10"
            }`}
          >
            <p className={`text-lg font-bold ${result.verified ? "text-emerald-300" : "text-rose-300"}`}>
              {result.verified ? "✓ Result verified successfully" : "✗ Does not verify"}
            </p>
            <div className="grid gap-1 text-sm text-zinc-300">
              <CheckRow label="Seed hash matches" value={result.seedHashOk} />
              <CheckRow label="Final hash matches" value={result.finalHashOk} />
              <CheckRow label="Colour matches" value={result.colorOk} />
            </div>
            <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
              <HashChip label="computed hash" value={result.computedHash} />
              <HashChip label="computed colour" value={result.computedColor} />
              <HashChip label="input string" value={result.inputString} />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function CheckRow({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span
        className={
          value === null ? "text-zinc-500" : value ? "text-emerald-400" : "text-rose-400"
        }
      >
        {value === null ? "not provided" : value ? "yes" : "no"}
      </span>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 py-10 text-zinc-400">
          <Spinner /> Loading…
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
