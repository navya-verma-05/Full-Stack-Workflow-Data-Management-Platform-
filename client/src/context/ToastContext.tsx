import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((prev) => [
        ...prev.slice(-3),
        { id, variant, title, description },
      ]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
      info: (title, description) => push("info", title, description),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((item) => {
          const styles =
            item.variant === "success"
              ? "border-emerald-500/40 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
              : item.variant === "error"
                ? "border-rose-500/40 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                : "border-indigo-500/40 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100";

          const Icon =
            item.variant === "success"
              ? CheckCircle2
              : item.variant === "error"
                ? AlertCircle
                : Info;

          const iconColor =
            item.variant === "success"
              ? "text-emerald-500"
              : item.variant === "error"
                ? "text-rose-500"
                : "text-indigo-500";

          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-all ${styles}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}
