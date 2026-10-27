import React from "react";
import { ChevronDown } from "lucide-react";
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { PrioridadeBadge, isPedidoRetiraAgora, isPedidoRota } from "@/lib/prioridadeHelper";
import { detectarOrigemAco } from "@/components/producao/BadgeOrigemAco";

const STATUS_MINI = {
  pendente: { label: "Pendente", cls: "op-status-pendente" },
  aguardando_material: { label: "Sem Material", cls: "op-status-material" },
};

/**
 * Card de OP "Foco no Turno" — resumo da OP pendente no painel da máquina.
 * O total de metros é o herói; material (cor/espessura/origem) fica em bloco próprio.
 * A barra de ações (Rota, Prioridade, Data, Histórico, Editar, Excluir) entra pela prop `toolbar`.
 */
export default function PedidoMiniCard({ pedido: p, onExpand, toolbar = null }) {
  const st = STATUS_MINI[p.status] || STATUS_MINI.pendente;

  let variacoes = [];
  try { const v = JSON.parse(p.variacoes_telhas || "[]"); if (Array.isArray(v)) variacoes = v; } catch { variacoes = []; }
  const qtdPecas = variacoes.length > 0
    ? variacoes.reduce((s, v) => s + (Number(v.qty) || 0), 0)
    : (p.quantidade_telhas || 0);
  const qtdMedidas = variacoes.length > 0 ? variacoes.length : (p.metragem_mm ? 1 : 1);
  const totalMetros = calcularMetrosPedido(p);
  const espessura = p.espessura_exigida || (() => { const m = String(p.bobina_superior || p.bobina_descricao || "").match(/(\d+[.,]?\d*)\s*mm/i); return m ? m[1] : ""; })();
  const cor = p.cor_exigida || p.rvm_superior || "";
  const ehRetira = isPedidoRetiraAgora(p);
  const ehRota = isPedidoRota(p);
  const titulo = [p.produto || "TELHA", p.modelo].filter(Boolean).join(" ");
  const subtitulo = p.maquina || p.maquina_origem || "Máquina";
  const origem = (() => {
    const info = detectarOrigemAco({ bobinaTexto: p.bobina_superior || p.bobina_descricao, origemExigida: p.origem_exigida });
    return info.isImportado ? "Importado" : "Nacional";
  })();

  return (
    <div className="op-card-turno">
      {toolbar && (
        <div className="op-top">
          {toolbar}
        </div>
      )}

      <div className="op-main">
        <div className="op-info">
          <div className="op-ident">
            <span className="op-so">{p.numero_pedido || `OP ${String(p.id || "").slice(-6).toUpperCase()}`}</span>
            <span className={`op-status ${st.cls}`}>{st.label}</span>
            <PrioridadeBadge pedido={p} />
            {ehRota && !ehRetira && <span className="op-tag op-tag-rota">🚚 Rota</span>}
            {ehRetira && <span className="op-tag op-tag-retira">Retira Agora</span>}
          </div>

          <h2 className="op-title">{titulo}</h2>

          <div className="op-subtitle">{subtitulo}</div>

          <div className="op-numbers">
            <div className="op-total">
              <span className="op-label">Total</span>
              <div className="op-total-value">
                <span className="op-number">
                  {totalMetros > 0 ? Number(totalMetros).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                </span>
                <span className="op-unit">metros</span>
              </div>
            </div>
            <div className="op-stat">
              <div className="op-stat-item">
                <span className="op-label">Qtd. Peças</span>
                <span className="op-stat-value">{qtdPecas || "—"}</span>
              </div>
              <div className="op-stat-item">
                <span className="op-label">Medidas</span>
                <span className="op-stat-value">{qtdMedidas}</span>
              </div>
            </div>
          </div>

          <button type="button" className="op-detail-link" onClick={onExpand}>
            Ver detalhes <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <div className="op-people">
            <div className="op-person">
              <span className="op-label">Cliente</span>
              <strong>{p.cliente || "—"}</strong>
            </div>
            <div className="op-person">
              <span className="op-label">Vendedor</span>
              <strong>{p.vendedor || p.vendedor_nome || "—"}</strong>
            </div>
          </div>
        </div>

        <div className="op-material">
          <div className="op-field">
            <span className="op-label">Cor</span>
            <strong>{cor || "—"}</strong>
          </div>
          <div className="op-field">
            <span className="op-label">Espessura</span>
            <strong>{espessura ? `${espessura} mm` : "—"}</strong>
          </div>
          <div className="op-field">
            <span className="op-label">Origem</span>
            <strong>{origem}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}