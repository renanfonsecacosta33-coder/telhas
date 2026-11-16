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
import { Input } from "@/components/ui/input";
import { Users, AlertTriangle, ShieldCheck, Play, Check, UserPlus, Star, Zap, UserCheck } from "lucide-react";
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
  titulo = "",
  descricao = "",
  modoTroca = false,
  onConfirm
}) {
  const [selecionados, setSelecionados] = useState([]);
  const [novoOperadorOpen, setNovoOperadorOpen] = useState(false);
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [ultimoOperador, setUltimoOperador] = useState(null);

  const maquinaAlvo = maquinaNome || ordem?.maquina || ordem?.maquina_inicial || "";
  const storageKey = `ultimo_operador_${String(maquinaAlvo).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

  const minimoExigido = useMemo(() => {
    // No modo troca, 1 operador já basta
    if (modoTroca) return 1;
    return getMinimoOperadoresPorMaquina(maquinaAlvo);
  }, [maquinaAlvo, modoTroca]);

  // Carregar último operador memorizado nesta máquina
  useEffect(() => {
    if (open) {
      try {
        const salvo = localStorage.getItem(storageKey);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (parsed && (parsed.nome || parsed.id)) {
            setUltimoOperador(parsed);
          }
        }
      } catch {}
    }
  }, [open, storageKey]);

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
      setNomeAvulso("");
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

  const salvarUltimoOperadorMemoria = (listaFinal) => {
    try {
      if (listaFinal && listaFinal.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(listaFinal[0]));
      }
    } catch {}
  };

  const confirmarLista = (listaFinal) => {
    salvarUltimoOperadorMemoria(listaFinal);
    onConfirm(listaFinal);
    onOpenChange(false);
  };

  const handleCardClick = (u) => {
    // Em máquinas que exigem apenas 1 operador (ou em modo troca), 1 toque já seleciona e conclui!
    if (minimoExigido === 1) {
      const lista = [{
        id: u.id,
        nome: u.full_name || u.email,
        role: u.role || "operador"
      }];
      confirmarLista(lista);
      return;
    }

    // Em máquinas com 2 operadores (dupla rápida)
    setSelecionados(prev => {
      const exists = prev.some(id => id === u.id);
      const novos = exists ? prev.filter(id => id !== u.id) : [...prev, u.id];
      // Se atingiu o mínimo de 2 operadores imediatamente ao tocar, auto-confirma com fluidez
      if (novos.length === minimoExigido) {
        const listaDupla = usuarios
          .filter(usr => novos.includes(usr.id))
          .map(usr => ({
            id: usr.id,
            nome: usr.full_name || usr.email,
            role: usr.role || "operador"
          }));
        confirmarLista(listaDupla);
      }
      return novos;
    });
  };

  const toggleUsuario = (u) => {
    setSelecionados(prev => {
      const exists = prev.some(id => id === u.id);
      return exists ? prev.filter(id => id !== u.id) : [...prev, u.id];
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

    confirmarLista(listaFinal);
  };

  const handleConfirmarAvulso = (nomeDigitado) => {
    if (!nomeDigitado) return;
    const lista = [{
      id: `avulso_${Date.now()}`,
      nome: nomeDigitado,
      role: "operador_ajudante"
    }];
    confirmarLista(lista);
  };

  const handleUsarUltimo = () => {
    if (!ultimoOperador) return;
    confirmarLista([ultimoOperador]);
  };

  const numeroPedidoLabel = ordem?.numero_pedido ? `#${ordem.numero_pedido}` : ordem?.id?.slice(-4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-sans p-5 sm:p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Users className="w-5 h-5 text-primary" />
            {titulo || (modoTroca ? "Trocar Operador Responsável" : "Quem está operando esta máquina agora?")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {descricao || (
              <>
                Identifique o operador responsável na ordem <strong>{numeroPedidoLabel}</strong> ({maquinaNome || "Máquina"}).
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Botão de Atalho Rápido: Último Operador Memorizado neste Tablet/Máquina */}
        {ultimoOperador?.nome && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                  Último Operador Desta Máquina
                </span>
                <span className="text-xs font-black text-emerald-950 dark:text-emerald-100 truncate block">
                  {ultimoOperador.nome}
                </span>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleUsarUltimo}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 shrink-0 shadow-xs cursor-pointer gap-1"
            >
              <UserCheck className="w-3.5 h-3.5" /> Usar (1 Toque)
            </Button>
          </div>
        )}

        {/* Aviso de Regra da Máquina */}
        <div className={`p-2.5 rounded-xl border flex items-start gap-2 text-xs ${
          minimoExigido >= 2
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            : "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
        }`}>
          {minimoExigido >= 2 ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold block text-xs">
              {minimoExigido >= 2 ? "Exigência de 2 Operadores (Dupla)" : "Operador Individual (Toque no nome para selecionar)"}
            </span>
            <p className="text-[11px] opacity-90">
              {minimoExigido >= 2
                ? "Por segurança nesta máquina, selecione 2 operadores para iniciar."
                : "Toque diretamente no seu nome abaixo para iniciar em 1 segundo."}
            </p>
          </div>
        </div>

        {/* Lista de Membros da Equipe */}
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
            <span>Operadores Cadastrados {minimoExigido >= 2 ? `(${selecionados.length}/${minimoExigido} mín)` : ""}:</span>
            <div className="flex items-center gap-2">
              {minimoExigido >= 2 && (
                atendido ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                    <Check className="w-3.5 h-3.5" /> Requisito atendido
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold text-[11px]">
                    Faltam {minimoExigido - selecionados.length} op.
                  </span>
                )
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNovoOperadorOpen(true)}
                className="h-6 px-2 text-[10px] gap-1 border-dashed border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <UserPlus className="w-3 h-3" />
                Cadastrar
              </Button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
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
                    onClick={() => handleCardClick(u)}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer select-none active:scale-[0.98] ${
                      isChecked
                        ? "bg-primary/10 border-primary shadow-xs"
                        : eDaMaquina
                        ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 hover:border-emerald-500"
                        : "bg-card hover:bg-muted/50 border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase ${
                        eDaMaquina
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "bg-muted text-foreground"
                      }`}>
                        {(u.full_name || u.email || "OP").slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black text-foreground">
                            {u.full_name || u.email}
                          </p>
                          {eDaMaquina && (
                            <Badge className="text-[9px] py-0 px-1.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-current" /> Máquina
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {u.setor ? u.setor.replace("_", " ") : "Fábrica"} · {u.role || "operador"}
                        </p>
                      </div>
                    </div>

                    {minimoExigido >= 2 ? (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleUsuario(u)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-primary font-bold hover:bg-primary/10"
                      >
                        Selecionar →
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Campo para Digitar Ajudante / Novo Operador Avulso Rápido (Sem travas) */}
          <div className="pt-2 border-t border-border space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block px-1">
              Ou digite o nome caso seja ajudante / temporário:
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="Ex: Lucas Ajudante..."
                value={nomeAvulso}
                onChange={(e) => setNomeAvulso(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nomeAvulso.trim()) {
                    e.preventDefault();
                    handleConfirmarAvulso(nomeAvulso.trim());
                  }
                }}
                className="h-9 text-xs"
              />
              <Button
                type="button"
                size="sm"
                disabled={!nomeAvulso.trim()}
                onClick={() => handleConfirmarAvulso(nomeAvulso.trim())}
                className="h-9 px-3 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" /> Usar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {minimoExigido >= 2 && (
            <Button
              size="sm"
              onClick={handleConfirmar}
              disabled={!atendido}
              className="gap-2 bg-primary text-primary-foreground font-semibold"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Iniciar com Equipe ({selecionados.length})
            </Button>
          )}
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
            handleCardClick(novoOp);
          }
        }}
      />
    </Dialog>
  );
}
