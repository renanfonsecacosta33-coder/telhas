export default function normalizarStatusItem(item) {
  const status = String(item?.status || "pendente").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (item?.concluido === true || /^(concluido|finalizado)(?:$|\s)/.test(status)) return "concluido";
  if (/aguardando.*colagem/.test(status)) return "aguardando_colagem";
  if (/^(em_producao|em producao|executando)/.test(status)) return "em_producao";
  if (/^pausad/.test(status)) return "pausado";
  if (/^aguardando.*material/.test(status)) return "aguardando_material";
  if (/^aguardando.*corte/.test(status)) return "aguardando_corte";
  if (/^(distribuido|aguardando inicio|aguardando revisao|na maquina)/.test(status)) return "distribuido";
  return "pendente";
}