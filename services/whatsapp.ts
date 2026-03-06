// ============================================================
// services/whatsapp.ts — Integração WhatsApp Cloud API (Meta)
// ============================================================
// Variáveis de ambiente necessárias no .env:
//   VITE_WHATSAPP_TOKEN=seu_token_aqui
//   VITE_WHATSAPP_PHONE_ID=seu_phone_number_id_aqui
// ============================================================

const WHATSAPP_TOKEN   = import.meta.env.VITE_WHATSAPP_TOKEN   as string;
const PHONE_NUMBER_ID  = import.meta.env.VITE_WHATSAPP_PHONE_ID as string;
const API_URL          = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// ── Formata número para padrão E.164 (55 + DDD + número) ─────
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

// ── Função base de envio de template ─────────────────────────
async function sendTemplate(
  to: string,
  templateName: string,
  params: string[]
): Promise<void> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[WhatsApp] Token ou Phone ID não configurados. Mensagem não enviada.');
    return;
  }

  const phone = formatPhone(to);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: params.map(text => ({ type: 'text', text })),
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('[WhatsApp] Erro ao enviar mensagem:', err);
    }
  } catch (error) {
    console.error('[WhatsApp] Falha na requisição:', error);
  }
}

// ============================================================
// FUNÇÕES PÚBLICAS — uma por template
// ============================================================

/**
 * Template: novo_agendamento
 * Disparado quando: cliente faz um novo agendamento
 * Params: {{1}} Nome, {{2}} Serviço, {{3}} Data, {{4}} Horário, {{5}} Profissional
 */
export async function wppNovoAgendamento(
  phone: string,
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  professionalName: string
): Promise<void> {
  // Formata a data de YYYY-MM-DD para DD/MM/YYYY
  const [y, m, d] = date.split('-');
  const formattedDate = `${d}/${m}/${y}`;

  await sendTemplate(phone, 'novo_agendamento', [
    clientName,
    serviceName,
    formattedDate,
    time,
    professionalName,
  ]);
}

/**
 * Template: lembrete_agendamento
 * Disparado quando: 24h antes do agendamento (cron no store)
 * Params: {{1}} Nome, {{2}} Serviço, {{3}} Horário, {{4}} Profissional
 */
export async function wppLembreteAgendamento(
  phone: string,
  clientName: string,
  serviceName: string,
  time: string,
  professionalName: string
): Promise<void> {
  await sendTemplate(phone, 'lembrete_agendamento', [
    clientName,
    serviceName,
    time,
    professionalName,
  ]);
}

/**
 * Template: reagendamento_confirmado
 * Disparado quando: agendamento é remarcado
 * Params: {{1}} Nome, {{2}} Serviço, {{3}} Nova Data, {{4}} Novo Horário
 */
export async function wppReagendamento(
  phone: string,
  clientName: string,
  serviceName: string,
  newDate: string,
  newTime: string
): Promise<void> {
  const [y, m, d] = newDate.split('-');
  const formattedDate = `${d}/${m}/${y}`;

  await sendTemplate(phone, 'reagendamento_confirmado', [
    clientName,
    serviceName,
    formattedDate,
    newTime,
  ]);
}

/**
 * Template: assinatura_ativada
 * Disparado quando: nova assinatura é criada
 * Params: {{1}} Nome, {{2}} Plano, {{3}} Data de vencimento
 */
export async function wppAssinaturaAtivada(
  phone: string,
  clientName: string,
  planName: string,
  endDate: string
): Promise<void> {
  const [y, m, d] = endDate.split('-');
  const formattedDate = `${d}/${m}/${y}`;

  await sendTemplate(phone, 'assinatura_ativada', [
    clientName,
    planName,
    formattedDate,
  ]);
}

/**
 * Template: lembrete_15min
 * Disparado quando: 15 minutos antes do agendamento (setInterval no store)
 * Params: {{1}} Nome, {{2}} Serviço, {{3}} Horário, {{4}} Profissional
 */
export async function wppLembrete15min(
  phone: string,
  clientName: string,
  serviceName: string,
  time: string,
  professionalName: string
): Promise<void> {
  await sendTemplate(phone, 'lembrete_15min', [
    clientName,
    serviceName,
    time,
    professionalName,
  ]);
}

/**
 * Template: assinatura_vencendo
 * Disparado quando: assinatura vence em 3 dias (cron no store)
 * Params: {{1}} Nome, {{2}} Plano, {{3}} Dias restantes, {{4}} Data de vencimento
 */
export async function wppAssinaturaVencendo(
  phone: string,
  clientName: string,
  planName: string,
  daysLeft: number,
  endDate: string
): Promise<void> {
  const [y, m, d] = endDate.split('-');
  const formattedDate = `${d}/${m}/${y}`;

  await sendTemplate(phone, 'assinatura_vencendo', [
    clientName,
    planName,
    String(daysLeft),
    formattedDate,
  ]);
}
