import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export default function FilaPagination({ fila, exibidos }) {
  const [erro, setErro] = useState("");
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
    <span>{fila.isError ? "Não foi possível atualizar a consulta. Os dados anteriores não confirmam a situação atual." : `Exibindo ${exibidos} de ${fila.total ?? "…"} ordens da consulta`}</span>
    {(erro || fila.error) && <span role="alert" className="w-full text-destructive">{erro || fila.error?.message}</span>}
    {fila.isError && <Button variant="outline" onClick={() => fila.refetch()}>Tentar novamente</Button>}
    {fila.temMais && <Button variant="outline" disabled={fila.carregandoMais || fila.isFetching} onClick={async () => {
      setErro("");
      try { await fila.carregarMais(); } catch (e) { setErro(e.message); }
    }}>{fila.carregandoMais ? "Carregando…" : "Carregar mais ordens"}</Button>}
  </div>;
}