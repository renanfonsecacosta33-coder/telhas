import { processarOdooWebhookCore } from '../../shared/processarOdooWebhookCore.ts';

/**
 * Webhook Dedicado Central PCP Pinhais (POST /functions/odooWebhookPinhais)
 * Destina pedidos de telhas diretamente para a fila de Pinhais.
 * Proteção fabril: Re-roteia automaticamente Corte & Dobra e Frisadas para a Matriz AJL.
 */
export default async function(req: Request): Promise<Response> {
  return processarOdooWebhookCore(req, "Pinhais");
}