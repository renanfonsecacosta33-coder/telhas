import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, AlertTriangle, ShieldCheck, Play, Check, UserPlus, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import NovoOperadorModal from "@/components/usuarios/NovoOperadorModal";

export function getMinimoOperadoresPorMaquina(maquinaNome = "") {
  const m = String(maquinaNome).toUpperCase();
  // Máquinas que exigem no mínimo 2 operadores:
  // Guilhotinas (Corte 3m, Corte 6m), Dobradeiras (Dobra 3m, Dobra 6m Fundo/Início) e Colagem
  if (
    m.includes("CORTE") ||
    m.includes("GUILHOTINA") ||
    m.includes("DOBRA") ||
    m.includes("COLAGEM")
  ) {
    return 2;
  }
  return 1;
}

function isOperadorDaMaquina(usuario, maquinaNome = "") {
  if (!usuario || !maquinaNome) return false;
  const maqNorm = String(maquinaNome).toUpperCase().replace(/[\s-]/g, "");
  let maquinas = [];
  try {
    if (Array.isArray(usuario.maquinas)) maquinas = usuario.maquinas;
    else if (typeof usuario.maquina === "string") {
      try {
        const p = JSON.parse(usuario.maquina);
        if (Array.isArray(p)) maquinas = p;
        else maquinas = [usuario.maquina];
      } catch {
        maquinas = [usuario.maquina];
      }
    }
  } catch {}
  return maquinas.some(m => String(m).toUpperCase().replace(/[\s-]/g, "") === maqNorm);
}

export default function IniciarOpOperadoresDialog({
  open,
  onOpenChange,
  ordem,
  maquinaNome = "",
  onConfirm
}) {
  const [selecionados, setSelecionados] = useState([]);
  const [novoOperadorOpen, setNovoOperadorOpen] = useState(false);

  const maquinaAlvo = maquinaNome || ordem?.maquina || ordem?.maquina_inicial || "";

  const minimoExigido = useMemo(() => {
    return getMinimoOperadoresPorMaquina(maquinaAlvo);
  }, [maquinaAlvo]);

  // Buscar equipe de operadores cadastrados
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["equipe-operadores-dialog"],
    queryFn: async () => {
      try {
        const list = await base44.entities.User.list("-full_name", 100);
        return (list || []).filter(u => !u.nao_operador);
      } catch {
        return [];
      }
    },
    enabled: open
  });

  // Ordenar usuários: operadores configurados para esta máquina aparecem no topo
  const usuariosOrdenados = useMemo(() => {
    return [...usuarios].sort((a, b) => {
      const aDaMaq = isOperadorDaMaquina(a, maquinaAlvo) ? 1 : 0;
      const bDaMaq = isOperadorDaMaquina(b, maquinaAlvo) ? 1 : 0;
      if (bDaMaq !== aDaMaq) return bDaMaq - aDaMaq;
      const nomeA = (a.full_name || a.email || "").toLowerCase();
      const nomeB = (b.full_name || b.email || "").toLowerCase();
      return nomeA.localeCompare(nomeB);
    });
  }, [usuarios, maquinaAlvo]);

  // Resetar seleção ao abrir
  useEffect(() => {
    if (open) {
      // Se a ordem já tem operadores salvos previamente, inicia com eles
      try {
        if (Array.isArray(ordem?.operadores_json) && ordem.operadores_json.length > 0) {
          setSelecionados(ordem.operadores_json.map(o => o.id || o));
          return;
        }
      } catch {}
      setSelecionados([]);
    }
  }, [open, ordem]);

  const toggleUsuario = (u) => {
    setSelecionados(prev => {
      const exists = prev.some(id => id === u.id);
      if (exists) {
        return prev.filter(id => id !== u.id);
      } else {
        return [...prev, u.id];
      }
    });
  };

  const atendido = selecionados.length >= minimoExigido;

  const handleConfirmar = () => {
    if (!atendido) return;
    const listaFinal = usuarios
      .filter(u => selecionados.includes(u.id))
      .map(u => ({
        id: u.id,
        nome: u.full_name || u.email,
        role: u.role || "operador"
      }));

    onConfirm(listaFinal);
    onOpenChange(false);
  };

  const numeroPedidoLabel = ordem?.numero_pedido ? `#${ordem.numero_pedido}` : ordem?.id?.slice(-4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Users className="w-5 h-5 text-primary" />
            Vincular Operadores da Máquina
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione quem irá operar a máquina na ordem <strong>{numeroPedidoLabel}</strong> ({maquinaNome || "Máquina"}).
          </DialogDescription>
        </DialogHeader>

        {/* Aviso de Regra da Máquina */}
        <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
          minimoExigido >= 2
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200"
        }`}>
          {minimoExigido >= 2 ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold block">
              {minimoExigido >= 2 ? "Exigência de 2 Operadores" : "Operador Individual ou Dupla"}
            </span>
            <p className="text-[11px] opacity-90 mt-0.5">
              {minimoExigido >= 2
                ? "Por norma de segurança e manuseio de peças pesadas/longas nesta máquina (Guilhotina / Dobradeira / Colagem), é obrigatório selecionar no mínimo 2 operadores."
                : "Nesta máquina (Desbobinadeira / Perfiladeira de Telha), a operação pode ser realizada por 1 operador ou mais."}
            </p>
          </div>
        </div>

        {/* Lista de Membros da Equipe */}
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
            <span>Selecione os operadores ({selecionados.length}/{minimoExigido} mín):</span>
            <div className="flex items-center gap-2">
              {atendido ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                  <Check className="w-3.5 h-3.5" /> Requisito atendido
                </span>
              ) : (
                <span className="text-rose-600 font-bold text-[11px]">
                  Faltam {minimoExigido - selecionados.length} op.
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNovoOperadorOpen(true)}
                className="h-6 px-2 text-[10px] gap-1 border-dashed border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <UserPlus className="w-3 h-3" />
                Novo Operador
              </Button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {isLoading ? (
              <p className="text-xs text-center py-6 text-muted-foreground">Carregando equipe...</p>
            ) : usuariosOrdenados.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs text-muted-foreground">Nenhum operador cadastrado.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNovoOperadorOpen(true)}
                  className="text-xs gap-1.5 text-emerald-600 border-emerald-500"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Cadastrar Primeiro Operador
                </Button>
              </div>
            ) : (
              usuariosOrdenados.map((u) => {
                const isChecked = selecionados.includes(u.id);
                const eDaMaquina = isOperadorDaMaquina(u, maquinaAlvo);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUsuario(u)}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? "bg-primary/10 border-primary shadow-xs"
                        : eDaMaquina
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                        : "bg-card hover:bg-muted/40 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase ${
                        eDaMaquina
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-foreground"
                      }`}>
                        {(u.full_name || u.email || "OP").slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground">
                            {u.full_name || u.email}
                          </p>
                          {eDaMaquina && (
                            <Badge className="text-[9px] py-0 px-1.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-current" /> Máquina
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {u.setor ? u.setor.replace("_", " ") : "Fábrica"} · {u.role || "operador"}
                        </p>
                      </div>
                    </div>

                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleUsuario(u)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmar}
            disabled={!atendido}
            className="gap-2 bg-primary text-primary-foreground font-semibold"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Iniciar com Equipe ({selecionados.length})
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modal para cadastrar novo operador inline */}
      <NovoOperadorModal
        open={novoOperadorOpen}
        onOpenChange={setNovoOperadorOpen}
        defaultSetor={ordem?._setor === "Corte e Dobra" ? "corte_dobra" : "telhas"}
        defaultMaquina={maquinaAlvo}
        onSuccess={(novoOp) => {
          if (novoOp?.id) {
            setSelecionados(prev => [...prev, novoOp.id]);
          }
        }}
      />
    </Dialog>
  );
}
