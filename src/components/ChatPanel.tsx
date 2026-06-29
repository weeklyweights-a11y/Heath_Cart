"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import Button from "@/components/ui/Button";
import ChatBubble from "@/components/ui/ChatBubble";
import { useHealthCart } from "@/context/HealthCartContext";
import { addToBasket, sendChat } from "@/lib/api-client";
import { formatUsd } from "@/lib/format";
import { matchProductsInResponse } from "@/lib/member-labels";
import type { ProductDto } from "@/lib/types";

const SUGGESTIONS = [
  "My mom's visiting and can't eat gluten",
  "Jake has a cold — need something light",
  "Saturday BBQ — what should I grab?",
];

export default function ChatPanel() {
  const {
    familyId,
    chatOpen,
    setChatOpen,
    hasUnreadPrompts,
    clearUnread,
    messages,
    addMessage,
    setScores,
    setBasket,
    basketId,
    setExtractedContext,
    refetchFamily,
    productCatalog,
    scoresVersion,
    refreshProductCatalog,
  } = useHealthCart();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScoresVersion = useRef(scoresVersion);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleClose = useCallback(() => {
    setChatOpen(false);
    if (scoresVersion !== prevScoresVersion.current) {
      refreshProductCatalog();
      prevScoresVersion.current = scoresVersion;
    }
  }, [setChatOpen, scoresVersion, refreshProductCatalog]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!familyId || !text.trim()) return;
      setError(null);
      setLastFailed(null);
      addMessage({ role: "user", content: text.trim() });
      setInput("");
      setLoading(true);
      clearUnread();

      const { data, error: err } = await sendChat({
        familyId,
        message: text.trim(),
      });
      setLoading(false);

      if (err || !data) {
        setError("Something went wrong. Tap to retry.");
        setLastFailed(text.trim());
        return;
      }

      setScores(data.updatedScores);
      setBasket(data.basket);
      setExtractedContext(data.extractedContext);
      await refetchFamily();

      const matched = matchProductsInResponse(data.response, productCatalog);
      addMessage({
        role: "assistant",
        content: data.response,
        products: matched.length ? matched : undefined,
        basketSummary: data.basket.items.length ? data.basket : undefined,
      });
    },
    [
      familyId,
      addMessage,
      clearUnread,
      setScores,
      setBasket,
      setExtractedContext,
      refetchFamily,
      productCatalog,
    ],
  );

  const handleAddProduct = async (product: ProductDto) => {
    if (!familyId) return;
    const detail = await fetch(`/api/products/${product.id}?familyId=${familyId}`);
    const json = await detail.json();
    const variant = json.data?.variants?.[0];
    if (!variant) return;
    const { data } = await addToBasket({
      familyId,
      basketId: basketId ?? undefined,
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
    });
    if (data) setBasket(data);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setChatOpen(true);
          clearUnread();
        }}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:bg-primary-dark"
        aria-label="Open chat"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        {hasUnreadPrompts && (
          <span className="absolute -right-1 -top-1 rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
            New
          </span>
        )}
      </button>

      {chatOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 md:bg-transparent"
            onClick={handleClose}
            aria-hidden
          />
          <div
            className={`fixed z-50 flex flex-col bg-cream shadow-xl transition-transform duration-300 ease-out ${
              chatOpen ? "translate-y-0 translate-x-0" : ""
            } inset-x-0 bottom-0 top-16 rounded-t-2xl md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-[400px] md:rounded-none md:border-l md:border-primary/10`}
          >
            <div className="flex items-center justify-between border-b border-primary/10 px-4 py-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-gray-300 md:hidden" />
              <h2 className="font-heading text-lg text-primary md:mx-0">
                Grocery Assistant
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-2xl text-text/60 hover:text-text"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!familyId && (
                <div className="mb-4 rounded-lg bg-white p-4 text-center text-sm">
                  <p className="mb-3">Set up your family or try the demo to start chatting.</p>
                  <div className="flex flex-col gap-2">
                    <Link href="/family">
                      <Button variant="primary" className="w-full">
                        Set Up Your Family
                      </Button>
                    </Link>
                    <Link href="/">
                      <Button variant="secondary" className="w-full">
                        Try the Demo
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {messages.length === 0 && familyId && (
                <div className="mb-4 space-y-2">
                  <p className="text-sm text-text/70">Try saying:</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="block w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-left text-sm hover:border-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <ChatBubble
                  key={i}
                  role={m.role}
                  footer={
                    m.role === "assistant" ? (
                      <>
                        {m.products?.map((p) => (
                          <div key={p.id} className="max-w-[200px]">
                            <ProductCard
                              product={p}
                              familyId={familyId ?? undefined}
                              onAdd={() => handleAddProduct(p)}
                            />
                          </div>
                        ))}
                        {m.basketSummary && (
                          <div className="rounded-lg bg-white p-3 text-sm shadow-sm">
                            <p className="font-medium">
                              {m.basketSummary.items.length} items ·{" "}
                              {m.basketSummary.coverageScore}% coverage ·{" "}
                              {formatUsd(m.basketSummary.totalPrice)}
                            </p>
                            <Link
                              href="/basket"
                              className="mt-2 inline-block text-primary underline"
                              onClick={() => setChatOpen(false)}
                            >
                              View Full Basket
                            </Link>
                          </div>
                        )}
                      </>
                    ) : undefined
                  }
                >
                  {m.content}
                </ChatBubble>
              ))}

              {loading && (
                <div className="mb-3 flex justify-start">
                  <div className="rounded-lg bg-cream px-4 py-3 text-sm text-text/60">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}

              {error && (
                <button
                  type="button"
                  onClick={() => lastFailed && sendMessage(lastFailed)}
                  className="mb-3 w-full rounded-lg bg-[#FFEBEE] px-4 py-2 text-sm text-[#C62828]"
                >
                  {error}
                </button>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-primary/10 p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!familyId || loading}
                  placeholder="Tell me about your family's week..."
                  className="min-h-12 flex-1 rounded-lg border border-primary/20 px-3 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
                />
                <Button type="submit" disabled={!familyId || loading || !input.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
