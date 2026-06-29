import { COLORS, CATEGORIES, BADGE_TYPES, TYPE_SCALE } from "@/lib/constants";

const colorEntries = Object.entries(COLORS);

export default function TokensPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <h1 className="text-4xl text-primary">Design Tokens</h1>

      <section>
        <h2 className="mb-4 text-2xl text-primary">Colors</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {colorEntries.map(([name, hex]) => (
            <div key={name} className="rounded border border-accent/20 p-3">
              <div
                className="mb-2 h-16 rounded"
                style={{ backgroundColor: hex }}
              />
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-text/70">{hex}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl text-primary">Type Scale (Inter body)</h2>
        <div className="space-y-2">
          {TYPE_SCALE.map((size) => (
            <p key={size} className={`text-${size}`}>
              text-{size} — The quick brown fox jumps over the lazy dog.
            </p>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl text-primary">Headings (Georgia Bold 700)</h2>
        <h1 className="text-4xl">Heading 1 — HealthCart</h1>
        <h2 className="text-3xl">Heading 2 — Your Family</h2>
        <h3 className="text-2xl">Heading 3 — Shop Fresh</h3>
        <h4 className="text-xl">Heading 4 — Weekly Basket</h4>
      </section>

      <section>
        <h2 className="mb-4 text-2xl text-primary">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <span key={cat} className="rounded bg-primary/10 px-3 py-1 text-sm">
              {cat}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl text-primary">Badge Types</h2>
        <div className="flex flex-wrap gap-2">
          {BADGE_TYPES.map((badge) => (
            <span key={badge} className="rounded bg-accent/20 px-3 py-1 text-sm">
              {badge}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
