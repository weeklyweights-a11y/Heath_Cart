"use client";

import HealthBadge from "@/components/HealthBadge";
import ProductCard from "@/components/ProductCard";
import CoverageGauge from "@/components/CoverageScore";
import BasketItemRow from "@/components/ui/BasketItem";
import Button from "@/components/ui/Button";
import ChatBubble from "@/components/ui/ChatBubble";
import Tag from "@/components/ui/Tag";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";

const sampleProduct = {
  id: "1",
  nameEn: "Organic Kale",
  category: "Vegetables",
  price: 3.99,
  imageUrl: null,
  badge: "recommended" as const,
  reasoning: ["High fiber — recommended for Mike."],
  score: 85,
};

export default function ComponentsDevPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 p-8">
      <h1 className="text-3xl text-primary">Design System Components</h1>

      <section className="space-y-4">
        <h2 className="text-xl text-primary">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button loading>Loading</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl text-primary">Health Badges</h2>
        <div className="flex flex-wrap gap-3">
          <HealthBadge badge="recommended" reasoning={["Good for Mike"]} />
          <HealthBadge badge="limit" reasoning={["Watch sodium"]} />
          <HealthBadge badge="avoid" reasoning={["Jake peanut allergy"]} />
          <HealthBadge badge="neutral" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl text-primary">Product Card</h2>
        <div className="max-w-xs">
          <ProductCard product={sampleProduct} onAdd={() => {}} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl text-primary">Coverage Gauge</h2>
        <CoverageGauge
          overall={82}
          perMember={[
            { label: "Mike (cholesterol, pre-diabetic): 82%", value: 82 },
            { label: "Jake (peanut allergy): 91%", value: 91 },
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl text-primary">Chat Bubbles</h2>
        <ChatBubble role="user">My mom is visiting and can&apos;t eat gluten.</ChatBubble>
        <ChatBubble role="assistant">
          I&apos;ve noted Linda&apos;s gluten-free needs and updated your store.
        </ChatBubble>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl text-primary">Tags</h2>
        <Tag label="gluten-free" />
        <Tag label="high-fiber" />
      </section>

      <section>
        <h2 className="mb-4 text-xl text-primary">Skeletons</h2>
        <ProductGridSkeleton count={4} />
      </section>
    </main>
  );
}
