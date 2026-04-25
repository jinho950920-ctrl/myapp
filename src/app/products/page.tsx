import ProductsClient from "./ProductsClient";
import { fetchProductsWithData, fetchUnmatchedQueue } from "@/app/actions/productActions";

export const dynamic = "force-dynamic";

export default async function ProductsRoute() {
  const products = await fetchProductsWithData();
  const unmatched = await fetchUnmatchedQueue();

  return <ProductsClient initialProducts={products} initialUnmatched={unmatched} />;
}
