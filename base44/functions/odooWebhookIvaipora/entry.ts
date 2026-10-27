import { processarOdooWebhookCore } from '../../shared/processarOdooWebhookCore.ts';

/**
 * Webhook Dedicado Central PCP Ivaiporã (POST /functions/odooWebhookIvaipora)
 * Destina pedidos de telhas e corte & dobra para a fábrica de Ivaiporã.
 * Proteção fabril: Re-roteia automaticamente Frisadas para a Matriz AJL.
 */
export default async function(req: Request): Promise<Response> {
  return processarOdooWebhookCore(req, "Ivaiporã");
}