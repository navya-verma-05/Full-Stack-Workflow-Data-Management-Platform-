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
  key: "text-[#1B1B1A] dark:text-[#ECE9E2] font-semibold",
  string: "text-[#2E7D32] dark:text-[#4ADE80]",
  number: "text-[#B45309] dark:text-[#FBBF24]",
  boolean: "text-[#C2410C] dark:text-[#FB923C] font-semibold",
  null: "text-[#B91C1C] dark:text-[#F87171] font-semibold",
  punctuation: "text-[#6B6B66] dark:text-[#8E8B82]",
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
    <div className="flex flex-col overflow-hidden rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-page)] px-4 py-2.5">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1B1B1A] dark:text-[#ECE9E2]">
            {title}
          </h3>
          {subtitle && (
            <p className="font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${title}`}
          className="inline-flex items-center gap-1.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-mono text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[#2E7D32] dark:text-[#4ADE80]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy JSON</span>
            </>
          )}
        </button>
      </div>
      <pre
        className={`${maxHeightClass} overflow-auto bg-[var(--bg-page)] p-4 font-mono text-xs leading-relaxed`}
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
