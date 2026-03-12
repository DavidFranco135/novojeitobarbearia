// ============================================================
// functions/src/index.ts — Cloud Functions Firebase v2
// Barbearia Novo Jeito — Automação WhatsApp Business API
// ============================================================

import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
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
  posAtendimento:    "pos_atendimento_v2",
  vip3dias:          "aviso_vencimento_3dia",
  vip1dia:           "aviso_vencimento_1dia",
  vipAtivado:        "ativacao_plano_vip_3",
  clienteInativo:    "aviso_cliente_inativo",
  novoAgendBarbeiro: "novo_agendamento_barbeiro",
  agendaDiaria:      "agenda_diaria_barbeiro_v3",
  // ── Módulos de Automação ──────────────────────────────────
  horarioVago:       "aviso_horario_vago_2",
  promoDiaFraco:     "aviso_promocao",
  aniversario:       "aviso_aniversario_2",
  manutencaoCorte:   "aviso_manutencao_corte",
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
    // Só envia pós-atendimento quando o barbeiro clica em Concluir (não quando cliente paga online)
    if (!after.completedByBarber) return;

    await send(after.clientPhone, T.posAtendimento, [
      { name: "cliente_nome",   value: after.clientName       || "Cliente"  },
      { name: "link_avaliacao", value: APP_URL                              },
      { name: "servico",        value: after.serviceName      || "Serviço"  },
      { name: "barbeiro",       value: after.professionalName || "Barbeiro" },
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
  { schedule: "0 8 * * *", timeZone: "America/Sao_Paulo" }, // ← mude para "0 7 * * *" em produção
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
        .map((a) => `🕐 ${a.startTime} ${a.clientName} - ${a.serviceName}`)
        .join("  |  ");

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
        { name: "dias_ausente",     value: String(dias)             },
        { name: "link_agendamento", value: APP_URL                  },
      ]);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TRIGGER 4 — Agendamento CANCELADO → notifica clientes
// que costumam cortar naquele dia da semana (horário vago)
// ─────────────────────────────────────────────────────────────
export const onAppointmentCancelled = onDocumentUpdated(
  "appointments/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === "CANCELADO") return;
    if (after.status  !== "CANCELADO") return;

    const diaSemana = new Date(after.date).getDay();
    const horario   = after.startTime;

    // Busca todos os clientes que já agendaram naquele dia da semana
    const apptSnap = await db
      .collection("appointments")
      .where("status", "==", "CONCLUIDO_PAGO")
      .get();

    const phonesSeen = new Set<string>();
    const candidatos: { name: string; phone: string }[] = [];

    for (const doc of apptSnap.docs) {
      const a = doc.data();
      if (!a.clientPhone || a.clientPhone === after.clientPhone) continue;
      if (phonesSeen.has(a.clientPhone)) continue;
      if (new Date(a.date).getDay() !== diaSemana) continue;
      phonesSeen.add(a.clientPhone);
      candidatos.push({ name: a.clientName || "Cliente", phone: a.clientPhone });
    }

    console.log(`📅 Horário vago ${horario} — ${candidatos.length} candidatos`);

    for (const cli of candidatos.slice(0, 10)) { // máx 10 notificações por slot
      await send(cli.phone, T.horarioVago, [
        { name: "cliente_nome", value: cli.name  },
        { name: "horario",      value: horario   },
        { name: "data",         value: fmt(after.date) },
        { name: "barbeiro",     value: after.professionalName || "Barbeiro" },
      ]);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// SCHEDULED 7 — Aniversariantes do dia (todo dia às 09:30)
// ─────────────────────────────────────────────────────────────
export const sendBirthdayMessages = onSchedule(
  { schedule: "30 9 * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const hoje = new Date();
    const mmdd  = `${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

    const snap = await db.collection("clients").get();
    let count = 0;

    for (const doc of snap.docs) {
      const cli = doc.data();
      if (!cli.phone || !cli.birthday) continue;
      const clientMmdd = String(cli.birthday).substring(5, 10); // MM-DD from YYYY-MM-DD
      if (clientMmdd !== mmdd) continue;

      await send(cli.phone, T.aniversario, [
        { name: "cliente_nome",  value: cli.name || "Cliente" },
        { name: "link_ativacao", value: APP_URL               },
      ]);
      count++;
    }

    console.log(`🎉 Aniversariantes: ${count} mensagens enviadas`);
  }
);

// ─────────────────────────────────────────────────────────────
// SCHEDULED 8 — Lembrete manutenção 15-20 dias (todo dia 10:30)
// ─────────────────────────────────────────────────────────────
export const sendMaintenanceReminders = onSchedule(
  { schedule: "30 10 * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const snap = await db.collection("clients").get();
    let count = 0;

    for (const doc of snap.docs) {
      const cli = doc.data();
      if (!cli.phone || !cli.lastVisit) continue;

      const dias = Math.floor((Date.now() - new Date(cli.lastVisit).getTime()) / 86_400_000);
      if (dias < 15 || dias > 22) continue; // janela de manutenção

      // Evita reenvio: verifica flag wppManutencaoSent resetada a cada 30 dias
      if (cli.wppManutencaoSent) {
        const sentDate = new Date(cli.wppManutencaoSentAt || 0);
        if ((Date.now() - sentDate.getTime()) < 30 * 86_400_000) continue;
      }

      await send(cli.phone, T.manutencaoCorte, [
        { name: "cliente_nome", value: cli.name  || "Cliente" },
        { name: "dias",         value: String(dias)           },
        { name: "link",         value: APP_URL                },
      ]);

      await doc.ref.update({
        wppManutencaoSent:   true,
        wppManutencaoSentAt: new Date().toISOString(),
      });
      count++;
    }

    console.log(`✂️ Manutenção: ${count} lembretes enviados`);
  }
);


// ─────────────────────────────────────────────────────────────
// SCHEDULED 9 — Promoção dia fraco (toda terça e quinta 11:00)
// Detecta dias com poucos agendamentos e avisa clientes inativos há 15-45 dias
// ─────────────────────────────────────────────────────────────
export const sendPromoDiaFraco = onSchedule(
  { schedule: "0 11 * * 2,4", timeZone: "America/Sao_Paulo" },
  async () => {
    // Verifica se amanhã tem poucos agendamentos (< 3)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const apptSnap = await db.collection("appointments")
      .where("date", "==", tomorrowStr)
      .where("status", "in", ["AGENDADO", "CONFIRMADO"])
      .get();

    // Só dispara se tiver menos de 3 agendamentos amanhã
    if (apptSnap.size >= 3) {
      console.log(`📅 Promo dia fraco: amanhã tem ${apptSnap.size} agendamentos, não disparando.`);
      return;
    }

    const clientSnap = await db.collection("clients").get();
    const cfgDoc     = await db.collection("config").doc("main").get();
    const shopLink   = cfgDoc.data()?.bookingUrl || APP_URL;
    let count = 0;

    for (const doc of clientSnap.docs) {
      const cli = doc.data();
      if (!cli.phone) continue;

      // Clientes inativos há 15-45 dias (fora da janela de manutenção e inatividade)
      const dias = cli.lastVisit
        ? Math.floor((Date.now() - new Date(cli.lastVisit).getTime()) / 86_400_000)
        : 999;
      if (dias < 15 || dias > 45) continue;

      // Evita reenvio na mesma semana
      const lastPromo = cli.wppPromoSentAt ? new Date(cli.wppPromoSentAt) : null;
      if (lastPromo && (Date.now() - lastPromo.getTime()) < 7 * 86_400_000) continue;

      const fmtTomorrow = fmt(tomorrowStr);
      await send(cli.phone, T.promoDiaFraco, [
        { name: "cliente_nome",    value: cli.name || "Cliente" },
        { name: "descricao_promo", value: `Horários disponíveis amanhã (${fmtTomorrow}) com condição especial para você! ✂️` },
        { name: "validade",        value: `amanhã, ${fmtTomorrow}` },
        { name: "link",            value: shopLink },
      ]);

      await doc.ref.update({
        wppPromoSentAt: new Date().toISOString(),
      });
      count++;
    }

    console.log(`🎯 Promo dia fraco: ${count} mensagens enviadas para amanhã (${tomorrowStr})`);
  }
);

// ─────────────────────────────────────────────────────────────
// TRIGGER 5 — Agendamento concluído → cashback automático
// Envia mensagem de cashback após CONCLUIDO_PAGO
// ─────────────────────────────────────────────────────────────
export const onAppointmentCashback = onDocumentUpdated(
  "appointments/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === "CONCLUIDO_PAGO") return;
    if (after.status  !== "CONCLUIDO_PAGO") return;
    if (!after.clientPhone || !after.price || after.price <= 0) return;

    // Busca configuração de cashback
    const cfgDoc = await db.collection("config").doc("main").get();
    const cfg    = cfgDoc.data();
    const pct    = cfg?.cashbackPercent || 5;
    const credito = Math.floor((after.price * pct) / 100);
    if (credito <= 0) return;

    // Atualiza cartela de fidelidade
    const cardSnap = await db
      .collection("loyaltyCards")
      .where("clientId", "==", after.clientId)
      .limit(1)
      .get();

    if (!cardSnap.empty) {
      const card = cardSnap.docs[0];
      await card.ref.update({ credits: (card.data().credits || 0) + credito });
    }

    // Cashback creditado — mensagem já incluída no template pos_atendimento
  }
);

// ─────────────────────────────────────────────────────────────
// HTTP PROXY — Asaas API (evita bloqueio CORS no browser)
// ─────────────────────────────────────────────────────────────
export const asaasProxy = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const { endpoint, method = "GET", body, key, env } = req.body;

    if (!key) { res.status(400).json({ error: "Asaas key not configured" }); return; }

    const base = env === "producao"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    try {
      const response = await fetch(`${base}${endpoint}`, {
        method,
        headers: {
          "access_token": key,
          "Content-Type": "application/json",
          "User-Agent": "BarbeariaNj/1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`Asaas ${method} ${endpoint} → ${response.status}:`, JSON.stringify(data));
      }
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("asaasProxy error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// WEBHOOK — Asaas pagamento confirmado
// Cadastrar no Asaas: Configurações → Integrações → Webhooks
// URL: https://us-central1-financeiro-a7116.cloudfunctions.net/asaasWebhook
// Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED
// ─────────────────────────────────────────────────────────────
export const asaasWebhook = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    // ── Validação do token Asaas ──────────────────────────────
    const WEBHOOK_TOKEN = "whsec_Or3lfJgfub5vn8C-NrXj7JE4rJcTmurvVhP-tOhLMKs";
    const receivedToken = req.headers["asaas-access-token"] || req.body?.token;
    if (receivedToken !== WEBHOOK_TOKEN) {
      console.warn("asaasWebhook: token inválido →", receivedToken);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const event   = req.body;
      const payment = event?.payment;
      if (!payment) { res.status(200).send("ok"); return; }

      const extRef  = payment.externalReference || "";
      const status  = event.event; // PAYMENT_RECEIVED | PAYMENT_CONFIRMED | PAYMENT_OVERDUE

      console.log(`Asaas webhook: ${status} | ref: ${extRef} | id: ${payment.id}`);

      // ── Cobrança de agendamento (ref: booking_clientId_date) ──
      if (extRef.startsWith("booking_") && (status === "PAYMENT_RECEIVED" || status === "PAYMENT_CONFIRMED")) {
        // Busca agendamento pelo asaasPaymentId ou externalReference
        const snap = await db.collection("appointments")
          .where("awaitingOnlinePayment", "==", true)
          .get();

        const match = snap.docs.find(d =>
          d.data().asaasPaymentId === payment.id ||
          `booking_${d.data().clientId}_${d.data().date}` === extRef
        );

        if (match) {
          await match.ref.update({
            status: "CONCLUIDO_PAGO",
            awaitingOnlinePayment: false,
            asaasPaymentId: payment.id,
          });
          console.log(`✅ Agendamento ${match.id} marcado como CONCLUIDO_PAGO via webhook`);

          // ── Envia pós-atendimento ao cliente após pagamento online ──
          const appt = match.data();
          if (appt.clientPhone) {
            await send(appt.clientPhone, T.posAtendimento, [
              { name: "cliente_nome",   value: appt.clientName       || "Cliente"  },
              { name: "link_avaliacao", value: APP_URL                             },
              { name: "servico",        value: appt.serviceName      || "Serviço"  },
              { name: "barbeiro",       value: appt.professionalName || "Barbeiro" },
            ]);
          }
        }
      }

      // ── Cobrança de assinatura (ref: sub_subscriptionId) ──
      if (extRef.startsWith("sub_") && (status === "PAYMENT_RECEIVED" || status === "PAYMENT_CONFIRMED")) {
        const subId = extRef.replace("sub_", "");
        const subDoc = await db.collection("subscriptions").doc(subId).get();
        if (subDoc.exists) {
          const sub = subDoc.data()!;
          const wasPending = sub.status === "PENDENTE_PAGAMENTO";

          await subDoc.ref.update({
            status:             "ATIVA",
            lastPaymentDate:    new Date().toISOString(),
            lastAsaasPaymentId: payment.id,
          });
          console.log(`✅ Assinatura ${subId} ativada/renovada via webhook`);

          // ── Dispara WhatsApp apenas na 1ª ativação (era PENDENTE_PAGAMENTO) ──
          if (wasPending) {
            const clientPhone = (sub.clientPhone || "").replace(/\D/g, "");
            if (clientPhone) {
              const endDate = typeof sub.endDate === "string"
                ? sub.endDate.split("T")[0]
                : new Date(sub.endDate?.toDate?.() || sub.endDate).toISOString().split("T")[0];

              await send(clientPhone, T.vipAtivado, [
                { name: "cliente_nome",    value: sub.clientName || "Cliente" },
                { name: "plano",           value: sub.planName   || "VIP"     },
                { name: "data_vencimento", value: fmt(endDate)                 },
              ]);
            }

            // Avisa a barbearia
            const cfgDoc    = await db.collection("config").doc("main").get();
            const shopPhone = (cfgDoc.data()?.whatsapp || "").replace(/\D/g, "");
            if (shopPhone) {
              const today = new Date().toISOString().split("T")[0];
              await send(shopPhone, T.novoAgendBarbeiro, [
                { name: "barbeiro_nome", value: cfgDoc.data()?.name || "Barbearia" },
                { name: "cliente_nome",  value: sub.clientName      || "Cliente"    },
                { name: "servico",       value: sub.planName         || "Plano VIP"  },
                { name: "horario",       value: ""                                   },
                { name: "data",          value: fmt(today)                           },
              ]);
            }
          }
        }
      }

      // ── Pagamento vencido ──
      if (status === "PAYMENT_OVERDUE") {
        if (extRef.startsWith("sub_")) {
          const subId = extRef.replace("sub_", "");
          const subDoc = await db.collection("subscriptions").doc(subId).get();
          if (subDoc.exists) {
            await subDoc.ref.update({ status: "VENCIDA" });
            console.log(`⚠️ Assinatura ${subId} marcada como VENCIDA via webhook`);
          }
        }
      }

      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("asaasWebhook error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);
// ============================================================
// WHATSAPP INBOX — Recebe mensagens dos clientes via webhook
// e salva no Firestore. Também permite o ADM responder.
// URL: registrar no Meta → Webhook → messages
// ============================================================

// ─── Helper: envia texto livre (fora de template, dentro de 24h) ─────
async function sendTextMessage(toPhone: string, text: string): Promise<boolean> {
  const phoneId = process.env.PHONE_NUMBER_ID || "";
  const token   = process.env.ACCESS_TOKEN    || "";
  if (!phoneId || !token) return false;
  const cleaned = toPhone.replace(/\D/g, "");
  const number  = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: number,
          type: "text",
          text: { preview_url: false, body: text },
        }),
      }
    );
    return res.ok;
  } catch { return false; }
}

// ─── whatsappInbox — Webhook de mensagens recebidas ──────────────────
// GET  = verificação do Meta (challenge)
// POST = mensagens recebidas dos clientes
export const whatsappInbox = onRequest(
  { cors: true },
  async (req, res) => {
    // ── GET: verificação do webhook Meta ──
    if (req.method === "GET") {
      const VERIFY_TOKEN = "novojeito_inbox_2024";
      const mode      = req.query["hub.mode"];
      const token     = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
      } else {
        res.status(403).send("Forbidden");
      }
      return;
    }

    // ── POST: mensagem recebida ──
    if (req.method === "POST") {
      try {
        const body = req.body;
        const entry = body?.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // Confirma recebimento imediatamente (Meta exige < 20s)
        res.status(200).json({ received: true });

        if (!value?.messages) return;

        for (const msg of value.messages) {
          const fromPhone = msg.from; // número com DDI
          const msgId     = msg.id;
          const timestamp = msg.timestamp;
          const type      = msg.type; // text, image, audio, etc.

          let text = "";
          if (type === "text") text = msg.text?.body || "";
          else if (type === "image") text = "[📷 Imagem]";
          else if (type === "audio") text = "[🎤 Áudio]";
          else if (type === "document") text = "[📄 Documento]";
          else if (type === "sticker") text = "[🎭 Sticker]";
          else text = `[${type}]`;

          // Busca cliente pelo número
          const clientsSnap = await db.collection("clients")
            .where("phone", "==", fromPhone.replace(/^55/, ""))
            .limit(1).get();
          
          // Também tenta com 55 na frente
          let clientDoc = clientsSnap.docs[0];
          if (!clientDoc) {
            const snap2 = await db.collection("clients").get();
            clientDoc = snap2.docs.find(d => {
              const p = (d.data().phone || "").replace(/\D/g, "");
              const fp = fromPhone.replace(/\D/g, "");
              return fp.endsWith(p) || p.endsWith(fp);
            })!;
          }

          const clientId   = clientDoc?.id   || null;
          const clientName = clientDoc?.data()?.name || fromPhone;

          // Salva mensagem na coleção inbox
          const convId = `conv_${fromPhone.replace(/\D/g, "")}`;
          
          // Atualiza / cria conversa
          await db.collection("inbox").doc(convId).set({
            clientId,
            clientName,
            clientPhone: fromPhone,
            lastMessage: text,
            lastMessageAt: Number(timestamp) * 1000,
            unread: true,
            updatedAt: Date.now(),
          }, { merge: true });

          // Salva mensagem individual
          await db.collection("inbox").doc(convId)
            .collection("messages").doc(msgId).set({
              from: "client",
              text,
              type,
              timestamp: Number(timestamp) * 1000,
              createdAt: Date.now(),
            });

          console.log(`📨 Mensagem de ${clientName} (${fromPhone}): ${text}`);

          // ── Auto-resposta: redireciona para o WhatsApp comercial ──
          const AUTO_REPLY = `Olá, ${clientName.split(" ")[0]}! 👋 Você está no sistema automático de agendamentos da *Novo Jeito Barbearia*.

Para falar diretamente com nossa equipe de atendimento, chama a gente no WhatsApp comercial:

✂️ *Novo Jeito Barbearia*
📲 (21) 97370-8141

Estamos por lá de segunda a sábado! 😊`;

          await sendTextMessage(fromPhone, AUTO_REPLY);
          console.log(`↩️ Auto-resposta enviada para ${fromPhone}`);
        }
      } catch (err: any) {
        console.error("whatsappInbox error:", err);
      }
      return;
    }

    res.status(405).send("Method not allowed");
  }
);

// ─── whatsappReply — ADM responde pelo app ────────────────────────────
export const whatsappReply = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }
    try {
      const { convId, toPhone, text } = req.body;
      if (!toPhone || !text) { res.status(400).json({ error: "toPhone e text são obrigatórios" }); return; }

      const ok = await sendTextMessage(toPhone, text);
      if (!ok) { res.status(500).json({ error: "Falha ao enviar mensagem" }); return; }

      // Salva mensagem enviada no histórico
      const msgRef = await db.collection("inbox").doc(convId)
        .collection("messages").add({
          from: "admin",
          text,
          type: "text",
          timestamp: Date.now(),
          createdAt: Date.now(),
        });

      // Atualiza conversa
      await db.collection("inbox").doc(convId).set({
        lastMessage: text,
        lastMessageAt: Date.now(),
        unread: false,
      }, { merge: true });

      res.status(200).json({ sent: true, msgId: msgRef.id });
    } catch (err: any) {
      console.error("whatsappReply error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);
