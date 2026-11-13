import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "../context/ToastContext";

interface JsonCodeBlockProps {
  title: string;
  subtitle?: string;
  data: unknown;
  maxHeightClass?: string;
}

type TokenKind =
  "key" | "string" | "number" | "boolean" | "null" | "punctuation";

interface JsonToken {
  kind: TokenKind;
  text: string;
}

const JSON_TOKEN_REGEX =
  /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],:])/g;

function tokenizeJson(formatted: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let lastIndex = 0;

  for (const match of formatted.matchAll(JSON_TOKEN_REGEX)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      tokens.push({
        kind: "punctuation",
        text: formatted.slice(lastIndex, idx),
      });
    }
    const raw = match[0];
    let kind: TokenKind = "punctuation";
    if (raw.startsWith('"')) {
      kind = raw.endsWith(":") ? "key" : "string";
    } else if (raw === "true" || raw === "false") {
      kind = "boolean";
    } else if (raw === "null") {
      kind = "null";
    } else if (/^-?\d/.test(raw)) {
      kind = "number";
    }
    tokens.push({ kind, text: raw });
    lastIndex = idx + raw.length;
  }

  if (lastIndex < formatted.length) {
    tokens.push({ kind: "punctuation", text: formatted.slice(lastIndex) });
  }
  return tokens;
}

const TOKEN_CLASSES: Record<TokenKind, string> = {
  key: "text-indigo-700 dark:text-indigo-300 font-medium",
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  boolean: "text-sky-700 dark:text-sky-300 font-medium",
  null: "text-rose-600 dark:text-rose-400 italic",
  punctuation: "text-slate-500 dark:text-slate-400",
};

export function JsonCodeBlock({
  title,
  subtitle,
  data,
  maxHeightClass = "max-h-[420px]",
}: JsonCodeBlockProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const formatted = useMemo(
    () => JSON.stringify(data ?? null, null, 2),
    [data],
  );
  const tokens = useMemo(() => tokenizeJson(formatted), [formatted]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      toast.success("JSON copied", `${title} copied to clipboard`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(
        "Copy failed",
        "Clipboard permission unavailable in this browser context",
      );
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/90">
        <div>
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${title}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy JSON
            </>
          )}
        </button>
      </div>
      <pre
        className={`${maxHeightClass} overflow-auto bg-slate-50/70 p-4 font-mono text-xs leading-relaxed dark:bg-slate-950/90`}
      >
        <code>
          {tokens.map((tok, index) => (
            <span key={index} className={TOKEN_CLASSES[tok.kind]}>
              {tok.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
