"use client";

import { useState, useRef, useEffect } from "react";

const ALL_TLDS = [".com", ".ai", ".io", ".dev", ".app", ".co", ".xyz", ".tech"];

type Provider = "openai" | "anthropic" | "google";
type Mode = "domain" | "business";

interface DomainResult {
  domain: string;
  available: boolean;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

const PROVIDER_PREFIX: Record<Provider, string> = {
  openai: "sk-",
  anthropic: "sk-ant-",
  google: "AIza",
};

const PROVIDER_DOCS: Record<Provider, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/apikey",
};

const PROVIDER_KEY_STORAGE: Record<Provider, string> = {
  openai: "api_key_openai",
  anthropic: "api_key_anthropic",
  google: "api_key_google",
};

const SELECTED_PROVIDER_STORAGE = "selected_provider";

function isProvider(v: string | null): v is Provider {
  return v === "openai" || v === "anthropic" || v === "google";
}

function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function ApiKeyPanel({
  provider,
  apiKey,
  onSave,
  onClear,
}: {
  provider: Provider;
  apiKey: string | null;
  onSave: (key: string) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(!apiKey);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(!apiKey);
    setValue("");
    setError(null);
  }, [apiKey, provider]);

  const handleSave = () => {
    const trimmed = value.trim();
    const prefix = PROVIDER_PREFIX[provider];
    if (!trimmed.startsWith(prefix)) {
      setError(`${PROVIDER_LABEL[provider]} keys start with '${prefix}'.`);
      return;
    }
    setError(null);
    onSave(trimmed);
    setValue("");
    setEditing(false);
  };

  if (!editing && apiKey) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
            {PROVIDER_LABEL[provider]} key set
          </span>
          <span className="font-mono text-xs text-foreground/50">
            {maskKey(apiKey)}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-2 py-1 text-xs font-medium text-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-xs font-medium text-foreground/60 hover:bg-red-500/10 hover:text-red-500"
          >
            Clear
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Your {PROVIDER_LABEL[provider]} API key
        </h2>
        <a
          href={PROVIDER_DOCS[provider]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-foreground/50 underline-offset-2 hover:text-foreground/80 hover:underline"
        >
          Get a key →
        </a>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-foreground/50">
        Stored only in your browser. Sent per request to this server to call{" "}
        {PROVIDER_LABEL[provider]} on your behalf — never logged, never
        persisted server-side.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder={`${PROVIDER_PREFIX[provider]}...`}
          className="flex-1 rounded-lg border border-foreground/10 bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground/30"
          autoFocus
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!value.trim()}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Save
        </button>
        {apiKey && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setValue("");
              setError(null);
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ProviderSelector({
  provider,
  onChange,
  keys,
}: {
  provider: Provider;
  onChange: (next: Provider) => void;
  keys: Record<Provider, string | null>;
}) {
  return (
    <div className="mb-3 flex justify-center">
      <div className="inline-flex gap-1 rounded-xl bg-foreground/[0.04] p-1">
        {(["openai", "anthropic", "google"] as Provider[]).map((p) => {
          const hasKey = !!keys[p];
          const active = provider === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "text-foreground/50 hover:text-foreground/80"
              }`}
            >
              {PROVIDER_LABEL[p]}
              {hasKey && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    active ? "bg-background/70" : "bg-emerald-500"
                  }`}
                  aria-label="Key set"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between rounded-lg px-4 py-3">
      <div className="h-4 w-40 animate-pulse rounded bg-foreground/[0.06]" />
      <div className="h-4 w-16 animate-pulse rounded bg-foreground/[0.06]" />
    </div>
  );
}

function SkeletonBlock({ count, label }: { count: number; label: string }) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-4 animate-pulse rounded-full bg-foreground/[0.08]" />
        <span className="text-xs font-medium uppercase tracking-wider text-foreground/30">
          {label}
        </span>
        <div className="h-px flex-1 bg-foreground/[0.05]" />
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

function DomainRow({ result }: { result: DomainResult }) {
  const tldIndex = result.domain.indexOf(".");
  const name = result.domain.slice(0, tldIndex);
  const tld = result.domain.slice(tldIndex);

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-4 py-3 transition-all duration-200 ${
        result.available
          ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.1]"
          : "bg-foreground/[0.02] hover:bg-foreground/[0.04]"
      }`}
    >
      <span
        className={`font-mono text-sm ${
          result.available
            ? "font-medium text-foreground"
            : "text-foreground/35 line-through decoration-foreground/15"
        }`}
      >
        {name}
        <span
          className={
            result.available ? "text-foreground/50" : "text-foreground/25"
          }
        >
          {tld}
        </span>
      </span>
      {result.available ? (
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
          Available
        </span>
      ) : (
        <span className="text-xs text-foreground/25">Taken</span>
      )}
    </div>
  );
}

export function DomainSearch() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [keys, setKeys] = useState<Record<Provider, string | null>>({
    openai: null,
    anthropic: null,
    google: null,
  });
  const [mode, setMode] = useState<Mode>("domain");
  const [query, setQuery] = useState("");
  const [businessIdea, setBusinessIdea] = useState("");
  const [baseName, setBaseName] = useState("");
  const [exactResults, setExactResults] = useState<DomainResult[]>([]);
  const [suggestions, setSuggestions] = useState<DomainResult[]>([]);
  const [phase, setPhase] = useState<
    "idle" | "exact" | "suggestions" | "done"
  >("idle");
  const [stats, setStats] = useState({ total: 0, available: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "taken"
  >("all");
  const [tldFilters, setTldFilters] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const apiKey = keys[provider];

  useEffect(() => {
    try {
      const storedProvider = localStorage.getItem(SELECTED_PROVIDER_STORAGE);
      if (isProvider(storedProvider)) setProvider(storedProvider);

      const next: Record<Provider, string | null> = {
        openai: localStorage.getItem(PROVIDER_KEY_STORAGE.openai),
        anthropic: localStorage.getItem(PROVIDER_KEY_STORAGE.anthropic),
        google: localStorage.getItem(PROVIDER_KEY_STORAGE.google),
      };
      setKeys(next);
    } catch {
      // localStorage unavailable — user can still paste each session.
    }
  }, []);

  const handleSaveKey = (key: string) => {
    try {
      localStorage.setItem(PROVIDER_KEY_STORAGE[provider], key);
    } catch {
      // ignore
    }
    setKeys((prev) => ({ ...prev, [provider]: key }));
    setErrorMessage(null);
  };

  const handleClearKey = () => {
    try {
      localStorage.removeItem(PROVIDER_KEY_STORAGE[provider]);
    } catch {
      // ignore
    }
    setKeys((prev) => ({ ...prev, [provider]: null }));
    resetResults();
  };

  const handleProviderChange = (next: Provider) => {
    if (next === provider) return;
    if (abortRef.current) abortRef.current.abort();
    setProvider(next);
    try {
      localStorage.setItem(SELECTED_PROVIDER_STORAGE, next);
    } catch {
      // ignore
    }
    resetResults();
  };

  const toggleTld = (tld: string) => {
    setTldFilters((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(tld)) {
        nextSet.delete(tld);
      } else {
        nextSet.add(tld);
      }
      return nextSet;
    });
  };

  const resetResults = () => {
    setPhase("idle");
    setExactResults([]);
    setSuggestions([]);
    setBaseName("");
    setStats({ total: 0, available: 0 });
    setErrorMessage(null);
  };

  const search = async (q: string, searchMode: Mode) => {
    if (!apiKey) {
      setErrorMessage(
        `Add your ${PROVIDER_LABEL[provider]} API key above to start searching.`
      );
      return;
    }
    if (!q.trim()) {
      resetResults();
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("exact");
    setExactResults([]);
    setSuggestions([]);
    setStats({ total: 0, available: 0 });
    setErrorMessage(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-provider": provider,
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ query: q.trim(), mode: searchMode }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let message = "Search failed.";
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {
          // ignore
        }
        setErrorMessage(message);
        setPhase("idle");
        return;
      }

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);

          if (data.type === "exact") {
            setBaseName(data.baseName);
            setExactResults(data.results);
            setPhase("suggestions");
          } else if (data.type === "suggestions") {
            setSuggestions(data.results);
            setStats({ total: data.total, available: data.available });
            setPhase("done");
          } else if (data.type === "error") {
            setErrorMessage(data.message);
            setPhase("done");
          }
        }
      }
    } catch (error: unknown) {
      if ((error as Error).name !== "AbortError") {
        console.error("Search error:", error);
        setErrorMessage("Search failed. Please try again.");
        setPhase("idle");
      }
    }
  };

  const currentInput = mode === "domain" ? query : businessIdea;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(currentInput, mode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode === "domain" && e.key === "Enter") {
      e.preventDefault();
      search(query, "domain");
    } else if (
      mode === "business" &&
      e.key === "Enter" &&
      (e.metaKey || e.ctrlKey)
    ) {
      e.preventDefault();
      search(businessIdea, "business");
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (abortRef.current) abortRef.current.abort();
    setMode(next);
    resetResults();
  };

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const applyFilters = (results: DomainResult[]) =>
    results.filter((r) => {
      if (statusFilter === "available" && !r.available) return false;
      if (statusFilter === "taken" && r.available) return false;
      if (tldFilters.size > 0) {
        const tld = r.domain.slice(r.domain.indexOf("."));
        if (!tldFilters.has(tld)) return false;
      }
      return true;
    });

  const isLoading = phase === "exact" || phase === "suggestions";
  const hasResults = phase === "suggestions" || phase === "done";
  const showExactSection =
    mode === "domain" && hasResults && exactResults.length > 0;

  return (
    <div>
      <ProviderSelector
        provider={provider}
        onChange={handleProviderChange}
        keys={keys}
      />

      <ApiKeyPanel
        provider={provider}
        apiKey={apiKey}
        onSave={handleSaveKey}
        onClear={handleClearKey}
      />

      <div className="mb-3 flex justify-center">
        <div className="inline-flex gap-1 rounded-xl bg-foreground/[0.04] p-1">
          {(
            [
              { id: "domain", label: "Domain" },
              { id: "business", label: "Business idea" },
            ] as { id: Mode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => switchMode(m.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === m.id
                  ? "bg-foreground text-background"
                  : "text-foreground/50 hover:text-foreground/80"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        {mode === "domain" ? (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search a domain... e.g. aiunicorn.com"
              className="w-full rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-5 py-4 pr-28 text-lg text-foreground outline-none transition-all placeholder:text-foreground/30 focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading || !apiKey}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </>
        ) : (
          <div className="relative">
            <textarea
              value={businessIdea}
              onChange={(e) => setBusinessIdea(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your business... e.g. AI-powered fitness coaching app for busy professionals who want personalized workouts"
              rows={4}
              className="w-full resize-none rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-5 py-4 pb-14 text-base text-foreground outline-none transition-all placeholder:text-foreground/30 focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5"
            />
            <div className="absolute bottom-3 left-5 text-xs text-foreground/30">
              ⌘+Enter to generate
            </div>
            <button
              type="submit"
              disabled={!businessIdea.trim() || isLoading || !apiKey}
              className="absolute bottom-3 right-3 rounded-xl bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {isLoading ? "Generating..." : "Generate"}
            </button>
          </div>
        )}
      </form>

      {errorMessage && (
        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {phase === "exact" && (
        <div>
          {mode === "domain" && (
            <SkeletonBlock count={8} label="Checking exact domain..." />
          )}
          <SkeletonBlock
            count={mode === "business" ? 12 : 6}
            label={
              mode === "business"
                ? "Reading your business idea..."
                : "Finding AI suggestions..."
            }
          />
        </div>
      )}

      {hasResults && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-foreground/50">
            <span className="font-semibold text-emerald-600">
              {phase === "done"
                ? stats.available
                : exactResults.filter((r) => r.available).length}
            </span>{" "}
            available
            {phase === "done" && (
              <>
                {" "}
                out of{" "}
                <span className="font-medium text-foreground/70">
                  {stats.total}
                </span>{" "}
                checked
              </>
            )}
          </p>
          <div className="flex gap-1 rounded-lg bg-foreground/[0.04] p-1">
            {(["all", "available", "taken"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  statusFilter === f
                    ? "bg-foreground text-background"
                    : "text-foreground/50 hover:text-foreground/70"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasResults && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ALL_TLDS.map((tld) => {
            const active = tldFilters.has(tld);
            return (
              <button
                key={tld}
                onClick={() => toggleTld(tld)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  active
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-foreground/8 text-foreground/40 hover:border-foreground/15 hover:text-foreground/60"
                }`}
              >
                {tld}
              </button>
            );
          })}
          {tldFilters.size > 0 && (
            <button
              onClick={() => setTldFilters(new Set())}
              className="rounded-full px-3 py-1 text-xs font-medium text-foreground/30 transition-colors hover:text-foreground/50"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {showExactSection && (
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
              {baseName}
            </span>
            <div className="h-px flex-1 bg-foreground/[0.06]" />
          </div>
          <div className="space-y-1.5">
            {applyFilters(exactResults).map((r) => (
              <DomainRow key={r.domain} result={r} />
            ))}
          </div>
        </div>
      )}

      {phase === "suggestions" && (
        <SkeletonBlock
          count={10}
          label={
            mode === "business"
              ? "Generating brand names..."
              : "AI is thinking of alternatives..."
          }
        />
      )}

      {phase === "done" && suggestions.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
              {mode === "business" ? "Brand name ideas" : "AI Suggestions"}
            </span>
            <div className="h-px flex-1 bg-foreground/[0.06]" />
          </div>
          <div className="space-y-1.5">
            {applyFilters(suggestions).map((r) => (
              <DomainRow key={r.domain} result={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
