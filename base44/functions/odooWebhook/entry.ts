import { processarOdooWebhookCore } from '../../shared/processarOdooWebhookCore.ts';

/**
 * Webhook Geral de Integração com o Odoo ERP (POST /functions/odooWebhook)
 * Executa o roteamento industrial dinâmico e inteligente da AJL Ferro & Aço.
 */
export default async function(req: Request): Promise<Response> {
  return processarOdooWebhookCore(req);
}
