import React from "react";
import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, subtitle, icon: Icon, color }) {
  const colorClasses = {
    blue: "bg-primary/10 text-primary",
    orange: "bg-accent/10 text-accent-foreground",
    green: "bg-green-500/10 text-green-600",
    purple: "bg-purple-500/10 text-purple-600",
    red: "bg-destructive/10 text-destructive",
    slate: "bg-muted text-muted-foreground",
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn("p-3 rounded-xl", colorClasses[color] || colorClasses.blue)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}