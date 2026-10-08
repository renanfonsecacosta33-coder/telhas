import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PackageCheck,
  Boxes,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  Info,
  Plus,
  ZapOff,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function CumeeiraEstoqueDialog({
  open,
  onOpenChange,
  pedido,
  onConfirmar,
}) {
  const [quantidade, setQuantidade] = useState(1);
  const [selectedProdutoId, setSelectedProdutoId] = useState("direto");
  const [observacao, setObservacao] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modo criar novo item no estoque se desejar
  const [modoCriarNovo, setModoCriarNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoEstoqueInicial, setNovoEstoqueInicial] = useState("");

  // Busca produtos cadastrados com categoria "Cumeeira"
  const { data: produtos = [], isLoading, refetch } = useQuery({
    queryKey: ["produtos-cumeeira"],
    queryFn: async () => {
      try {
        const list = await base44.entities.Produto.list("-created_date").catch(() => []);
        return (list || []).filter((p) => p.categoria === "Cumeeira");
      } catch (err) {
        console.warn("[CumeeiraEstoqueDialog] Erro ao carregar produtos:", err);
        return [];
      }
    },
    enabled: Boolean(open),
  });

  // Calcula quantidade sugerida do pedido
  useEffect(() => {
    if (!pedido || !open) return;

    let qtd = 0;
    try {
      const vars = JSON.parse(pedido.variacoes_telhas || "[]");
      if (Array.isArray(vars) && vars.length > 0) {
        qtd = vars.reduce((sum, v) => sum + (Number(v.qty) || 0), 0);
      }
    } catch {}

    if (!qtd) {
      qtd = Number(pedido.quantidade_telhas) || Number(pedido.metros) || Number(pedido.quantidade) || 1;
    }

    setQuantidade(qtd > 0 ? qtd : 1);
    setObservacao("");
    setModoCriarNovo(false);

    // Tenta encontrar um produto correspondente pela cor ou descrição
    if (produtos.length > 0) {
      const pedCor = String(pedido.cor || "").trim().toLowerCase();
      const pedProd = String(pedido.produto || pedido.modelo || "").trim().toLowerCase();

      const match = produtos.find((p) => {
        const prodCor = String(p.cor || "").trim().toLowerCase();
        const prodNome = String(p.nome || "").trim().toLowerCase();
        if (pedCor && prodCor && prodCor === pedCor) return true;
        if (pedCor && prodNome.includes(pedCor)) return true;
        if (pedProd && prodNome.includes(pedProd)) return true;
        return false;
      });

      if (match) {
        setSelectedProdutoId(match.id);
      } else {
        setSelectedProdutoId(produtos[0]?.id || "direto");
      }
    } else {
      setSelectedProdutoId("direto");
    }
  }, [pedido, open, produtos]);

  const produtoSelecionado = useMemo(() => {
    if (!selectedProdutoId || selectedProdutoId === "direto" || selectedProdutoId === "novo") {
      return null;
    }
    return produtos.find((p) => p.id === selectedProdutoId) || null;
  }, [produtos, selectedProdutoId]);

  const saldoAtual = Number(produtoSelecionado?.quantidade) || 0;
  const qtdNum = Math.max(1, Number(quantidade) || 1);
  const saldoProjetado = saldoAtual - qtdNum;

  const handleConfirmar = async () => {
    if (qtdNum <= 0) {
      toast.error("Informe uma quantidade válida de peças.");
      return;
    }

    setIsSubmitting(true);
    try {
      let produtoEstoqueFinal = produtoSelecionado;

      // Se o usuário optou por cadastrar um novo item no estoque agora
      if (modoCriarNovo && novoNome.trim()) {
        const estoqueIni = Number(novoEstoqueInicial) || qtdNum;
        const novoSaldo = Math.max(0, estoqueIni - qtdNum);
        const novoProduto = await base44.entities.Produto.create({
          categoria: "Cumeeira",
          nome: novoNome.trim(),
          cor: pedido?.cor || "",
          quantidade: novoSaldo,
          unidade: "un",
          observacoes: `Criado automaticamente na separação do Pedido #${pedido?.numero_pedido || pedido?.id}`,
        });
        produtoEstoqueFinal = novoProduto;
        await refetch();
      } else if (produtoSelecionado) {
        // Atualiza a quantidade do produto existente no estoque
        const novoSaldo = Math.max(0, saldoAtual - qtdNum);
        await base44.entities.Produto.update(produtoSelecionado.id, {
          quantidade: novoSaldo,
        });
        await refetch();
      }

      await onConfirmar({
        quantidade: qtdNum,
        produtoEstoque: produtoEstoqueFinal,
        observacao: observacao.trim(),
      });

      onOpenChange(false);
    } catch (err) {
      console.error("[CumeeiraEstoqueDialog] Falha ao baixar estoque:", err);
      toast.error("Erro ao registrar baixa no estoque: " + (err?.message || "Tente novamente"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-teal-200 dark:border-teal-900 shadow-2xl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2.5 text-teal-800 dark:text-teal-300 text-lg">
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shadow-xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <span>Atender Cumeeira do Estoque Físico</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Separação direta das peças prontas do estoque físico no galpão.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Resumo do Pedido */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-800 dark:text-slate-100">
                  Pedido #{pedido.numero_pedido || pedido.id}
                </span>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-teal-700 border-teal-300 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30">
                  Cumeeira
                </Badge>
              </div>
              <span className="text-xs font-semibold text-slate-500 truncate max-w-[180px]">
                {pedido.cliente || "Cliente não informado"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
              <div>
                <span className="text-muted-foreground block text-[11px]">Material / Cor:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {pedido.cor || "Natural (Galvalume)"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Modelo:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {pedido.modelo || pedido.produto || "Cumeeira"}
                </span>
              </div>
            </div>
          </div>

          {/* Garantia: Sem Consumo de Bobina */}
          <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-emerald-900 dark:text-emerald-200 text-xs">
            <ZapOff className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">Zero consumo de bobina virgem</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                A máquina e o desbobinador não serão acionados. O pedido será concluído e enviado à expedição.
              </p>
            </div>
          </div>

          {/* Quantidade a Baixar */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span>Quantidade a Retirar do Estoque *</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Peças físicas
              </span>
            </Label>
            <div className="relative">
              <Input
                type="number"
                min="1"
                step="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="text-lg font-bold text-teal-800 dark:text-teal-200 pl-3 pr-16 h-11"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                peças (un)
              </span>
            </div>
          </div>

          {/* Seleção do Item no Catálogo de Estoque */}
          {!modoCriarNovo ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-teal-600" />
                  Item no Catálogo de Estoque
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setModoCriarNovo(true);
                    setNovoNome(`Cumeeira ${pedido.modelo || pedido.produto || ""} ${pedido.cor || "Natural"}`.trim());
                    setNovoEstoqueInicial(String(qtdNum + 20));
                  }}
                  className="text-[11px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Cadastrar novo item
                </button>
              </div>

              {isLoading ? (
                <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  Consultando catálogo de cumeeiras...
                </div>
              ) : produtos.length > 0 ? (
                <Select value={selectedProdutoId} onValueChange={setSelectedProdutoId}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Selecione o produto de cumeeira" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direto">
                      📦 Baixa Direta no Galpão (Sem alterar saldo do catálogo)
                    </SelectItem>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} {p.cor ? `(${p.cor})` : ""} — Saldo: {p.quantidade ?? 0} {p.unidade || "un"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Nenhuma cumeeira cadastrada no catálogo digital ainda.</p>
                    <p className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-300">
                      Você pode confirmar como <strong>Baixa Direta</strong> ou clicar em "+ Cadastrar novo item" para iniciar o controle de saldo.
                    </p>
                  </div>
                </div>
              )}

              {/* Simulação de Saldo se houver produto selecionado */}
              {produtoSelecionado && (
                <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center justify-between ${saldoProjetado < 0 ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300" : "bg-teal-50/60 border-teal-200 text-teal-800 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-200"}`}>
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />
                    <span>
                      Saldo em estoque: <strong>{saldoAtual} un</strong> ➔ Após baixa: <strong>{Math.max(0, saldoProjetado)} un</strong>
                    </span>
                  </div>
                  {saldoProjetado < 0 && (
                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                      Saldo insuficiente ({saldoProjetado} un)
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Formulário rápido para cadastrar novo item no estoque */
            <div className="bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Novo Item no Catálogo
                </span>
                <button
                  type="button"
                  onClick={() => setModoCriarNovo(false)}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  Cancelar cadastro
                </button>
              </div>

              <div>
                <Label className="text-[11px]">Descrição do Produto *</Label>
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: Cumeeira TR 25 Natural 0.43"
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-[11px]">Estoque Físico Total Atual (un)</Label>
                <Input
                  type="number"
                  value={novoEstoqueInicial}
                  onChange={(e) => setNovoEstoqueInicial(e.target.value)}
                  placeholder="Ex: 50"
                  className="h-8 text-xs mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  O sistema subtrairá as {qtdNum} peças deste total.
                </p>
              </div>
            </div>
          )}

          {/* Observações Opcionais */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-600 dark:text-slate-300">
              Observação da Separação (Opcional)
            </Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Separado do palete da área B pelo operador..."
              className="text-xs h-9"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={isSubmitting || qtdNum <= 0}
            className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4" />
                Confirmar Baixa do Estoque ({qtdNum} peças)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
