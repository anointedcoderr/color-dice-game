"use client";

import Link from "next/link";
import { useState } from "react";
import { Dice, type DicePhase } from "@/components/Dice";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { COLORS, COLOR_HEX } from "@/lib/colors";

export default function HomePage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<DicePhase>("neutral");

  // Let visitors play with the dice on the homepage (not a real round — purely
  // a teaser; real results only ever come from the server in a room).
  const demoSpin = () => {
    setPhase("spinning");
    setTimeout(() => setPhase("neutral"), 1200);
  };

  return (
    <div className="space-y-16 py-8">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
            🎲 Provably fair · No numbers · Pure colour
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Tap the dice.
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent">
              Reveal your colour.
            </span>
          </h1>
          <p className="max-w-md text-zinc-400">
            A real-time multiplayer dice game with six colours — Red, Black, Blue, Green, Yellow,
            White. The dice stays neutral until you tap; every result is generated on the server and
            independently verifiable.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={user ? "/lobby" : "/login"}>
              <Button className="px-6 py-3 text-base">Play now →</Button>
            </Link>
            <Link href="/verify">
              <Button variant="ghost" className="px-6 py-3 text-base">
                Verify a result
              </Button>
            </Link>
          </div>
          <div className="flex gap-1.5 pt-2">
            {COLORS.map((c) => (
              <span
                key={c}
                className="h-3 w-8 rounded-full"
                style={{ backgroundColor: COLOR_HEX[c], boxShadow: `0 0 12px ${COLOR_HEX[c]}66` }}
              />
            ))}
          </div>
        </div>

        <Card className="grid place-items-center gap-4 py-10">
          <Dice phase={phase} result={null} />
          <Button variant="subtle" onClick={demoSpin}>
            Give it a spin
          </Button>
          <p className="text-center text-xs text-zinc-500">Demo only — real rounds happen in a room.</p>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Provably fair",
            body: "SHA-256 commitment before the round, HMAC-SHA256 per tap, server seed revealed after. Verify it yourself.",
          },
          {
            title: "2 & 3 player rooms",
            body: "Matchmaking starts a round the moment the room fills. One tap each. Same colour can repeat.",
          },
          {
            title: "Real-time",
            body: "Socket.io keeps everyone in sync — joins, taps, reveals and completion, live.",
          },
        ].map((f) => (
          <Card key={f.title} className="space-y-2">
            <h3 className="font-bold text-zinc-100">{f.title}</h3>
            <p className="text-sm text-zinc-400">{f.body}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
