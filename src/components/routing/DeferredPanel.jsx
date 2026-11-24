import React, { Suspense } from "react";
import RouteLoading from "@/components/routing/RouteLoading";

export default function DeferredPanel({ when = true, children }) {
  if (!when) return null;
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"><RouteLoading compact /></div>}>
      {children}
    </Suspense>
  );
}