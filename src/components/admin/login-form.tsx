"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("admin-credentials", {
      username,
      password,
      redirect: false,
      callbackUrl: "/admin",
    });

    if (!result || result.error) {
      setError("Invalid credentials or too many recent attempts. Please retry in a few minutes if the password is correct.");
      setLoading(false);
      return;
    }

    window.location.href = "/admin";
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-3xl border border-fuchsia-300/20 bg-slate-950/75 p-8 text-slate-100 shadow-[0_25px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl"
    >
      <p className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
        Rubix Signal Admin
      </p>
      <h1 className="text-2xl font-bold text-white">Admin Login</h1>
      <p className="text-sm text-slate-300">Sign in to run ingestion jobs, inspect failures, and monitor the rewrite pipeline.</p>

      <label className="block space-y-2 text-sm">
        <span className="font-semibold text-slate-200">Username</span>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/95 px-3 py-2 text-slate-900"
          required
        />
      </label>

      <label className="block space-y-2 text-sm">
        <span className="font-semibold text-slate-200">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/95 px-3 py-2 text-slate-900"
          required
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
