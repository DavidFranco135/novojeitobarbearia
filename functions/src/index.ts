// ============================================================
// functions/src/index.ts — Cloud Functions Firebase v2
// Barbearia Novo Jeito — Automação WhatsApp Business API
// ============================================================

import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Região padrão para todas as funções
setGlobalOptions({ region: "us-central1" });

const APP_URL = "https://novojeitobarbearia.pages.dev";

// ─────────────────────────────────────────────────────────────
// TEMPLATES — nomes exatos cadastrados no WhatsApp Manager
// ─────────────────────────────────────────────────────────────
const T = {
  confirmacao:       "confirmacao_agendamento",
  lembrete24h:       "lembrete_24h",
  lembrete1h:        "lembrete_1h",
  posAtendimento:    "pos_atendimento",
  vip3dias:          "vencimento_plano_vip_3dias",
  vip1dia:           "vencimento_plano_vip_1dia",
  vipAtivado:        "adesao_plano_vip",
  clienteInativo:    "cliente_inativo",
  novoAgendBarbeiro: "novo_agendamento_barbeiro",
  agendaDiaria:      "agenda_diaria_barbeiro",
};

// ─────────────────────────────────────────────────────────────
// HELPER — formata YYYY-MM-DD → DD/MM/YYYY
// ─────────────────────────────────────────────────────────────
function fmt(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────
// HELPER — envia mensagem via Meta WhatsApp Cloud API
// ─────────────────────────────────────────────────────────────
async function send(
  toPhone: string,
  template: string,
  params: { name: string; value: string }[]
): Promise<boolean> {
  const phoneId = process.env.PHONE_NUMBER_ID || "";
  const token   = process.env.ACCESS_TOKEN    || "";

  if (!phoneId || !token) {
    console.warn("⚠️  PHONE_NUMBER_ID ou ACCESS_TOKEN não configurados no Cloud Run.");
    return false;
  }

  const cleaned = toPhone.replace(/\D/g, "");
  const number  = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: number,
          type: "template",
          template: {
            name: template,
            language: { code: "pt_BR" },
            components: [{
              type: "body",
              parameters: params.map(({ name, value }) => ({ type: "text", parameter_name: name, text: value })),
            }],
          },
        }),
      }
    );

    const result = await res.json() as any;

    if (!res.ok) {
      console.error(`❌ Erro [${template}] → ${number}:`, JSON.stringify(result?.error || result));
      return false;
    } else {
      console.log(`✅ Enviado [${template}] → ${number}`);
      return true;
    }
  } catch (err) {
    console.error(`❌ Exceção [${template}] → ${number}:`, err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// TRIGGER 1 — Novo agendamento criado
// → Confirmação para CLIENTE
// → Aviso para BARBEIRO
// ─────────────────────────────────────────────────────────────
export const onAppointmentCreated = onDocumentCreated(
  "appointments/{id}",
  async (event) => {
    const a = event.data?.data();
    if (!a || a.status === "CANCELADO") return;

    // 1. Confirmação para o cliente
    if (a.clientPhone) {
      await send(a.clientPhone, T.confirmacao, [
        { name: "cliente_nome", value: a.clientName       || "Cliente"  },
        { name: "servico",      value: a.serviceName      || "Serviço"  },
        { name: "barbeiro",     value: a.professionalName || "Barbeiro" },
        { name: "data",         value: fmt(a.date) },
        { name: "horario",      value: a.startTime        || ""         },
      ]);
    }

    // 2. Aviso para o barbeiro
    if (a.professionalId) {
      const profDoc = await db.collection("professionals").doc(a.professionalId).get();
      const prof    = profDoc.data();
      if (prof?.phone) {
        await send(prof.phone, T.novoAgendBarbeiro, [
          { name: "barbeiro_nome", value: prof.name          || "Barbeiro" },
          { name: "cliente_nome",  value: a.clientName       || "Cliente"  },
          { name: "servico",       value: a.serviceName      || "Serviço"  },
          { name: "horario",       value: a.startTime        || ""         },
          { name: "data",          value: fmt(a.date) },
        ]);
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TRIGGER 2 — Agendamento concluído → pós-atendimento
// ─────────────────────────────────────────────────────────────
export const onAppointmentCompleted = onDocumentUpdated(
  "appointments/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();

    if (!before || !after) return;
    if (before.status === "CONCLUIDO_PAGO") return;
    if (after.status  !== "CONCLUIDO_PAGO") return;
    if (!after.clientPhone) return;

    await send(after.clientPhone, T.posAtendimento, [
      { name: "cliente_nome",   value: after.clientName || "Cliente" },
      { name: "link_avaliacao", value: APP_URL },
    ]);
  }
);


// ─────────────────────────────────────────────────────────────
// TRIGGER 3 — Nova assinatura VIP ativada
// ─────────────────────────────────────────────────────────────
export const onSubscriptionCreated = onDocumentCreated(
  "subscriptions/{id}",
  async (event) => {
    const sub = event.data?.data();
    if (!sub || sub.status !== "ATIVA") return;

    const cDoc = await db.collection("clients").doc(sub.clientId).get();
    const cli  = cDoc.data();
    if (!cli?.phone) return;

    await send(cli.phone, T.vipAtivado, [
      { name: "cliente_nome",    value: sub.clientName     || cli.name },
      { name: "plano",           value: sub.planName       || "VIP"    },
      { name: "data_vencimento", value: fmt(sub.endDate.split("T")[0]) },
    ]);
  }
);

// ─────────────────────────────────────────────────────────────
// SCHEDULED 1 — Lembrete 24h antes (todo dia às 10:00)
// ─────────────────────────────────────────────────────────────
export const sendReminders24h = onSchedule(
  { schedule: "0 10 * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const snap = await db
      .collection("appointments")
      .where("date",   "==", dateStr)
      .where("status", "in", ["PENDENTE", "AGENDADO"])
      .get();

    console.log(`📅 Lembretes 24h: ${snap.size} agendamentos para ${dateStr}`);

    for (const doc of snap.docs) {
      const a = doc.data();
      if (!a.clientPhone) continue;
      await send(a.clientPhone, T.lembrete24h, [
        { name: "cliente_nome", value: a.clientName       || "Cliente"  },
        { name: "servico",      value: a.serviceName      || "Serviço"  },
        { name: "barbeiro",     value: a.professionalName || "Barbeiro" },
        { name: "horario",      value: a.startTime        || ""         },
      ]);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// SCHEDULED 2 — Lembrete 1h antes (toda hora em ponto)
// Usa flag wppLembrete1hSent no agendamento para não repetir
// ─────────────────────────────────────────────────────────────
export const sendReminders1h = onSchedule(
  { schedule: "0 * * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const now      = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const oneHour  = new Date(now.getTime() + 60 * 60 * 1000);
    const target   = `${String(oneHour.getHours()).padStart(2, "0")}:00`;

    const snap = await db
      .collection("appointments")
      .where("date",               "==", todayStr)
      .where("startTime",          "==", target)
      .where("status",             "in", ["PENDENTE", "AGENDADO"])
      .where("wppLembrete1hSent",  "==", false)
      .get();

    console.log(`⏰ Lembretes 1h: ${snap.size} agendamentos para ${target}`);

    for (const doc of snap.docs) {
      const a = doc.data();
      if (!a.clientPhone) continue;

      const ok = await send(a.clientPhone, T.lembrete1h, [
        { name: "cliente_nome", value: a.clientName       || "Cliente"  },
        { name: "servico",      value: a.serviceName      || "Serviço"  },
        { name: "barbeiro",     value: a.professionalName || "Barbeiro" },
        { name: "horario",      value: a.startTime        || ""         },
      ]);

      // Marca como enviado para não repetir
      if (ok !== false) {
        await doc.ref.update({ wppLembrete1hSent: true });
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────
// SCHEDULED 3 — Agenda diária para cada barbeiro (07:00)
// ─────────────────────────────────────────────────────────────
export const sendDailyAgenda = onSchedule(
  { schedule: "35 8 * * *", timeZone: "America/Sao_Paulo" }, // ← mude para "0 7 * * *" em produção
  async () => {
    const todayStr       = new Date().toISOString().split("T")[0];
    const todayFormatted = fmt(todayStr);

    const profsSnap = await db.collection("professionals").get();
    const profs     = profsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
    const comWhats  = profs.filter((p) => p.phone);

    if (comWhats.length === 0) {
      console.log("⚠️  Nenhum barbeiro com WhatsApp cadastrado.");
      return;
    }

    const apptsSnap = await db
      .collection("appointments")
      .where("date",   "==", todayStr)
      .where("status", "in", ["PENDENTE", "AGENDADO"])
      .get();

    const appts = apptsSnap.docs
      .map((d) => d.data())
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    console.log(`💈 Agenda diária: ${comWhats.length} barbeiros, ${appts.length} agendamentos`);

    for (const prof of comWhats) {
      const meus = appts.filter((a) => a.professionalId === prof.id);

      if (meus.length === 0) {
        console.log(`😴 ${prof.name}: sem agendamentos hoje`);
        continue;
      }

      const resumo = meus
        .map((a) => `🕐 ${a.startTime}  ${a.clientName}  ${a.serviceName}`)
        .join("\n");

      await send(prof.phone, T.agendaDiaria, [
        { name: "barbeiro_nome",      value: prof.name },
        { name: "data",               value: todayFormatted },
        { name: "agenda_resumo",      value: resumo },
        { name: "total_agendamentos", value: String(meus.length) },
      ]);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// SCHEDULED 4 — VIP vencendo em 3 dias (todo dia às 09:00)
// ─────────────────────────────────────────────────────────────
export const sendVipExpiry3days = onSchedule(
  { schedule: "0 9 * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const d3 = new Date();
    d3.setDate(d3.getDate() + 3);
    const target = d3.toISOString().split("T")[0];

    const snap = await db
      .collection("subscriptions")
      .where("endDate", "==", target)
      .where("status",  "==", "ATIVA")
      .get();

    console.log(`👑 VIP 3 dias: ${snap.size} assinaturas vencem em ${target}`);

    for (const doc of snap.docs) {
      const sub  = doc.data();
      const cDoc = await db.collection("clients").doc(sub.clientId).get();
      const cli  = cDoc.data();
      if (!cli?.phone) continue;

      await send(cli.phone, T.vip3dias, [
        { name: "cliente_nome",    value: sub.clientName || cli.name },
        { name: "data_vencimento", value: fmt(sub.endDate) },
        { name: "link_renovacao",  value: APP_URL },
      ]);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// SCHEDULED 5 — VIP vencendo em 1 dia (todo dia às 09:05)
// ─────────────────────────────────────────────────────────────
export const sendVipExpiry1day = onSchedule(
  { schedule: "5 9 * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const d1 = new Date();
    d1.setDate(d1.getDate() + 1);
    const target = d1.toISOString().split("T")[0];

    const snap = await db
      .collection("subscriptions")
      .where("endDate", "==", target)
      .where("status",  "==", "ATIVA")
      .get();

    console.log(`👑 VIP 1 dia: ${snap.size} assinaturas vencem em ${target}`);

    for (const doc of snap.docs) {
      const sub  = doc.data();
      const cDoc = await db.collection("clients").doc(sub.clientId).get();
      const cli  = cDoc.data();
      if (!cli?.phone) continue;

      await send(cli.phone, T.vip1dia, [
        { name: "cliente_nome",    value: sub.clientName || cli.name },
        { name: "data_vencimento", value: fmt(sub.endDate) },
        { name: "link_renovacao",  value: APP_URL },
      ]);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// SCHEDULED 6 — Clientes inativos 30+ dias (toda segunda 09:10)
// ─────────────────────────────────────────────────────────────
export const sendInactiveClients = onSchedule(
  { schedule: "10 9 * * 1", timeZone: "America/Sao_Paulo" },
  async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const snap = await db
      .collection("clients")
      .where("lastVisit", "<=", cutoffStr)
      .get();

    console.log(`😴 Inativos: ${snap.size} clientes sem visita desde ${cutoffStr}`);

    for (const doc of snap.docs) {
      const cli = doc.data();
      if (!cli.phone) continue;

      const lastDate = new Date(cli.lastVisit || cli.createdAt);
      const dias     = Math.floor((Date.now() - lastDate.getTime()) / 86_400_000);

      if (dias < 30 || dias > 120) continue;

      await send(cli.phone, T.clienteInativo, [
        { name: "cliente_nome",     value: cli.name    || "Cliente" },
        { name: "dias_ausente",     value: String(dias) },
        { name: "link_agendamento", value: APP_URL },
      ]);
    }
  }
);