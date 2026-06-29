"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchBasket,
  fetchFamily,
  fetchProducts,
} from "@/lib/api-client";
import type {
  BasketResult,
  ExtractedContext,
  FamilyDto,
  ProductDto,
  ScoredProduct,
} from "@/lib/types";
import { emptyExtractedContext } from "@/lib/types";

const FAMILY_KEY = "healthcart_familyId";
const BASKET_KEY = "healthcart_basketId";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  products?: ProductDto[];
  basketSummary?: BasketResult;
}

interface HealthCartContextValue {
  familyId: string | null;
  family: FamilyDto | null;
  basket: BasketResult | null;
  basketId: string | null;
  scoreMap: Map<string, ScoredProduct>;
  scoresVersion: number;
  extractedContext: ExtractedContext;
  productCatalog: ProductDto[];
  chatOpen: boolean;
  hasUnreadPrompts: boolean;
  messages: ChatMessage[];
  loading: boolean;
  setFamilyId: (id: string | null) => void;
  setFamily: (family: FamilyDto | null) => void;
  setBasket: (basket: BasketResult | null) => void;
  setScores: (scores: ScoredProduct[]) => void;
  setExtractedContext: (ctx: ExtractedContext) => void;
  setChatOpen: (open: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  clearUnread: () => void;
  refetchFamily: () => Promise<void>;
  loadBasketFromStorage: () => Promise<void>;
  refreshProductCatalog: () => Promise<void>;
  getBasketQty: (productId: string) => number;
}

const HealthCartContext = createContext<HealthCartContextValue | null>(null);

export function HealthCartProvider({ children }: { children: ReactNode }) {
  const [familyId, setFamilyIdState] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyDto | null>(null);
  const [basket, setBasketState] = useState<BasketResult | null>(null);
  const [basketId, setBasketIdState] = useState<string | null>(null);
  const [scoreMap, setScoreMap] = useState<Map<string, ScoredProduct>>(new Map());
  const [scoresVersion, setScoresVersion] = useState(0);
  const [extractedContext, setExtractedContext] = useState<ExtractedContext>(
    emptyExtractedContext(),
  );
  const [productCatalog, setProductCatalog] = useState<ProductDto[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasUnreadPrompts, setHasUnreadPrompts] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const setFamilyId = useCallback((id: string | null) => {
    setFamilyIdState(id);
    if (typeof window !== "undefined") {
      if (id) sessionStorage.setItem(FAMILY_KEY, id);
      else sessionStorage.removeItem(FAMILY_KEY);
    }
  }, []);

  const setBasket = useCallback((b: BasketResult | null) => {
    setBasketState(b);
    const id = b?.basketId ?? null;
    setBasketIdState(id);
    if (typeof window !== "undefined") {
      if (id) sessionStorage.setItem(BASKET_KEY, id);
      else sessionStorage.removeItem(BASKET_KEY);
    }
  }, []);

  const setScores = useCallback((scores: ScoredProduct[]) => {
    setScoreMap(new Map(scores.map((s) => [s.productId, s])));
    setScoresVersion((v) => v + 1);
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clearUnread = useCallback(() => setHasUnreadPrompts(false), []);

  const refetchFamily = useCallback(async () => {
    if (!familyId) return;
    const { data } = await fetchFamily(familyId);
    if (data) setFamily(data);
  }, [familyId]);

  const loadBasketFromStorage = useCallback(async () => {
    const stored =
      typeof window !== "undefined" ? sessionStorage.getItem(BASKET_KEY) : null;
    const id = stored ?? basketId;
    if (!id) return;
    const { data } = await fetchBasket(id);
    if (data) setBasket(data);
  }, [basketId, setBasket]);

  const refreshProductCatalog = useCallback(async () => {
    const { data } = await fetchProducts({
      familyId: familyId ?? undefined,
      limit: 100,
    });
    if (data) setProductCatalog(data.products);
  }, [familyId]);

  const getBasketQty = useCallback(
    (productId: string) => {
      const item = basket?.items.find((i) => i.productId === productId);
      return item?.quantity ?? 0;
    },
    [basket],
  );

  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search);
      const urlFamily = params.get("familyId");
      const storedFamily = sessionStorage.getItem(FAMILY_KEY);
      const fid = urlFamily ?? storedFamily;
      if (fid) {
        setFamilyIdState(fid);
        sessionStorage.setItem(FAMILY_KEY, fid);
        const { data } = await fetchFamily(fid);
        if (data) setFamily(data);
      }
      const storedBasket = sessionStorage.getItem(BASKET_KEY);
      if (storedBasket) {
        try {
          const { data } = await fetchBasket(storedBasket);
          if (data) {
            setBasketState(data);
            setBasketIdState(data.basketId);
          }
        } catch {
          sessionStorage.removeItem(BASKET_KEY);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (familyId) refreshProductCatalog();
  }, [familyId, refreshProductCatalog]);

  const value = useMemo(
    () => ({
      familyId,
      family,
      basket,
      basketId,
      scoreMap,
      scoresVersion,
      extractedContext,
      productCatalog,
      chatOpen,
      hasUnreadPrompts,
      messages,
      loading,
      setFamilyId,
      setFamily,
      setBasket,
      setScores,
      setExtractedContext,
      setChatOpen,
      addMessage,
      clearUnread,
      refetchFamily,
      loadBasketFromStorage,
      refreshProductCatalog,
      getBasketQty,
    }),
    [
      familyId,
      family,
      basket,
      basketId,
      scoreMap,
      scoresVersion,
      extractedContext,
      productCatalog,
      chatOpen,
      hasUnreadPrompts,
      messages,
      loading,
      setFamilyId,
      setBasket,
      setScores,
      refetchFamily,
      loadBasketFromStorage,
      refreshProductCatalog,
      getBasketQty,
      clearUnread,
      addMessage,
    ],
  );

  return (
    <HealthCartContext.Provider value={value}>{children}</HealthCartContext.Provider>
  );
}

export function useHealthCart() {
  const ctx = useContext(HealthCartContext);
  if (!ctx) throw new Error("useHealthCart must be used within HealthCartProvider");
  return ctx;
}
