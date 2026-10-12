import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Home, Loader2, Pencil, RefreshCw, Scissors, Wind } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { stripHtml } from "@/lib/stripHtml";
import { classGrupo } from "@/lib/pedidoOdooHelper";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";

const OPCOES = [
  { valor: "telha", label: "🏠 Fábrica de Telhas", desc: "Desbobinador, perfiladeiras e colagem", Icon: Home },
  { valor: "cd", label: "🏭 Corte & Dobra", desc: "Guilhotina, dobradeiras e slitter", Icon: Scissors },
  { valor: "frisada", label: "🌬️ Frisada", desc: "Frisadas e lambris (expedição)", Icon: Wind },
  { valor: null, label: "🔁 Automático (regra Odoo)", desc: "Volta à detecção automática de setor", Icon: RefreshCw },
];

const LABEL_SETOR = { telha: "Fábrica de Telhas", cd: "Corte & Dobra", frisada: "Frisada" };

// Botão protegido por PIN do Gestor (0000) para o PCP mudar manualmente
// onde o item será fabricado. Grava "setor_forcado" no item do itens_json —
// soberano sobre a detecção automática e preservado nos reenvios do Odoo.
export default function AlterarSetorItemButton({ pedido, item, idx, compacto = false }) {
  const [pinOpen, setPinOpen] = useState(false);
  const [escolhaOpen, setEscolhaOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const salvar = async (valor) => {
    if (!pedido?.id) return;
    setSalvando(true);
    try {
      let itens = [];
      try { itens = JSON.parse(pedido.itens_json || "[]"); } catch { itens = []; }
      if (!itens[idx]) throw new Error("Item não encontrado no pedido.");
      if (valor) itens[idx].setor_forcado = valor;
      else delete itens[idx].setor_forcado;

      // Recalcula as contagens por setor com a mesma regra da classificação
      let telha = 0, cd = 0, frisada = 0;
      itens.forEach((i) => {
        const g = classGrupo(i);
        if (g === "cd") cd++;
        else if (g === "frisada") frisada++;
        else telha++;
      });

      const de = LABEL_SETOR[item.setor_forcado] || "Automático";
      const para = LABEL_SETOR[valor] || "Automático";

      let historico = [];
      try { historico = JSON.parse(pedido.historico_log || "[]"); } catch { historico = []; }
      historico.push({
        data: new Date().toISOString(),
        usuario: user?.full_name || "PCP/Gestor",
        acao: "alterar_setor_item",
        detalhes: `Setor de fabricação do item "${stripHtml(item.produto || "")}" alterado de ${de} para ${para} (autorização por PIN).`
      });

      await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: JSON.stringify(itens),
        itens_telha_count: telha,
        itens_cd_count: cd,
        itens_frisada_count: frisada,
        historico_log: JSON.stringify(historico)
      });

      toast.success(`Setor alterado para ${para}`);
      setEscolhaOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    } catch (err) {
      toast.error("Falha ao alterar o setor", { description: err?.message || "Tente novamente." });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        title="Alterar onde o item será feito (exige PIN do Gestor)"
        onClick={(e) => {
          e.stopPropagation();
          setPinOpen(true);
        }}
        className={`inline-flex items-center justify-center shrink-0 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-400 transition-colors ${compacto ? "w-4 h-4" : "w-[18px] h-[18px]"}`}
      >
        <Pencil className={compacto ? "w-2 h-2" : "w-2.5 h-2.5"} />
      </button>

      <SenhaGestorDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onAutorizado={() => setEscolhaOpen(true)}
        titulo="Alterar Setor de Fabricação"
        descricao="Digite o PIN de liberação do PCP/Gestor para mudar onde este item será fabricado."
        aviso="Alterar o setor de fabricação de um item exige autorização."
        iconeAviso={Pencil}
      />

      <Dialog open={escolhaOpen} onOpenChange={(o) => !salvando && setEscolhaOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Onde este item será feito?</DialogTitle>
            <DialogDescription className="font-semibold">{stripHtml(item?.produto || "")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            {OPCOES.map((op) => (
              <button
                key={op.label}
                type="button"
                disabled={salvando}
                onClick={() => salvar(op.valor)}
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <op.Icon className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{op.label}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{op.desc}</span>
                </span>
              </button>
            ))}
          </div>
          {salvando && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}