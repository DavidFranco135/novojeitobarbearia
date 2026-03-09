import React, { useState, useMemo } from 'react';
import {
  Zap, Calendar, Tag, Gift, Users, Clock, Trophy, Coins,
  Play, Pause, Settings, ChevronDown, ChevronUp, Send,
  CheckCircle2, AlertCircle, TrendingUp, Star, BarChart2
} from 'lucide-react';
import { useBarberStore } from '../store';

// ─────────────────────────────────────────────────────────────
// Automações de Marketing — Barbearia Novo Jeito
// 7 módulos: horários vagos, promoção dias fracos, aniversário,
// indicação premiada, manutenção do corte, ranking barbeiros,
// cashback automático
// ─────────────────────────────────────────────────────────────

const Automacoes: React.FC = () => {
  const store = useBarberStore() as any;
  const { theme, appointments, clients, professionals, config, updateClient, loyaltyCards, addLoyaltyCard } = store;
  const isDark = theme !== 'light';

  const bg    = isDark ? 'bg-[#050505]' : 'bg-zinc-50';
  const card  = isDark ? 'bg-[#0f0f0f] border-white/5' : 'bg-white border-zinc-200';
  const txt   = isDark ? 'text-white' : 'text-zinc-900';
  const sub   = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const inp   = isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-900';

  // ── Estados de configuração de cada módulo ─────────────────
  const [cfg1, setCfg1] = useState({ ativo: false, diasSemana: [0,1,2,3,4,5,6], antecedencia: 30 });
  const [cfg2, setCfg2] = useState({ ativo: false, diasFracos: ['terça','quarta'], mensagem: '🔥 Promo meio de semana! Corte + barba hoje por R$45 até 18h. Agende agora!' });
  const [cfg3, setCfg3] = useState({ ativo: false, desconto: 10, mensagem: '🎉 Feliz Aniversário, {{nome}}! Você tem {{desconto}}% de desconto essa semana na Barbearia Novo Jeito. Agende agora!' });
  const [cfg4, setCfg4] = useState({ ativo: false, credito: 10, mensagem: '🎁 Indique um amigo e ganhe R${{credito}} de crédito no próximo corte! Seu código: {{codigo}}' });
  const [cfg5, setCfg5] = useState({ ativo: false, dias: 18, mensagem: '✂️ {{nome}}, já faz {{dias}} dias desde seu último corte. Que tal renovar o visual? Agende agora!' });
  const [cfg7, setCfg7] = useState({ ativo: false, percentual: 5 });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{mod: number, msg: string, ok: boolean} | null>(null);

  const toggle = (mod: number) => setExpanded(prev => prev === mod ? null : mod);

  const showFeedback = (mod: number, msg: string, ok = true) => {
    setFeedback({ mod, msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  };

  // ── MÓDULO 1 — Horários vagos ──────────────────────────────
  const handleHorarioVago = async () => {
    setLoading(1);
    try {
      const cancelados = appointments.filter((a: any) => a.status === 'CANCELADO');
      if (cancelados.length === 0) { showFeedback(1, 'Nenhum horário cancelado encontrado.', false); return; }
      const ultimo = cancelados[cancelados.length - 1];
      const diaSemana = new Date(ultimo.date).getDay();
      const clientesFrequentes = clients.filter((c: any) => {
        const visitas = appointments.filter((a: any) =>
          a.clientPhone === c.phone &&
          a.status === 'CONCLUIDO_PAGO' &&
          new Date(a.date).getDay() === diaSemana
        );
        return visitas.length >= 1 && c.phone !== ultimo.clientPhone;
      });
      showFeedback(1, `✅ ${clientesFrequentes.length} cliente(s) seriam notificados sobre o horário ${ultimo.startTime} de ${ultimo.date}.`);
    } catch { showFeedback(1, 'Erro ao processar.', false); }
    finally { setLoading(null); }
  };

  // ── MÓDULO 4 — Indicação premiada ─────────────────────────
  const handleGerarCodigos = async () => {
    setLoading(4);
    try {
      let gerados = 0;
      for (const client of clients) {
        if (!client.referralCode) {
          const code = `NJ${client.name.substring(0,3).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
          await updateClient(client.id, { referralCode: code, referralCredits: client.referralCredits || 0 });
          gerados++;
        }
      }
      showFeedback(4, `✅ ${gerados} código(s) de indicação gerados!`);
    } catch { showFeedback(4, 'Erro ao gerar códigos.', false); }
    finally { setLoading(null); }
  };

  // ── MÓDULO 6 — Ranking barbeiros ──────────────────────────
  const ranking = useMemo(() => {
    const mesAtual = new Date().toISOString().substring(0, 7); // YYYY-MM
    return professionals
      .map((p: any) => {
        const cortes = appointments.filter((a: any) =>
          a.professionalId === p.id &&
          a.status === 'CONCLUIDO_PAGO' &&
          a.date?.startsWith(mesAtual)
        ).length;
        const receita = appointments
          .filter((a: any) => a.professionalId === p.id && a.status === 'CONCLUIDO_PAGO' && a.date?.startsWith(mesAtual))
          .reduce((sum: number, a: any) => sum + (a.price || 0), 0);
        return { ...p, cortes, receita };
      })
      .sort((a: any, b: any) => b.cortes - a.cortes);
  }, [professionals, appointments]);

  const medalhas = ['🥇', '🥈', '🥉'];

  // ── MÓDULO 7 — Cashback automático ─────────────────────────
  const handleAplicarCashback = async () => {
    setLoading(7);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const concluidos = appointments.filter((a: any) =>
        a.status === 'CONCLUIDO_PAGO' && a.date === hoje && a.price > 0
      );
      let processados = 0;
      for (const appt of concluidos) {
        const card = loyaltyCards?.find((lc: any) => lc.clientId === appt.clientId);
        const credito = Math.floor((appt.price * cfg7.percentual) / 100);
        if (credito > 0 && card) {
          await store.updateLoyaltyCard?.(card.id, { credits: (card.credits || 0) + credito });
          processados++;
        }
      }
      showFeedback(7, processados > 0 ? `✅ Cashback aplicado em ${processados} atendimento(s) de hoje!` : 'Nenhum atendimento concluído hoje para processar.', processados > 0);
    } catch { showFeedback(7, 'Erro ao aplicar cashback.', false); }
    finally { setLoading(null); }
  };

  // ── Estatísticas rápidas ───────────────────────────────────
  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = new Date().toISOString().substring(0, 7);
  const stats = useMemo(() => ({
    canceladosHoje: appointments.filter((a: any) => a.date === hoje && a.status === 'CANCELADO').length,
    aniversariantesHoje: clients.filter((c: any) => c.birthday?.substring(5) === hoje.substring(5)).length,
    inativosMaitenence: clients.filter((c: any) => {
      if (!c.lastVisit) return false;
      const dias = Math.floor((Date.now() - new Date(c.lastVisit).getTime()) / 86400000);
      return dias >= 15 && dias <= 25;
    }).length,
    totalCortesMes: appointments.filter((a: any) => a.status === 'CONCLUIDO_PAGO' && a.date?.startsWith(mesAtual)).length,
  }), [appointments, clients, hoje, mesAtual]);

  // ── Componente de módulo ───────────────────────────────────
  const ModCard = ({
    id, icon: Icon, title, subtitle, cor, children, onAction, actionLabel, badge
  }: {
    id: number; icon: any; title: string; subtitle: string; cor: string;
    children: React.ReactNode; onAction?: () => void; actionLabel?: string; badge?: string;
  }) => (
    <div className={`rounded-[2rem] border overflow-hidden transition-all ${card}`}>
      <button
        className="w-full flex items-center justify-between p-6"
        onClick={() => toggle(id)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${cor}`}>
            <Icon size={22} className="text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className={`font-black text-sm ${txt}`}>{title}</p>
              {badge && <span className="text-[9px] font-black px-2 py-0.5 bg-[#C58A4A]/20 text-[#C58A4A] rounded-lg uppercase">{badge}</span>}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${sub}`}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {feedback?.mod === id && (
            <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${feedback.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>
              {feedback.msg}
            </span>
          )}
          {expanded === id ? <ChevronUp size={18} className={sub} /> : <ChevronDown size={18} className={sub} />}
        </div>
      </button>

      {expanded === id && (
        <div className={`px-6 pb-6 border-t space-y-5 pt-5 ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
          {children}
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              disabled={loading === id}
              className="flex items-center gap-2 gradiente-ouro text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading === id ? (
                <span className="animate-spin">⟳</span>
              ) : <Send size={14} />}
              {loading === id ? 'Processando...' : actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="max-w-4xl mx-auto p-6 space-y-6 pb-20">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-3xl font-black font-display italic tracking-tight ${txt}`}>Automações</h1>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${sub}`}>Marketing inteligente · 7 módulos ativos</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 gradiente-ouro rounded-2xl">
            <Zap size={14} className="text-black" />
            <span className="text-black font-black text-[10px] uppercase">Pro</span>
          </div>
        </div>

        {/* ── Stats rápidas ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Cancelados hoje', value: stats.canceladosHoje, icon: AlertCircle, color: 'text-red-400' },
            { label: 'Aniversariantes', value: stats.aniversariantesHoje, icon: Gift, color: 'text-pink-400' },
            { label: 'Precisam de corte', value: stats.inativosMaitenence, icon: Clock, color: 'text-amber-400' },
            { label: 'Cortes no mês', value: stats.totalCortesMes, icon: TrendingUp, color: 'text-emerald-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`rounded-2xl border p-4 ${card}`}>
              <div className={`${color} mb-2`}><Icon size={18} /></div>
              <p className={`text-2xl font-black ${txt}`}>{value}</p>
              <p className={`text-[9px] font-black uppercase tracking-widest ${sub}`}>{label}</p>
            </div>
          ))}
        </div>

        {/* ─────────────────────────────────────────────────────
            MÓDULO 1 — Horários Vagos
        ───────────────────────────────────────────────────── */}
        <ModCard
          id={1} icon={Calendar} title="Horários Vagos"
          subtitle="Preenche cancelamentos automaticamente"
          cor="bg-blue-600" badge={stats.canceladosHoje > 0 ? `${stats.canceladosHoje} hoje` : ''}
          onAction={handleHorarioVago} actionLabel="Verificar e Notificar"
        >
          <p className={`text-sm ${sub}`}>
            Quando um agendamento é cancelado, o sistema identifica clientes que costumam cortar naquele dia da semana e envia uma mensagem WhatsApp oferecendo o horário liberado.
          </p>
          <div className={`p-4 rounded-2xl border text-sm italic ${isDark ? 'border-white/10 bg-white/3 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
            💬 "Olá João! Acabou de liberar um horário HOJE às 16:00 com Vinícius. Quer aproveitar?"
          </div>
          <div className="flex items-center gap-3">
            <label className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Antecedência mínima (min)</label>
            <input type="number" min={0} value={cfg1.antecedencia}
              onChange={e => setCfg1({ ...cfg1, antecedencia: +e.target.value })}
              className={`w-20 border p-2 rounded-xl text-sm font-bold ${inp}`}
            />
          </div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            📋 Requer template "horario_vago" no WhatsApp Manager Meta
          </p>
        </ModCard>

        {/* ─────────────────────────────────────────────────────
            MÓDULO 2 — Promoção Dias Fracos
        ───────────────────────────────────────────────────── */}
        <ModCard
          id={2} icon={Tag} title="Promoção Dias Fracos"
          subtitle="Movimenta terça e quarta automaticamente"
          cor="bg-orange-500"
        >
          <p className={`text-sm ${sub}`}>
            Nos dias configurados com pouco movimento, o sistema dispara promoções via WhatsApp para todos os clientes ativos, aumentando o faturamento no meio de semana.
          </p>
          <div className={`p-4 rounded-2xl border text-sm italic ${isDark ? 'border-white/10 bg-white/3 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
            💬 "🔥 Promo de meio de semana! Corte + barba hoje por R$45 até 18h. Agende agora!"
          </div>
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Mensagem da promoção</label>
            <textarea rows={3} value={cfg2.mensagem} onChange={e => setCfg2({ ...cfg2, mensagem: e.target.value })}
              className={`w-full border p-3 rounded-xl text-sm font-medium resize-none ${inp}`}
            />
          </div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
            📋 Requer template "promocao_dia_fraco" no WhatsApp Manager Meta
          </p>
        </ModCard>

        {/* ─────────────────────────────────────────────────────
            MÓDULO 3 — Aniversário
        ───────────────────────────────────────────────────── */}
        <ModCard
          id={3} icon={Gift} title="Aniversário do Cliente"
          subtitle="Mensagem automática no dia especial"
          cor="bg-pink-500"
          badge={stats.aniversariantesHoje > 0 ? `${stats.aniversariantesHoje} hoje!` : ''}
        >
          <p className={`text-sm ${sub}`}>
            Todo dia às 08:00 o sistema verifica aniversariantes e envia mensagem personalizada com desconto. O campo data de nascimento pode ser preenchido na aba Membros.
          </p>
          <div className={`p-4 rounded-2xl border text-sm italic ${isDark ? 'border-white/10 bg-white/3 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
            💬 "🎉 Feliz Aniversário, João! A Barbearia Novo Jeito te dá 10% de desconto no corte essa semana."
          </div>
          <div className="flex items-center gap-3">
            <label className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Desconto (%)</label>
            <input type="number" min={1} max={100} value={cfg3.desconto}
              onChange={e => setCfg3({ ...cfg3, desconto: +e.target.value })}
              className={`w-20 border p-2 rounded-xl text-sm font-bold ${inp}`}
            />
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-2xl ${isDark ? 'bg-pink-500/10 border border-pink-500/20' : 'bg-pink-50 border border-pink-200'}`}>
            <Gift size={16} className="text-pink-500" />
            <div>
              <p className={`text-[10px] font-black uppercase ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>
                {stats.aniversariantesHoje > 0
                  ? `🎉 Há ${stats.aniversariantesHoje} aniversariante(s) hoje!`
                  : 'Nenhum aniversariante hoje'}
              </p>
              <p className={`text-[9px] ${sub}`}>Cadastre datas de nascimento na aba Membros</p>
            </div>
          </div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>
            📋 Requer template "aniversario_cliente" no WhatsApp Manager Meta
          </p>
        </ModCard>

        {/* ─────────────────────────────────────────────────────
            MÓDULO 4 — Indicação Premiada
        ───────────────────────────────────────────────────── */}
        <ModCard
          id={4} icon={Users} title="Indicação Premiada"
          subtitle="Cliente ganha bônus ao indicar amigos"
          cor="bg-violet-600"
          onAction={handleGerarCodigos} actionLabel="Gerar Códigos para Todos"
        >
          <p className={`text-sm ${sub}`}>
            Cada cliente recebe um código único de indicação. Quando um novo cliente se cadastrar usando esse código, ambos ganham crédito automático na cartela de fidelidade.
          </p>
          <div className={`p-4 rounded-2xl border text-sm italic ${isDark ? 'border-white/10 bg-white/3 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
            💬 "Indique um amigo e ganhe R$10 de crédito no próximo corte! Seu código: NJJOA1234"
          </div>
          <div className="flex items-center gap-3">
            <label className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Crédito por indicação (R$)</label>
            <input type="number" min={1} value={cfg4.credito}
              onChange={e => setCfg4({ ...cfg4, credito: +e.target.value })}
              className={`w-20 border p-2 rounded-xl text-sm font-bold ${inp}`}
            />
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'}`}>
            <p className={`text-[10px] font-black uppercase ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
              {clients.filter((c: any) => c.referralCode).length} / {clients.length} clientes com código gerado
            </p>
          </div>
        </ModCard>

        {/* ─────────────────────────────────────────────────────
            MÓDULO 5 — Lembrete de Manutenção
        ───────────────────────────────────────────────────── */}
        <ModCard
          id={5} icon={Clock} title="Lembrete de Manutenção"
          subtitle="Lembra o cliente após 15-20 dias"
          cor="bg-teal-600"
          badge={stats.inativosMaitenence > 0 ? `${stats.inativosMaitenence} pendentes` : ''}
        >
          <p className={`text-sm ${sub}`}>
            Depois de um número configurável de dias desde o último corte, o sistema envia um lembrete personalizado. Diferente do módulo de inativos (30+ dias), este é para manutenção regular.
          </p>
          <div className={`p-4 rounded-2xl border text-sm italic ${isDark ? 'border-white/10 bg-white/3 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
            💬 "João, já faz 18 dias desde seu último corte. Que tal renovar o visual?"
          </div>
          <div className="flex items-center gap-3">
            <label className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Dias para lembrete</label>
            <input type="number" min={7} max={30} value={cfg5.dias}
              onChange={e => setCfg5({ ...cfg5, dias: +e.target.value })}
              className={`w-20 border p-2 rounded-xl text-sm font-bold ${inp}`}
            />
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-teal-50 border border-teal-200'}`}>
            <p className={`text-[10px] font-black uppercase ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              {stats.inativosMaitenence} cliente(s) com {cfg5.dias - 3}–{cfg5.dias + 3} dias sem visita
            </p>
          </div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
            📋 Requer template "manutencao_corte" no WhatsApp Manager Meta
          </p>
        </ModCard>

        {/* ─────────────────────────────────────────────────────
            MÓDULO 6 — Ranking de Barbeiros
        ───────────────────────────────────────────────────── */}
        <ModCard
          id={6} icon={Trophy} title="Ranking de Barbeiros"
          subtitle="Desempenho mensal da equipe"
          cor="bg-amber-500"
        >
          <p className={`text-sm ${sub} mb-2`}>
            Ranking automático baseado nos atendimentos concluídos no mês atual. Motiva a equipe e identifica os melhores performers.
          </p>
          <div className="space-y-3">
            {ranking.length === 0 && (
              <p className={`text-sm ${sub}`}>Nenhum barbeiro cadastrado ainda.</p>
            )}
            {ranking.map((prof: any, i: number) => (
              <div key={prof.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${isDark ? 'border-white/5 bg-white/3' : 'border-zinc-100 bg-zinc-50'}`}>
                <span className="text-2xl w-8 text-center">{medalhas[i] || `${i + 1}º`}</span>
                <div className="flex-1">
                  <p className={`font-black text-sm ${txt}`}>{prof.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className={`h-1.5 rounded-full flex-1 ${isDark ? 'bg-white/10' : 'bg-zinc-200'}`}>
                      <div
                        className="h-full bg-gradient-to-r from-[#C58A4A] to-[#e6a85c] rounded-full transition-all"
                        style={{ width: `${ranking[0]?.cortes > 0 ? (prof.cortes / ranking[0].cortes) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${txt}`}>{prof.cortes} cortes</p>
                  <p className={`text-[10px] font-bold ${sub}`}>R$ {prof.receita.toFixed(0)}</p>
                </div>
              </div>
            ))}
          </div>
          {ranking.length > 0 && (
            <div className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
              <BarChart2 size={14} className="text-amber-500" />
              <p className={`text-[10px] font-black uppercase ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                Mês atual · Total: {stats.totalCortesMes} cortes concluídos
              </p>
            </div>
          )}
        </ModCard>

        {/* ─────────────────────────────────────────────────────
            MÓDULO 7 — Cashback Automático
        ───────────────────────────────────────────────────── */}
        <ModCard
          id={7} icon={Coins} title="Cashback Automático"
          subtitle="Crédito automático após cada atendimento"
          cor="bg-emerald-600"
          onAction={handleAplicarCashback} actionLabel="Aplicar Cashback de Hoje"
        >
          <p className={`text-sm ${sub}`}>
            Após cada atendimento concluído, o cliente recebe automaticamente um percentual do valor pago como crédito na cartela de fidelidade para usar no próximo corte.
          </p>
          <div className={`p-4 rounded-2xl border text-sm italic ${isDark ? 'border-white/10 bg-white/3 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
            💬 "João, você ganhou R$5,00 de cashback para usar no próximo corte! ✂️"
          </div>
          <div className="flex items-center gap-3">
            <label className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Percentual de cashback (%)</label>
            <input type="number" min={1} max={20} value={cfg7.percentual}
              onChange={e => setCfg7({ ...cfg7, percentual: +e.target.value })}
              className={`w-20 border p-2 rounded-xl text-sm font-bold ${inp}`}
            />
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
            <p className={`text-[10px] font-black uppercase ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Exemplo: atendimento R$50 → R${(50 * cfg7.percentual / 100).toFixed(2)} de crédito
            </p>
          </div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            📋 Requer template "cashback_recebido" no WhatsApp Manager Meta
          </p>
        </ModCard>

        {/* ── Nota sobre Cloud Functions ── */}
        <div className={`rounded-2xl border p-5 flex gap-4 items-start ${isDark ? 'border-[#C58A4A]/20 bg-[#C58A4A]/5' : 'border-amber-200 bg-amber-50'}`}>
          <Zap size={18} className="text-[#C58A4A] mt-0.5 shrink-0" />
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest text-[#C58A4A] mb-1`}>Deploy de Cloud Functions necessário</p>
            <p className={`text-xs ${sub}`}>
              Os módulos 1, 2, 3 e 5 precisam de novas Cloud Functions e templates WhatsApp configurados no Meta Business Manager para funcionar de forma totalmente automática. Os módulos 6 e 7 funcionam direto nesta tela.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Automacoes;
