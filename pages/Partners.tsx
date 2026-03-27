// ============================================================
// pages/Partners.tsx — Parceiros + QR Code + Clube de Benefícios
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  QrCode, Plus, Trash2, RefreshCw, Copy, Check,
  Users, TrendingUp, Link, X, Edit2, Gift, BarChart3,
  CheckCircle2, Clock, AlertCircle, ImageIcon, Upload, Tag,
  DollarSign, Calendar, Phone, Award
} from 'lucide-react';
import { useBarberStore } from '../store';
import { Partner, ClientBenefit } from '../types';

const QR_API = (token: string, size = 200) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    `${window.location.origin}?validateBenefit=${token}`
  )}`;

const genToken = () => Math.random().toString(36).substring(2, 10).toUpperCase();

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const IMGBB_API_KEY = 'da736db48f154b9108b23a36d4393848';

const uploadToImgBB = async (file: File): Promise<string> => {
  const data = new FormData();
  data.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: data });
  const json = await res.json();
  if (json.success) return json.data.url;
  throw new Error('Erro no upload');
};

const PARTNER_CATEGORIES = [
  'Açaí', 'Hamburgueria', 'Loja Masculina', 'Academia',
  'Lava-jato', 'Ótica', 'Restaurante', 'Farmácia',
  'Pet Shop', 'Outro'
];

const Partners: React.FC = () => {
  const store = useBarberStore() as any;
  const { theme, partners, addPartner, updatePartner, deletePartner, clientBenefits } = store;

  // ── abas do painel ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'parceiros' | 'beneficios' | 'cobrancas'>('parceiros');
  const [cobrancaPayingId, setCobrancaPayingId] = useState<string | null>(null);
  const [cobrancaPayMethod, setCobrancaPayMethod] = useState('PIX');

  const [showModal, setShowModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState<Partner | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
    email: '',
    discount: 10,
    cashbackPercent: 5,
    expiryDays: 30,
    description: '',
    logo: '',
    image: '',
    category: 'Outro',
    monthlyFee: 0,
    benefitValidityDays: 7,
  });

  const enriched = useMemo(() => {
    const ps: Partner[] = partners || [];
    const now = new Date();
    return ps.map(p => ({
      ...p,
      isExpired: new Date(p.qrCodeExpiry) < now,
    }));
  }, [partners]);

  const stats = useMemo(() => {
    const ps: Partner[] = partners || [];
    return {
      total: ps.length,
      ativos: ps.filter(p => p.status === 'ATIVO').length,
      totalReferrals: ps.reduce((a, p) => a + (p.totalReferrals || 0), 0),
    };
  }, [partners]);

  // ── stats do clube de benefícios ─────────────────────────────
  const benefitStats = useMemo(() => {
    const benefits: ClientBenefit[] = clientBenefits || [];
    const now = new Date();
    return {
      total: benefits.length,
      disponiveis: benefits.filter(b => b.status === 'DISPONIVEL' && new Date(b.expiryDate) > now).length,
      usados: benefits.filter(b => b.status === 'USADO').length,
      expirados: benefits.filter(b => b.status === 'EXPIRADO' || (b.status === 'DISPONIVEL' && new Date(b.expiryDate) <= now)).length,
    };
  }, [clientBenefits]);

  // ── benefícios por parceiro ───────────────────────────────────
  const benefitsByPartner = useMemo(() => {
    const benefits: ClientBenefit[] = clientBenefits || [];
    const usados = benefits.filter(b => b.status === 'USADO');
    const map: Record<string, { name: string; count: number; items: ClientBenefit[] }> = {};
    usados.forEach(b => {
      const key = b.partnerId || 'sem_parceiro';
      if (!map[key]) map[key] = { name: b.partnerName || 'Parceiro não identificado', count: 0, items: [] };
      map[key].count++;
      map[key].items.push(b);
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [clientBenefits]);

  const handleImageUpload = async (field: 'logo' | 'image', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingImg(true);
    try {
      const url = await uploadToImgBB(file);
      setFormData(prev => ({ ...prev, [field]: url }));
    } catch { alert('Erro ao subir imagem.'); }
    finally { setLoadingImg(false); }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      alert('Preencha nome e telefone!');
      return;
    }

    const payload = {
      name: formData.name,
      businessName: formData.businessName,
      phone: formData.phone,
      email: formData.email,
      discount: formData.discount,
      cashbackPercent: formData.cashbackPercent,
      description: formData.description,
      logo: formData.logo,
      image: formData.image,
      category: formData.category,
      monthlyFee: formData.monthlyFee,
      benefitValidityDays: formData.benefitValidityDays,
      qrCodeToken: genToken(),
      qrCodeExpiry: addDays(formData.expiryDays),
      totalReferrals: 0,
      status: 'ATIVO' as const,
      createdAt: new Date().toISOString(),
    };

    if (editingId) {
      await updatePartner(editingId, { ...payload, totalReferrals: showQrModal?.totalReferrals || 0 });
    } else {
      await addPartner(payload);
    }
    setShowModal(false);
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '', businessName: '', phone: '', email: '',
      discount: 10, cashbackPercent: 5, expiryDays: 30,
      description: '', logo: '', image: '',
      category: 'Outro', monthlyFee: 0, benefitValidityDays: 7,
    });
  };

  const handleRegenerateQR = async (partner: Partner) => {
    if (!confirm('Gerar novo QR Code? O anterior deixará de funcionar.')) return;
    await updatePartner(partner.id, {
      qrCodeToken: genToken(),
      qrCodeExpiry: addDays(30),
      status: 'ATIVO',
    });
    alert('✅ Novo QR Code gerado!');
    setShowQrModal(null);
  };

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}?partner=${token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const themeCard = theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'cartao-vidro border-white/5';
  const txt = theme === 'light' ? 'text-zinc-900' : 'text-white';
  const inp = `w-full border p-4 rounded-xl outline-none font-bold text-xs transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`;

  const tabs = [
    { id: 'parceiros', label: 'Parceiros', icon: QrCode },
    { id: 'beneficios', label: 'Clube de Benefícios', icon: Gift },
    { id: 'cobrancas', label: 'Cobranças', icon: DollarSign },
  ];

  // ── Cobranças mensais ─────────────────────────────────────────
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const parceirosComMensalidade = (partners || []).filter((p: any) => p.monthlyFee && p.monthlyFee > 0 && p.status === 'ATIVO');
  const totalMensalidades = parceirosComMensalidade.reduce((s: number, p: any) => s + (p.monthlyFee || 0), 0);
  const totalPagos = parceirosComMensalidade.filter((p: any) => (p.lastPaymentMonth || '') === currentMonth).reduce((s: number, p: any) => s + (p.monthlyFee || 0), 0);
  const totalEmAberto = totalMensalidades - totalPagos;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 h-full overflow-auto scrollbar-hide">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className={`text-3xl font-black font-display italic tracking-tight ${txt}`}>
            Área de Parceiros
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            QR Codes únicos · Clube de Benefícios · Relatórios
          </p>
        </div>
        {activeTab === 'parceiros' && (
          <button
            onClick={() => { setEditingId(null); resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 gradiente-ouro text-black px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl"
          >
            <Plus size={16} /> Novo Parceiro
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === t.id
                  ? 'gradiente-ouro text-black shadow-lg'
                  : theme === 'light'
                    ? 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    : 'bg-white/5 border border-white/10 text-zinc-500 hover:text-white'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════ ABA PARCEIROS ═══════════════ */}
      {activeTab === 'parceiros' && (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Parceiros', value: stats.total, color: '#C58A4A' },
              { label: 'Ativos', value: stats.ativos, color: '#10b981' },
              { label: 'Total Indicações', value: stats.totalReferrals, color: '#3b82f6' },
            ].map((s, i) => (
              <div key={i} className={`rounded-[2rem] p-6 border ${themeCard}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">{s.label}</p>
                <p className="text-3xl font-black font-display" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Lista de Parceiros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enriched.length === 0 && (
              <div className={`col-span-full rounded-[2rem] p-16 text-center border ${themeCard}`}>
                <QrCode className="mx-auto mb-4 text-zinc-600" size={48} />
                <p className="text-[10px] font-black uppercase text-zinc-600">Nenhum parceiro cadastrado.</p>
              </div>
            )}
            {enriched.map(p => (
              <div key={p.id} className={`rounded-[2rem] p-6 border hover:border-[#C58A4A]/40 transition-all group ${themeCard}`}>
                {/* Imagem / Logo */}
                {(p.image || p.logo) && (
                  <div className="w-full h-28 rounded-2xl overflow-hidden mb-4 bg-zinc-900">
                    <img src={p.image || p.logo} className="w-full h-full object-cover" alt={p.businessName} />
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-black text-lg truncate ${txt}`}>{p.businessName || p.name}</p>
                    {p.category && (
                      <span className="text-[8px] font-black uppercase tracking-widest text-[#C58A4A] bg-[#C58A4A]/10 px-2 py-0.5 rounded-full">
                        {p.category}
                      </span>
                    )}
                    {p.description && (
                      <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all ml-2">
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setFormData({
                          name: p.name, businessName: p.businessName, phone: p.phone, email: p.email,
                          discount: p.discount, cashbackPercent: p.cashbackPercent, expiryDays: 30,
                          description: p.description || '', logo: p.logo || '', image: p.image || '',
                          category: p.category || 'Outro', monthlyFee: p.monthlyFee || 0,
                          benefitValidityDays: p.benefitValidityDays || 7,
                        });
                        setShowModal(true);
                      }}
                      className={`p-2 rounded-xl ${theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('Excluir parceiro?')) deletePartner(p.id); }}
                      className="p-2 bg-red-500/10 text-red-500 rounded-xl"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className={`p-3 rounded-xl text-center ${theme === 'light' ? 'bg-zinc-50 border border-zinc-200' : 'bg-white/5 border border-white/5'}`}>
                    <p className="text-[7px] font-black uppercase text-zinc-500">Desconto</p>
                    <p className="text-sm font-black text-[#C58A4A]">{p.discount}%</p>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${theme === 'light' ? 'bg-zinc-50 border border-zinc-200' : 'bg-white/5 border border-white/5'}`}>
                    <p className="text-[7px] font-black uppercase text-zinc-500">Benefícios</p>
                    <p className="text-sm font-black text-emerald-500">{(p as any).usedBenefitsCount || 0}</p>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${theme === 'light' ? 'bg-zinc-50 border border-zinc-200' : 'bg-white/5 border border-white/5'}`}>
                    <p className="text-[7px] font-black uppercase text-zinc-500">Indicações</p>
                    <p className={`text-sm font-black ${txt}`}>{p.totalReferrals}</p>
                  </div>
                </div>

                {/* Status + QR */}
                <div className="flex items-center gap-2">
                  <div className={`flex-1 flex items-center justify-between p-3 rounded-xl border ${p.status === 'ATIVO' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                    <span className={`text-[9px] font-black uppercase ${p.status === 'ATIVO' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {p.status}
                    </span>
                    <button
                      onClick={() => updatePartner(p.id, { status: p.status === 'ATIVO' ? 'INATIVO' : 'ATIVO' })}
                      className="text-[8px] font-black text-zinc-500 hover:text-white transition-colors"
                    >
                      Alterar
                    </button>
                  </div>
                  <button
                    onClick={() => setShowQrModal(p)}
                    className="p-3 bg-[#C58A4A] text-black rounded-xl hover:scale-105 transition-all"
                  >
                    <QrCode size={16} />
                  </button>
                </div>

                {p.monthlyFee && p.monthlyFee > 0 ? (
                  <p className="text-[9px] text-zinc-500 font-black mt-3 text-right">
                    Mensalidade: <span className="text-[#C58A4A]">R$ {p.monthlyFee.toFixed(2)}</span>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══════════════ ABA COBRANÇAS ═══════════════ */}
      {activeTab === 'cobrancas' && (
        <div className="space-y-6">

          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-4">
            <div className={`rounded-[2rem] p-6 border ${themeCard}`}>
              <DollarSign size={20} className="text-[#C58A4A] mb-3"/>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total Mensal</p>
              <p className="text-2xl font-black text-[#C58A4A] font-display italic">R$ {totalMensalidades.toFixed(2)}</p>
            </div>
            <div className={`rounded-[2rem] p-6 border ${themeCard}`}>
              <Check size={20} className="text-emerald-500 mb-3"/>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Recebido</p>
              <p className="text-2xl font-black text-emerald-500 font-display italic">R$ {totalPagos.toFixed(2)}</p>
            </div>
            <div className={`rounded-[2rem] p-6 border ${themeCard} ${totalEmAberto > 0 ? 'border-red-500/30' : ''}`}>
              <AlertCircle size={20} className={`mb-3 ${totalEmAberto > 0 ? 'text-red-400' : 'text-zinc-500'}`}/>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Em Aberto</p>
              <p className={`text-2xl font-black font-display italic ${totalEmAberto > 0 ? 'text-red-400' : 'text-zinc-500'}`}>R$ {totalEmAberto.toFixed(2)}</p>
            </div>
          </div>

          {/* Lista de parceiros com mensalidade */}
          {parceirosComMensalidade.length === 0 ? (
            <div className={`text-center py-16 rounded-3xl border-2 border-dashed ${theme === 'light' ? 'border-zinc-200 text-zinc-400' : 'border-white/10 text-zinc-600'}`}>
              <DollarSign size={32} className="mx-auto mb-3 opacity-30"/>
              <p className="font-black uppercase text-[10px] tracking-widest">Nenhum parceiro com mensalidade cadastrada</p>
              <p className="text-[9px] mt-2 opacity-50">Cadastre parceiros com valor de mensalidade para controlar aqui</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                Mês de referência: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
              {parceirosComMensalidade.map((p: any) => {
                const isPago = (p.lastPaymentMonth || '') === currentMonth;
                return (
                  <div key={p.id} className={`rounded-[2rem] border p-6 transition-all ${isPago ? (theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/20') : (theme === 'light' ? 'bg-red-50 border-red-200' : 'bg-red-500/5 border-red-500/20')}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {p.logo ? (
                          <img src={p.logo} className="w-12 h-12 rounded-2xl object-cover border border-white/10" alt=""/>
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-[#C58A4A]/10 flex items-center justify-center text-[#C58A4A] font-black text-lg">
                            {(p.businessName || p.name || '?').charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className={`font-black text-sm ${txt}`}>{p.businessName || p.name}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{p.category}</p>
                          {p.phone && (
                            <p className="text-[9px] text-zinc-500 mt-0.5">{p.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-[#C58A4A]">R$ {(p.monthlyFee || 0).toFixed(2)}</p>
                        <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isPago ? 'text-emerald-500' : 'text-red-400'}`}>
                          {isPago ? '✅ Pago' : '⚠️ Em Aberto'}
                        </p>
                        {isPago && p.lastPaymentDate && (
                          <p className="text-[8px] text-zinc-500 mt-0.5">
                            Recebido em {new Date(p.lastPaymentDate).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botão de receber */}
                    {!isPago && (
                      <div className="mt-4 pt-4 border-t border-red-500/10">
                        {cobrancaPayingId === p.id ? (
                          <div className="space-y-3 animate-in fade-in">
                            <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Forma de recebimento:</p>
                            <div className="grid grid-cols-4 gap-2">
                              {(['PIX','DINHEIRO','DEBITO','CREDITO']).map(m => (
                                <button key={m} onClick={() => setCobrancaPayMethod(m)}
                                  className={`py-2 rounded-xl text-[8px] font-black uppercase border-2 transition-all ${cobrancaPayMethod === m ? 'border-[#C58A4A] bg-[#C58A4A]/20 text-[#C58A4A]' : theme === 'light' ? 'border-zinc-200 bg-zinc-50 text-zinc-400' : 'border-white/10 bg-white/5 text-zinc-500'}`}>
                                  {m === 'DINHEIRO' ? '💵' : m === 'PIX' ? '📱 PIX' : m === 'DEBITO' ? '💳 Déb' : '💳 Cré'}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setCobrancaPayingId(null)}
                                className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase border transition-all ${theme === 'light' ? 'bg-zinc-100 border-zinc-200 text-zinc-500' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
                                Cancelar
                              </button>
                              <button onClick={async () => {
                                  const now = new Date();
                                  await (store.updatePartner)(p.id, {
                                    lastPaymentMonth: currentMonth,
                                    lastPaymentDate: now.toISOString(),
                                    lastPaymentMethod: cobrancaPayMethod,
                                  });
                                  // Lança no financeiro
                                  await (store.addFinancialEntry)({
                                    description: `Mensalidade Parceiro — ${p.businessName || p.name}`,
                                    amount: p.monthlyFee,
                                    type: 'RECEITA',
                                    category: 'Mensalidade Parceiro',
                                    date: now.toISOString().split('T')[0],
                                  });
                                  setCobrancaPayingId(null);
                                }}
                                className="flex-1 py-3 rounded-xl font-black text-[9px] uppercase bg-emerald-500 text-white hover:bg-emerald-400 transition-all">
                                ✅ Confirmar Recebimento
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setCobrancaPayingId(p.id); setCobrancaPayMethod('PIX'); }}
                            className="w-full py-3 rounded-xl font-black text-[9px] uppercase bg-[#C58A4A] text-black hover:bg-[#E5A86A] transition-all">
                            💰 Registrar Pagamento da Mensalidade
                          </button>
                        )}
                      </div>
                    )}

                    {/* Já pago — botão de estornar */}
                    {isPago && (
                      <div className="mt-4 pt-4 border-t border-emerald-500/10 flex justify-end">
                        <button
                          onClick={() => { if (window.confirm('Estornar pagamento deste mês?')) { (store.updatePartner)(p.id, { lastPaymentMonth: '', lastPaymentDate: '', lastPaymentMethod: '' }); } }}
                          className="text-[8px] font-black text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-widest"
                        >
                          Estornar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ABA CLUBE DE BENEFÍCIOS ═══════════════ */}
      {activeTab === 'beneficios' && (
        <div className="space-y-8">
          {/* Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Gerados', value: benefitStats.total, icon: Gift, color: '#C58A4A' },
              { label: 'Disponíveis', value: benefitStats.disponiveis, icon: CheckCircle2, color: '#10b981' },
              { label: 'Utilizados', value: benefitStats.usados, icon: Award, color: '#3b82f6' },
              { label: 'Expirados', value: benefitStats.expirados, icon: AlertCircle, color: '#ef4444' },
            ].map((s, i) => (
              <div key={i} className={`rounded-[2rem] p-6 border ${themeCard}`}>
                <s.icon size={22} style={{ color: s.color }} className="mb-4" />
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{s.label}</p>
                <p className="text-2xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Uso por parceiro */}
          <div className={`rounded-[2rem] p-8 border ${themeCard}`}>
            <h3 className={`text-lg font-black font-display italic mb-6 flex items-center gap-3 ${txt}`}>
              <BarChart3 size={20} className="text-[#C58A4A]" /> Benefícios Usados por Parceiro
            </h3>
            {benefitsByPartner.length === 0 ? (
              <p className="text-[10px] text-zinc-500 italic text-center py-8">Nenhum benefício utilizado ainda.</p>
            ) : (
              <div className="space-y-4">
                {benefitsByPartner.map(([key, data]) => {
                  const maxCount = benefitsByPartner[0]?.[1]?.count || 1;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${txt}`}>{data.name}</span>
                        <span className="text-xs font-black text-[#C58A4A]">{data.count} usos</span>
                      </div>
                      <div className={`h-2 rounded-full ${theme === 'light' ? 'bg-zinc-100' : 'bg-white/10'}`}>
                        <div
                          className="h-full gradiente-ouro rounded-full transition-all duration-700"
                          style={{ width: `${(data.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lista detalhada de benefícios usados */}
          <div className={`rounded-[2rem] border overflow-hidden ${themeCard}`}>
            <div className="p-6 border-b border-white/5">
              <h3 className={`text-sm font-black uppercase tracking-widest ${txt}`}>
                Histórico de Usos — Relatório para Parceiros
              </h3>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className={`text-[9px] font-black uppercase tracking-[0.2em] border-b ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-500' : 'bg-white/[0.02] border-white/5 text-zinc-600'}`}>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Parceiro</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Data de Uso</th>
                    <th className="px-6 py-4">Validade</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'light' ? 'divide-zinc-100' : 'divide-white/5'}`}>
                  {(clientBenefits || [])
                    .slice()
                    .sort((a: ClientBenefit, b: ClientBenefit) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((b: ClientBenefit) => (
                      <tr key={b.id} className={`transition-colors ${theme === 'light' ? 'hover:bg-zinc-50' : 'hover:bg-white/[0.02]'}`}>
                        <td className="px-6 py-4">
                          <p className={`text-xs font-bold ${txt}`}>{b.clientName}</p>
                          <p className="text-[9px] text-zinc-500">{b.clientPhone}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-[#C58A4A]">{b.partnerName || '—'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-black uppercase border ${
                            b.status === 'USADO' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
                            b.status === 'DISPONIVEL' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
                            b.status === 'QR_GERADO' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
                            'text-zinc-500 bg-white/5 border-white/10'
                          }`}>
                            {b.status === 'USADO' ? <Check size={9} /> :
                             b.status === 'DISPONIVEL' ? <CheckCircle2 size={9} /> :
                             b.status === 'QR_GERADO' ? <Clock size={9} /> :
                             <AlertCircle size={9} />}
                            {b.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-zinc-400">
                            {b.usedAt ? new Date(b.usedAt).toLocaleString('pt-BR') : '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`text-xs font-bold ${new Date(b.expiryDate) < new Date() ? 'text-red-500' : 'text-emerald-500'}`}>
                            {new Date(b.expiryDate).toLocaleDateString('pt-BR')}
                          </p>
                        </td>
                      </tr>
                    ))}
                  {(!clientBenefits || clientBenefits.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-[10px] text-zinc-500 italic">
                        Nenhum benefício registrado ainda. Os benefícios são gerados automaticamente quando um atendimento é concluído.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal QR Code do Parceiro (referral) ─── */}
      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className={`w-full max-w-sm rounded-[3rem] p-10 space-y-8 border text-center shadow-2xl ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-[#C58A4A]/20'}`}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#C58A4A] mb-2">QR Code do Parceiro</p>
              <h2 className={`text-2xl font-black font-display italic ${txt}`}>
                {showQrModal.businessName || showQrModal.name}
              </h2>
            </div>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-2xl shadow-xl">
                <img
                  src={QR_API(showQrModal.qrCodeToken)}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Token</p>
              <p className={`font-black text-xl tracking-widest ${txt}`}>
                {showQrModal.qrCodeToken}
              </p>
              <p className={`text-[9px] mt-1 ${(showQrModal as any).isExpired ? 'text-red-500' : 'text-emerald-500'}`}>
                Validade: {new Date(showQrModal.qrCodeExpiry).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleCopyLink(showQrModal.qrCodeToken)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase text-[9px] border transition-all ${copied ? 'bg-emerald-500 text-white border-emerald-500' : theme === 'light' ? 'bg-zinc-100 border-zinc-200 text-zinc-700' : 'bg-white/5 border-white/10 text-zinc-400'}`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
              <button
                onClick={() => handleRegenerateQR(showQrModal)}
                className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 py-4 rounded-2xl font-black uppercase text-[9px] text-zinc-400 hover:text-white"
              >
                <RefreshCw size={14} /> Renovar
              </button>
            </div>
            <button
              onClick={() => setShowQrModal(null)}
              className={`w-full text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-600'}`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal Formulário de Parceiro ─── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className={`w-full max-w-lg rounded-[3rem] p-10 space-y-6 border shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-hide ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-[#C58A4A]/20'}`}>
            <div className="flex justify-between items-center">
              <h2 className={`text-2xl font-black font-display italic ${txt}`}>
                {editingId ? 'Editar Parceiro' : 'Novo Parceiro'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
            </div>

            {/* Upload de imagens */}
            <div className="grid grid-cols-2 gap-4">
              {/* Logo */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Logo</label>
                <div className="relative group h-24 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center">
                  {formData.logo ? (
                    <img src={formData.logo} className="w-full h-full object-contain p-2" alt="logo" />
                  ) : (
                    <ImageIcon className="text-zinc-600" size={24} />
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer rounded-2xl">
                    <Upload className="text-white" size={18} />
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload('logo', e)} />
                  </label>
                </div>
              </div>
              {/* Imagem/Banner */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Foto / Banner</label>
                <div className="relative group h-24 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center">
                  {formData.image ? (
                    <img src={formData.image} className="w-full h-full object-cover" alt="banner" />
                  ) : (
                    <ImageIcon className="text-zinc-600" size={24} />
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer rounded-2xl">
                    <Upload className="text-white" size={18} />
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload('image', e)} />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Categoria */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Categoria</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className={`w-full border p-4 rounded-xl outline-none font-bold text-xs transition-all appearance-none cursor-pointer ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-blue-500' : 'bg-zinc-900 border-white/10 text-white focus:border-[#C58A4A]'}`}
                  style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                >
                  {PARTNER_CATEGORIES.map(c => (
                    <option
                      key={c}
                      value={c}
                      style={{
                        backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                        color: theme === 'dark' ? '#ffffff' : '#18181b',
                      }}
                    >
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {[
                { key: 'businessName', label: 'Nome do Negócio', type: 'text', placeholder: 'Açaí do João' },
                { key: 'name', label: 'Nome do Responsável', type: 'text', placeholder: 'João Silva' },
                { key: 'phone', label: 'WhatsApp', type: 'tel', placeholder: '(21) 99999-9999' },
                { key: 'email', label: 'E-mail', type: 'email', placeholder: 'joao@empresa.com' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(formData as any)[f.key]}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                    className={inp}
                  />
                </div>
              ))}

              {/* Descrição */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Descrição Curta</label>
                <textarea
                  placeholder="Ex: O melhor açaí da região com ambiente premium..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className={`${inp} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Desconto ao Cliente %</label>
                  <input type="number" min={0} max={100} value={formData.discount} onChange={e => setFormData({ ...formData, discount: parseInt(e.target.value) || 0 })} className={inp} />
                </div>
                <div className="space-y-1">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Validade Benefício (dias)</label>
                  <input type="number" min={1} max={30} value={formData.benefitValidityDays} onChange={e => setFormData({ ...formData, benefitValidityDays: parseInt(e.target.value) || 7 })} className={inp} />
                </div>
                <div className="space-y-1">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Mensalidade (R$)</label>
                  <input type="number" min={0} step="0.01" value={formData.monthlyFee} onChange={e => setFormData({ ...formData, monthlyFee: parseFloat(e.target.value) || 0 })} className={inp} />
                </div>
                <div className="space-y-1">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Validade QR (dias)</label>
                  <input type="number" min={1} value={formData.expiryDays} onChange={e => setFormData({ ...formData, expiryDays: parseInt(e.target.value) || 30 })} className={inp} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[9px] ${theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}>Cancelar</button>
              <button onClick={handleSave} disabled={loadingImg} className="flex-1 gradiente-ouro text-black py-4 rounded-2xl font-black uppercase text-[9px]">
                {loadingImg ? 'Salvando...' : 'Salvar Parceiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Partners;
