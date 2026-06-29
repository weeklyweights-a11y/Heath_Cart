"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";
import HealthBadge from "@/components/HealthBadge";
import { useHealthCart } from "@/context/HealthCartContext";
import { seedJohnsonDemo } from "@/lib/api-client";

export default function HomePage() {
  const router = useRouter();
  const { setFamilyId, setFamily, setChatOpen } = useHealthCart();

  const tryDemo = async () => {
    const { data } = await seedJohnsonDemo();
    if (data) {
      setFamilyId(data.familyId);
      setFamily(data.family);
      setChatOpen(true);
      router.push("/shop");
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <Logo />
        <Link href="/shop" className="text-sm font-medium text-primary hover:underline">
          Shop
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="font-heading text-4xl text-primary md:text-5xl">
          Your Family&apos;s Wellness Starts Here
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-text/80">
          A grocery store that knows your family&apos;s health — and adapts every week.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/family">
            <Button>Set Up Your Family</Button>
          </Link>
          <Button variant="secondary" onClick={tryDemo}>
            Try the Demo
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl text-primary">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              1
            </div>
            <h3 className="font-semibold text-primary">Tell us about your family</h3>
            <p className="mt-2 text-sm text-text/70">
              Add members, health conditions, and allergies so every product is scored for your household.
            </p>
          </div>
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              2
            </div>
            <h3 className="font-semibold text-primary">Chat about your week</h3>
            <p className="mt-2 text-sm italic text-text/70">
              &quot;My mom&apos;s visiting from Florida, she can&apos;t have gluten...&quot;
            </p>
          </div>
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              3
            </div>
            <h3 className="font-semibold text-primary">Shop a store designed for you</h3>
            <div className="mt-3 flex justify-center gap-2">
              <HealthBadge badge="recommended" reasoning={["Good for Mike"]} size="sm" />
              <HealthBadge badge="avoid" reasoning={["Jake's peanut allergy"]} size="sm" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary/5 py-16 text-center">
        <h2 className="text-2xl text-primary">Ready to see the magic?</h2>
        <p className="mt-2 text-text/70">Load the Johnson family demo and start shopping in seconds.</p>
        <Button variant="accent" className="mt-6" onClick={tryDemo}>
          Try It Now
        </Button>
      </section>

      <footer className="border-t border-primary/10 py-8 text-center text-sm text-text/60">
        Built with Next.js, Aurora PostgreSQL, and Gemini Flash. Powered by USDA FoodData
        Central nutritional data.
      </footer>
    </div>
  );
}
