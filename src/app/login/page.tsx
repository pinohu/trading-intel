"use client";

import { LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    if (!response.ok) {
      setError("That access code did not work.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090b0f] px-4 text-slate-100">
      <form onSubmit={login} className="w-full max-w-sm rounded-lg border border-white/10 bg-[#111720] p-5 shadow-2xl shadow-black/30">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">Trading Intelligence</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Private research cockpit. Enter your access code to continue.
        </p>
        <label className="mt-5 block text-sm text-slate-300">
          Access code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoFocus
            type="password"
            className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-base text-white outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </label>
        {error && <div className="mt-3 rounded-md border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</div>}
        <button
          disabled={loading}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {loading ? "Checking" : "Enter"}
        </button>
        <div className="mt-4 flex gap-2 rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          Research and paper trading are available. Live broker execution requires the configured manual acknowledgement.
        </div>
      </form>
    </main>
  );
}
