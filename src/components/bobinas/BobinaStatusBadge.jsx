import React from "react";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Factory, Star, CheckCircle2, PackageCheck } from "lucide-react";

const STATUS_CONFIG = {
  "RESERVADA":      { color: "bg-purple-100 text-purple-700 border-purple-200",   Icon: Star },
  "Fechada":        { color: "bg-green-100 text-green-700 border-green-200",       Icon: Lock },
  "Aberta":         { color: "bg-blue-100 text-blue-700 border-blue-200",          Icon: Unlock },
  "Finalizada":     { color: "bg-slate-100 text-slate-500 border-slate-200",       Icon: CheckCircle2 },
};

function getStatusConfig(status) {
  // "Na TP40", "Na DESBOBINADOR", etc.
  if (status.startsWith("Na ")) return { color: "bg-orange-100 text-orange-700 border-orange-200", Icon: Factory };
  return STATUS_CONFIG[status] || { color: "bg-slate-100 text-slate-500 border-slate-200", Icon: PackageCheck };
}

/**
 * Badge compacto para mostrar o status da bobina ao lado dela no dropdown.
 */
export default function BobinaStatusBadge({ status, size = "sm" }) {
  if (!status) return null;
  const cfg = getStatusConfig(status);
  const sizeClass = size === "xs" ? "text-[9px] px-1 py-0" : "text-[10px] px-1.5 py-0";
  return (
    <Badge className={`border ${cfg.color} ${sizeClass} font-semibold whitespace-nowrap inline-flex items-center gap-0.5`}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {status}
    </Badge>
  );
}