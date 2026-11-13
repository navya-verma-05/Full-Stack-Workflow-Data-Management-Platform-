import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck2,
  Lock,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Webhook,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api/http";

const PIPELINE_STEPS = [
  {
    label: "Source",
    sub: "Web, CRM, Partner",
    icon: Webhook,
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
  },
  {
    label: "Verify",
    sub: "HMAC + Replay guard",
    icon: ShieldCheck,
    tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30",
  },
  {
    label: "Validate",
    sub: "Per-source schema",
    icon: CheckCircle2,
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
  },
  {
    label: "Queue",
    sub: "Backoff & DLQ",
    icon: RefreshCw,
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  },
  {
    label: "Records",
    sub: "Normalized output",
    icon: FileCheck2,
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Sign in · Workflow Platform";
  }, []);

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(email.trim(), password);
      toast.success("Welcome back", `${signedIn.name} (${signedIn.role})`);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to reach authentication service");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        className="absolute right-4 top-4 z-10 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-12 lg:grid-cols-12">
        {/* Product pitch + pipeline illustration */}
        <section className="space-y-8 lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Webhook Ingestion & Reliability Control Plane
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Every inbound webhook verified, normalized, and observable.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Workflow Platform ingests signed payloads across web forms, CRMs,
              and partner feeds, enforces per-source Zod schemas and idempotency
              keys, retries transient failures with exponential backoff, and
              gives your team full audit telemetry.
            </p>
          </div>

          {/* Pipeline flow diagram */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Event Processing Pipeline
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {PIPELINE_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.label}
                    className="flex flex-1 items-center gap-2"
                  >
                    <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950/70">
                      <div
                        className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg border ${step.tone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        {step.sub}
                      </p>
                    </div>
                    {index < PIPELINE_STEPS.length - 1 && (
                      <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3.5 dark:border-slate-800/80 dark:bg-slate-900/40">
              <p className="font-semibold text-slate-900 dark:text-slate-200">
                Constant-Time HMAC
              </p>
              <p className="mt-1">
                Raw-body SHA-256 verification and replay-window enforcement.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3.5 dark:border-slate-800/80 dark:bg-slate-900/40">
              <p className="font-semibold text-slate-900 dark:text-slate-200">
                Atomic Retry Worker
              </p>
              <p className="mt-1">
                Exponential backoff scheduling with automatic dead-letter
                replay.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3.5 dark:border-slate-800/80 dark:bg-slate-900/40">
              <p className="font-semibold text-slate-900 dark:text-slate-200">
                Strict RBAC
              </p>
              <p className="mt-1">
                In-memory access tokens, httpOnly refresh cookies, and audit
                trails.
              </p>
            </div>
          </div>
        </section>

        {/* Sign-in card */}
        <section className="lg:col-span-5">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900/85">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Workflow Platform
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sign in to the operations dashboard
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-rose-500/40 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Lock className="h-4 w-4" />
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="mt-5 text-center text-[11px] text-slate-500 dark:text-slate-400">
              Access tokens are kept strictly in memory with httpOnly refresh
              cookies.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
