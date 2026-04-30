"use client";

import { useState, useRef, useEffect } from "react";

const ALL_TLDS = [".com", ".ai", ".io", ".dev", ".app", ".co", ".xyz", ".tech"];

type Mode = "domain" | "business";

interface DomainResult {
  domain: string;
  available: boolean;
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
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "taken"
  >("all");
  const [tldFilters, setTldFilters] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const toggleTld = (tld: string) => {
    setTldFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tld)) {
        next.delete(tld);
      } else {
        next.add(tld);
      }
      return next;
    });
  };

  const resetResults = () => {
    setPhase("idle");
    setExactResults([]);
    setSuggestions([]);
    setBaseName("");
    setStats({ total: 0, available: 0 });
  };

  const search = async (q: string, searchMode: Mode) => {
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

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), mode: searchMode }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Search failed");

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
          }
        }
      }
    } catch (error: unknown) {
      if ((error as Error).name !== "AbortError") {
        console.error("Search error:", error);
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
    // Cmd/Ctrl+Enter submits the textarea; plain Enter still submits the input.
    if (mode === "domain" && e.key === "Enter") {
      e.preventDefault();
      search(query, "domain");
    } else if (mode === "business" && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
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
  const showExactSection = mode === "domain" && hasResults && exactResults.length > 0;

  return (
    <div>
      {/* Mode toggle */}
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

      {/* Input */}
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
              autoFocus
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
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
              autoFocus
            />
            <div className="absolute bottom-3 left-5 text-xs text-foreground/30">
              ⌘+Enter to generate
            </div>
            <button
              type="submit"
              disabled={!businessIdea.trim() || isLoading}
              className="absolute bottom-3 right-3 rounded-xl bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {isLoading ? "Generating..." : "Generate"}
            </button>
          </div>
        )}
      </form>

      {/* Loading: Exact match phase */}
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

      {/* Stats + Status Filter */}
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

      {/* TLD Filter */}
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

      {/* Exact Match Section */}
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

      {/* Loading: AI suggestions phase */}
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

      {/* AI Suggestions Section */}
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
