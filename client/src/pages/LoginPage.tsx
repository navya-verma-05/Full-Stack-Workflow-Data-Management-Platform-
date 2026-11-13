import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
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
  },
  {
    label: "Verify",
    sub: "HMAC + Replay guard",
    icon: ShieldCheck,
  },
  {
    label: "Validate",
    sub: "Per-source schema",
    icon: CheckCircle2,
  },
  {
    label: "Queue",
    sub: "Backoff & DLQ",
    icon: RefreshCw,
  },
  {
    label: "Records",
    sub: "Normalized output",
    icon: FileCheck2,
  },
];

function PipelineLogoMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h6a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h4" />
      <circle cx="4" cy="6" r="2" fill="currentColor" />
      <circle cx="20" cy="18" r="2" fill="currentColor" />
      <path d="M4 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h6" />
    </svg>
  );
}

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
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-page)] text-[var(--text-ink)] antialiased">
      {/* Theme toggle in top right */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        className="absolute right-4 top-4 z-10 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 text-[#6B6B66] hover:text-[#1B1B1A] dark:text-[#8E8B82] dark:hover:text-[#ECE9E2] transition-colors"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-12">
        {/* Product Pitch & Ink-on-Paper Pipeline Diagram */}
        <section className="space-y-6 lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-mono uppercase tracking-wider text-[#6B6B66] dark:text-[#8E8B82]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1B1B1A] dark:bg-[#ECE9E2]" />
            Webhook Ingestion & Reliability Platform
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2] sm:text-4xl">
              Every inbound webhook verified, normalized, and observable.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-[#6B6B66] dark:text-[#8E8B82]">
              Workflow Platform ingests signed payloads across web forms, CRM
              deal transitions, and B2B partner purchase feeds. Enforces
              per-source Zod schemas, deduplicates deliveries via idempotency
              keys, and schedules exponential retries.
            </p>
          </div>

          {/* Simple ink-on-paper line diagram: Source -> Verify -> Validate -> Queue -> Records */}
          <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66] dark:text-[#8E8B82]">
              Event Processing Pipeline
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {PIPELINE_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.label}
                    className="flex flex-1 items-center gap-1.5"
                  >
                    <div className="flex-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] p-2.5 text-center">
                      <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[#1B1B1A] dark:text-[#ECE9E2]">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-xs font-bold text-[#1B1B1A] dark:text-[#ECE9E2]">
                        {step.label}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#6B6B66] dark:text-[#8E8B82]">
                        {step.sub}
                      </p>
                    </div>
                    {index < PIPELINE_STEPS.length - 1 && (
                      <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-[#6B6B66] dark:text-[#8E8B82] sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs text-[#6B6B66] dark:text-[#8E8B82] sm:grid-cols-3">
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
              <p className="font-semibold text-[#1B1B1A] dark:text-[#ECE9E2]">
                Constant-Time HMAC
              </p>
              <p className="mt-1 text-[11px]">
                Raw-body SHA-256 verification and replay protection.
              </p>
            </div>
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
              <p className="font-semibold text-[#1B1B1A] dark:text-[#ECE9E2]">
                Atomic Lease Claims
              </p>
              <p className="mt-1 text-[11px]">
                Exponential backoff scheduling with dead-letter queueing.
              </p>
            </div>
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
              <p className="font-semibold text-[#1B1B1A] dark:text-[#ECE9E2]">
                Strict RBAC
              </p>
              <p className="mt-1 text-[11px]">
                In-memory access tokens with httpOnly refresh cookies.
              </p>
            </div>
          </div>
        </section>

        {/* Clean Sign-in Card */}
        <section className="lg:col-span-5">
          <div className="mx-auto w-full max-w-md rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-7 shadow-none">
            <div className="mb-6 flex items-center gap-3">
              <PipelineLogoMark className="h-6 w-6 text-[#1B1B1A] dark:text-[#ECE9E2] shrink-0" />
              <div>
                <h2 className="text-base font-bold text-[#1B1B1A] dark:text-[#ECE9E2]">
                  Workflow Platform
                </h2>
                <p className="text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                  Sign in to the operations dashboard
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded border border-[#FECACA] bg-[#FEE2E2] px-3.5 py-2 text-xs font-medium text-[#B91C1C] dark:border-[#541919] dark:bg-[#381111] dark:text-[#F87171]"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-xs font-medium text-[#1B1B1A] dark:text-[#ECE9E2]"
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
                  placeholder="admin@workflow.local"
                  className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-3 py-2 text-xs font-mono text-[#1B1B1A] placeholder-[#6B6B66] focus:border-[#1B1B1A] focus:outline-none dark:text-[#ECE9E2] dark:placeholder-[#8E8B82] dark:focus:border-[#ECE9E2]"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-medium text-[#1B1B1A] dark:text-[#ECE9E2]"
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
                  className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-3 py-2 text-xs font-mono text-[#1B1B1A] placeholder-[#6B6B66] focus:border-[#1B1B1A] focus:outline-none dark:text-[#ECE9E2] dark:placeholder-[#8E8B82] dark:focus:border-[#ECE9E2]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded bg-[#1B1B1A] px-4 py-2 text-xs font-medium text-[#F6F4EF] hover:bg-[#2E2E2C] dark:bg-[#ECE9E2] dark:text-[#141413] dark:hover:bg-[#FFFFFF] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{submitting ? "Signing in..." : "Sign in"}</span>
              </button>
            </form>

            <p className="mt-5 text-center font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
              Access tokens are kept strictly in memory with httpOnly refresh
              cookies.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
