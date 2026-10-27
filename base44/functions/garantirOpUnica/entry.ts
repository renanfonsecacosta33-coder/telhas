// CRIAÇÃO DE OP À PROVA DE DUPLICAÇÃO (Central PCP → máquinas).
// Recebe os dados da OP + a chave de deduplicação (OF exata + índices do item),
// verifica no SERVIDOR com dados frescos e só cria se nenhuma OP viva da mesma
// OF já cobrir o item. Sob corrida concorrente, reconcilia mantendo 1 única OP.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { garantirOpUnica } from '../../shared/opUnicaCore.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole || base44;

    const body = await req.json().catch(() => ({}));
    const { dadosOp, dedup } = body || {};
    if (!dadosOp || !dedup) {
      return Response.json({ error: 'Parâmetros obrigatórios: dadosOp e dedup' }, { status: 400 });
    }

    const resultado = await garantirOpUnica(db, { dadosOp, dedup });
    return Response.json(resultado);
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
