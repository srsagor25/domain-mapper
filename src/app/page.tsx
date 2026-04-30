import { DomainSearch } from "@/components/domain-search";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Domain Mapper
          </h1>
          <p className="mt-3 text-lg text-foreground/60">
            Search a domain or describe your business — we&apos;ll generate
            ideas and check availability instantly.
          </p>
        </div>
        <DomainSearch />
      </div>
    </main>
  );
}
