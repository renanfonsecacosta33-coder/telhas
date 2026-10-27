import { processarOdooWebhookCore } from '../../shared/processarOdooWebhookCore.ts';

/**
 * Webhook Dedicado Central PCP Ponta Grossa (POST /functions/odooWebhookPontaGrossa)
 * Destina pedidos para a filial de Ponta Grossa.
 */
export default async function(req: Request): Promise<Response> {
  return processarOdooWebhookCore(req, "Ponta Grossa");
}