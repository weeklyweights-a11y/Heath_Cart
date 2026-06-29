import { Suspense } from "react";
import ProductDetailClient from "./ProductDetailClient";

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ProductDetailClient id={params.id} />
    </Suspense>
  );
}
