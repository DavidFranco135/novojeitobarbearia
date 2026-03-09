// ============================================================
// src/services/whatsapp.ts — Integração WhatsApp Cloud API (Meta)
// ============================================================
// Configure no arquivo .env na raiz do projeto:
//   VITE_WHATSAPP_TOKEN=seu_token_aqui
//   VITE_WHATSAPP_PHONE_ID=seu_phone_number_id_aqui
// ============================================================

const WHATSAPP_TOKEN  = import.meta.env.VITE_WHATSAPP_TOKEN   as string;
const PHONE_NUMBER_ID = import.meta.env.VITE_WHATSAPP_PHONE_ID as string;
const API_URL         = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// ── Formata número para padrão E.164 (55 + DDD + número) ─────
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

// ── Formata data YYYY-MM-DD → DD/MM/YYYY ─────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Função base de envio de template ─────────────────────────
async function sendTemplate(
  to: string,
  templateName: string,
  params: string[]
): Promise<void> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[WhatsApp] Token ou Phone ID não configurados no .env');
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
      console.error(`[WhatsApp] Erro ao enviar "${templateName}" para ${phone}:`, err);
    } else {
      console.log(`[WhatsApp] ✅ "${templateName}" enviado para ${phone}`);
    }
  } catch (error) {
    console.error(`[WhatsApp] Falha na requisição "${templateName}":`, error);
  }
}

// ============================================================
// FUNÇÕES PÚBLICAS — disparadas pelo store.ts e Subscriptions
// ============================================================

/**
 * confirmacao_agendamento
 * Dispara: quando um agendamento é criado
 * Vars: {{cliente_nome}} {{servico}} {{barbeiro}} {{data}} {{horario}}
 */
export async function wppConfirmacaoAgendamento(
  phone: string,
  clientName: string,
  serviceName: string,
  professionalName: string,
  date: string,
  time: string
): Promise<void> {
  await sendTemplate(phone, 'confirmacao_agendamento', [
    clientName,
    serviceName,
    professionalName,
    formatDate(date),
    time,
  ]);
}

/**
 * lembrete_24h
 * Dispara: 24h antes do agendamento (Cloud Function scheduled)
 * Vars: {{cliente_nome}} {{servico}} {{barbeiro}} {{horario}}
 */
export async function wppLembrete24h(
  phone: string,
  clientName: string,
  serviceName: string,
  professionalName: string,
  time: string
): Promise<void> {
  await sendTemplate(phone, 'lembrete_24h', [
    clientName,
    serviceName,
    professionalName,
    time,
  ]);
}

/**
 * lembrete_1h
 * Dispara: 1h antes do agendamento (Cloud Function scheduled)
 * Vars: {{cliente_nome}} {{servico}} {{barbeiro}} {{horario}}
 */
export async function wppLembrete1h(
  phone: string,
  clientName: string,
  serviceName: string,
  professionalName: string,
  time: string
): Promise<void> {
  await sendTemplate(phone, 'lembrete_1h', [
    clientName,
    serviceName,
    professionalName,
    time,
  ]);
}

/**
 * pos_atendimento
 * Dispara: quando status muda para CONCLUIDO_PAGO
 * Vars: {{cliente_nome}} {{link_avaliacao}}
 */
export async function wppPosAtendimento(
  phone: string,
  clientName: string,
  linkAvaliacao: string
): Promise<void> {
  await sendTemplate(phone, 'pos_atendimento', [
    clientName,
    linkAvaliacao,
  ]);
}

/**
 * vencimento_plano_vip_3dias
 * Dispara: 3 dias antes do vencimento da assinatura (Cloud Function scheduled)
 * Vars: {{cliente_nome}} {{data_vencimento}} {{link_renovacao}}
 */
export async function wppVencimentoVip3dias(
  phone: string,
  clientName: string,
  endDate: string,
  linkRenovacao: string
): Promise<void> {
  await sendTemplate(phone, 'vencimento_plano_vip_3dias', [
    clientName,
    formatDate(endDate),
    linkRenovacao,
  ]);
}

/**
 * vencimento_plano_vip_1dia
 * Dispara: 1 dia antes do vencimento da assinatura (Cloud Function scheduled)
 * Vars: {{cliente_nome}} {{data_vencimento}} {{link_renovacao}}
 */
export async function wppVencimentoVip1dia(
  phone: string,
  clientName: string,
  endDate: string,
  linkRenovacao: string
): Promise<void> {
  await sendTemplate(phone, 'vencimento_plano_vip_1dia', [
    clientName,
    formatDate(endDate),
    linkRenovacao,
  ]);
}

/**
 * cliente_inativo
 * Dispara: clientes sem visita há 30+ dias (Cloud Function — toda segunda)
 * Vars: {{cliente_nome}} {{dias_ausente}} {{link_agendamento}}
 */
export async function wppClienteInativo(
  phone: string,
  clientName: string,
  diasAusente: number,
  linkAgendamento: string
): Promise<void> {
  await sendTemplate(phone, 'cliente_inativo', [
    clientName,
    String(diasAusente),
    linkAgendamento,
  ]);
}

/**
 * novo_agendamento_barbeiro
 * Dispara: quando barbeiro recebe novo agendamento
 * Vars: {{barbeiro_nome}} {{cliente_nome}} {{servico}} {{horario}} {{data}}
 */
export async function wppNovoAgendamentoBarbeiro(
  phone: string,
  barbeiroNome: string,
  clientName: string,
  serviceName: string,
  time: string,
  date: string
): Promise<void> {
  await sendTemplate(phone, 'novo_agendamento_barbeiro', [
    barbeiroNome,
    clientName,
    serviceName,
    time,
    formatDate(date),
  ]);
}

/**
 * agenda_diaria_barbeiro
 * Dispara: todo dia às 07:00 (Cloud Function scheduled)
 * Vars: {{barbeiro_nome}} {{data}} {{agenda_resumo}} {{total_agendamentos}}
 */
export async function wppAgendaDiariaBarbeiro(
  phone: string,
  barbeiroNome: string,
  data: string,
  agendaResumo: string,
  totalAgendamentos: number
): Promise<void> {
  await sendTemplate(phone, 'agenda_diaria_barbeiro', [
    barbeiroNome,
    data,
    agendaResumo,
    String(totalAgendamentos),
  ]);
}