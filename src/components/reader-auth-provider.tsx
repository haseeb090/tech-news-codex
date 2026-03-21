"use client";

import { createContext, FormEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type ReaderAuthMode = "signin" | "signup";

interface OpenReaderAuthOptions {
  mode?: ReaderAuthMode;
  onSuccess?: () => void;
}

interface ReaderAuthContextValue {
  openReaderAuth: (options?: OpenReaderAuthOptions) => void;
  closeReaderAuth: () => void;
  isAuthenticated: boolean;
}

const ReaderAuthContext = createContext<ReaderAuthContextValue | null>(null);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ReaderAuthModal({
  open,
  mode,
  signupEnabled,
  onModeChange,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  mode: ReaderAuthMode;
  signupEnabled: boolean;
  onModeChange: (mode: ReaderAuthMode) => void;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  const titleId = "reader-auth-title";
  const descriptionId = "reader-auth-description";

  if (!open) return null;

  const handleSignIn = async (userEmail: string, userPassword: string) => {
    const result = await signIn("reader-credentials", {
      email: userEmail,
      password: userPassword,
      redirect: false,
    });

    if (!result || result.error) {
      throw new Error("We couldn't sign you in with those credentials.");
    }

    router.refresh();
    onAuthenticated();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!emailPattern.test(normalizedEmail)) {
        throw new Error("Enter a valid email address.");
      }

      if (password.length < 8) {
        throw new Error("Use at least 8 characters for your password.");
      }

      if (mode === "signup") {
        if (!signupEnabled) {
          throw new Error("New signups are disabled right now.");
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const response = await fetch("/api/public/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            origin: "feed_modal",
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to create your account.");
        }
      }

      await handleSignIn(normalizedEmail, password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
        className="glass-orbit relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-fuchsia-300/20 bg-slate-950/90 p-8 text-slate-100 shadow-[0_40px_140px_rgba(15,23,42,0.55)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reader access dialog"
          className="absolute right-5 top-5 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 hover:border-cyan-300 hover:text-cyan-200"
        >
          Close
        </button>

        <div className="space-y-4">
          <p className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Reader Access
          </p>
          <h2 id={titleId} className="text-3xl font-bold text-white">
            {mode === "signup" ? "Unlock the full briefings" : "Welcome back"}
          </h2>
          <p id={descriptionId} className="text-sm leading-6 text-slate-300">
            {mode === "signup"
              ? "Create a free account to open article pages, reveal the full briefing archive, and keep coming back for the latest tech coverage."
              : "Sign in to continue exploring the full briefing archive and open article details."}
          </p>
        </div>

        <div className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/5 p-1 text-sm">
          <button
            type="button"
            onClick={() => onModeChange("signup")}
            className={`rounded-xl px-4 py-2 font-semibold ${mode === "signup" ? "bg-white text-slate-900" : "text-slate-300"}`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => onModeChange("signin")}
            className={`rounded-xl px-4 py-2 font-semibold ${mode === "signin" ? "bg-white text-slate-900" : "text-slate-300"}`}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block space-y-2 text-sm">
            <span className="font-semibold text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-slate-900"
              placeholder="you@example.com"
              autoFocus
              required
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-semibold text-slate-200">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-slate-900"
              placeholder="At least 8 characters"
              required
            />
          </label>

          {mode === "signup" ? (
            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-slate-200">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-slate-900"
                required
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Working..." : mode === "signup" ? "Create free account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ReaderAuthProvider({
  children,
  signupEnabled,
}: {
  children: React.ReactNode;
  signupEnabled: boolean;
}) {
  const { data: session } = useSession();
  const pendingSuccessRef = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ReaderAuthMode>("signup");

  const isAuthenticated = session?.user?.role === "reader" || session?.user?.role === "admin";

  const openReaderAuth = useCallback((options?: OpenReaderAuthOptions) => {
    if (isAuthenticated) {
      options?.onSuccess?.();
      return;
    }

    pendingSuccessRef.current = options?.onSuccess || null;
    setMode(options?.mode || "signup");
    setOpen(true);
  }, [isAuthenticated]);

  const closeReaderAuth = useCallback(() => {
    setOpen(false);
    pendingSuccessRef.current = null;
  }, []);

  const onAuthenticated = useCallback(() => {
    setOpen(false);
    const action = pendingSuccessRef.current;
    pendingSuccessRef.current = null;
    action?.();
  }, []);

  const value = useMemo(
    () => ({
      openReaderAuth,
      closeReaderAuth,
      isAuthenticated,
    }),
    [closeReaderAuth, isAuthenticated, openReaderAuth],
  );

  return (
    <ReaderAuthContext.Provider value={value}>
      {children}
      <ReaderAuthModal
        open={open}
        mode={mode}
        signupEnabled={signupEnabled}
        onModeChange={setMode}
        onClose={closeReaderAuth}
        onAuthenticated={onAuthenticated}
      />
    </ReaderAuthContext.Provider>
  );
}

export const useReaderAuth = (): ReaderAuthContextValue => {
  const context = useContext(ReaderAuthContext);
  if (!context) {
    throw new Error("useReaderAuth must be used within ReaderAuthProvider");
  }
  return context;
};
