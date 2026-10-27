import { processarOdooWebhookCore } from '../../shared/processarOdooWebhookCore.ts';

/**
 * Webhook Dedicado Central PCP Matriz AJL (POST /functions/odooWebhookMatriz)
 * Destina pedidos diretamente para a fábrica e matriz principal da AJL.
 */
export default async function(req: Request): Promise<Response> {
  return processarOdooWebhookCore(req, "Matriz AJL");
}