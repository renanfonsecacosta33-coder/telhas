import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function BuscaPcpInput({ value, onChange, onClear, placeholder }) {
  const [draft, setDraft] = useState(value);
  const pending = useRef(null);
  useEffect(() => {
    clearTimeout(pending.current);
    setDraft(value);
  }, [value]);
  useEffect(() => () => clearTimeout(pending.current), []);
  const change = (text) => {
    setDraft(text);
    clearTimeout(pending.current);
    pending.current = setTimeout(() => onChange(text), 180);
  };
  const clear = () => {
    clearTimeout(pending.current);
    setDraft("");
    onClear();
  };
  return <>
    <input
      type="text"
      aria-label="Buscar pedidos"
      placeholder={placeholder}
      value={draft}
      onChange={event => change(event.target.value)}
      className="flex-1 bg-transparent border-0 outline-none text-[12.5px] text-sidebar-foreground placeholder:text-muted-foreground min-w-0"
    />
    {draft && <button type="button" onClick={clear} title="Limpar pesquisa" className="p-0.5 text-sidebar-foreground/70 hover:text-sidebar-foreground rounded transition-colors shrink-0">
      <X className="w-3.5 h-3.5" />
    </button>}
  </>;
}