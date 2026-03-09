// ============================================================
// components/ClubeBeneficios.tsx — Clube de Benefícios (App do Cliente)
// NOVO ARQUIVO — não modifica nenhuma lógica existente
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  Gift, QrCode, ChevronLeft, Check, Clock, AlertCircle,
  MapPin, Phone, Tag, X, CheckCircle2, Sparkles, RefreshCw
} from 'lucide-react';
import { useBarberStore } from '../store';
import { ClientBenefit, Partner } from '../types';

interface ClubeBeneficiosProps {
  clientId: string;
  onClose: () => void;
}

const QR_IMG = (token: string, size = 240) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    `${window.location.origin}?validateBenefit=${token}`
  )}`;

const CATEGORY_ICONS: Record<string, string> = {
  'Açaí': '🍧',
  'Hamburgueria': '🍔',
  'Loja Masculina': '👔',
  'Academia': '💪',
  'Lava-jato': '🚗',
  'Ótica': '👓',
  'Restaurante': '🍽️',
  'Farmácia': '💊',
  'Pet Shop': '🐾',
  'Outro': '🏪',
};

const ClubeBeneficios: React.FC<ClubeBeneficiosProps> = ({ clientId, onClose }) => {
  const store = useBarberStore() as any;
  const { theme, partners, clientBenefits, generateBenefitQR } = store;

  const [step, setStep] = useState<'benefits' | 'partners' | 'qr'>('benefits');
  const [selectedBenefit, setSelectedBenefit] = useState<ClientBenefit | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const now = new Date();

  // Benefícios deste cliente
  const myBenefits = useMemo((): ClientBenefit[] => {
    const all: ClientBenefit[] = clientBenefits || [];
    return all
      .filter(b => b.clientId === clientId)
      .map(b => {
        // Auto-marcar expirados
        if (b.status === 'DISPONIVEL' && new Date(b.expiryDate) < now) {
          return { ...b, status: 'EXPIRADO' as const };
        }
        return b;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [clientBenefits, clientId, now]);

  const availableBenefit = myBenefits.find(b => b.status === 'DISPONIVEL' || b.status === 'QR_GERADO');
  const hasAvailable = !!availableBenefit;

  // Parceiros ativos
  const activePartners: Partner[] = useMemo(() => {
    return (partners || []).filter((p: Partner) => p.status === 'ATIVO');
  }, [partners]);

  const handleSelectBenefit = (benefit: ClientBenefit) => {
    setSelectedBenefit(benefit);
    setStep('partners');
  };

  const handleSelectPartner = async (partner: Partner) => {
    if (!selectedBenefit) return;

    // Se já tem QR gerado para este parceiro, mostra direto
    if (selectedBenefit.status === 'QR_GERADO' && selectedBenefit.partnerId === partner.id && selectedBenefit.qrToken) {
      // Verifica se QR ainda é válido
      if (selectedBenefit.qrExpiryDate && new Date(selectedBenefit.qrExpiryDate) < now) {
        setQrError('Este QR Code expirou. Gere um novo.');
        setSelectedPartner(partner);
        setStep('qr');
        return;
      }
      setSelectedPartner(partner);
      setGeneratedToken(selectedBenefit.qrToken);
      setStep('qr');
      return;
    }

    setLoading(true);
    setQrError(null);
    try {
      const token = await generateBenefitQR(selectedBenefit.id, partner.id, partner.businessName || partner.name);
      setSelectedPartner(partner);
      setGeneratedToken(token);
      setStep('qr');
    } catch (err) {
      alert('Erro ao gerar QR Code. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme !== 'light';
  const card = isDark ? 'cartao-vidro border-white/5' : 'bg-white border-zinc-200 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-zinc-900';

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in">
      <div className={`w-full max-w-2xl rounded-t-[3rem] sm:rounded-[3rem] border max-h-[92vh] flex flex-col ${isDark ? 'bg-[#0A0A0A] border-white/10' : 'bg-[#F8F9FA] border-zinc-200'}`}>

        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-white/10' : 'border-zinc-200'}`}>
          <div className="flex items-center gap-3">
            {step !== 'benefits' && (
              <button
                onClick={() => { setStep(step === 'qr' ? 'partners' : 'benefits'); setQrError(null); }}
                className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-zinc-400' : 'bg-zinc-100 text-zinc-600'}`}
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A]">Clube de Benefícios 🎁</p>
              <h2 className={`text-xl font-black font-display italic ${txt}`}>
                {step === 'benefits' && 'Meus Benefícios'}
                {step === 'partners' && 'Escolha um Parceiro'}
                {step === 'qr' && 'Seu QR Code'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className={`p-3 rounded-2xl ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">

          {/* ── STEP 1: Meus Benefícios ── */}
          {step === 'benefits' && (
            <>
              {/* Banner informativo */}
              <div className="gradiente-ouro rounded-2xl p-6 text-black">
                <div className="flex items-start gap-4">
                  <Gift size={32} className="flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-black text-sm uppercase tracking-widest">Como funciona?</p>
                    <p className="text-xs font-bold mt-1 leading-relaxed opacity-80">
                      A cada atendimento concluído, você ganha <strong>1 benefício</strong> para usar em qualquer parceiro.
                      Válido por 7 dias. Uso único, anti-fraude.
                    </p>
                  </div>
                </div>
              </div>

              {myBenefits.length === 0 ? (
                <div className={`rounded-2xl p-12 text-center border ${card}`}>
                  <Gift className="mx-auto mb-4 text-zinc-500" size={40} />
                  <p className={`font-black text-sm uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Nenhum benefício ainda
                  </p>
                  <p className={`text-xs mt-2 ${isDark ? 'text-zinc-600' : 'text-zinc-500'}`}>
                    Complete um atendimento para ganhar seu primeiro benefício!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myBenefits.map(benefit => {
                    const isAvailable = benefit.status === 'DISPONIVEL';
                    const isQrGerado = benefit.status === 'QR_GERADO';
                    const isUsed = benefit.status === 'USADO';
                    const isExpired = benefit.status === 'EXPIRADO' || new Date(benefit.expiryDate) < now;

                    const daysLeft = Math.ceil((new Date(benefit.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <div
                        key={benefit.id}
                        className={`rounded-2xl p-5 border transition-all ${
                          isAvailable || isQrGerado
                            ? isDark
                              ? 'border-[#C58A4A]/40 bg-[#C58A4A]/5 cursor-pointer hover:bg-[#C58A4A]/10'
                              : 'border-amber-400/40 bg-amber-50 cursor-pointer hover:bg-amber-100'
                            : isDark
                              ? `${card} opacity-60`
                              : 'bg-zinc-50 border-zinc-200 opacity-60'
                        }`}
                        onClick={() => (isAvailable || isQrGerado) ? handleSelectBenefit(benefit) : undefined}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                              isAvailable ? 'bg-[#C58A4A]' :
                              isQrGerado ? 'bg-amber-500' :
                              isUsed ? 'bg-emerald-500/20' : 'bg-zinc-800'
                            }`}>
                              {isAvailable && '🎁'}
                              {isQrGerado && '📱'}
                              {isUsed && <Check size={20} className="text-emerald-500" />}
                              {isExpired && <AlertCircle size={20} className="text-zinc-500" />}
                            </div>
                            <div>
                              <p className={`font-black text-sm ${isAvailable || isQrGerado ? 'text-[#C58A4A]' : isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                {isAvailable && 'Benefício Disponível'}
                                {isQrGerado && `QR Gerado — ${benefit.partnerName}`}
                                {isUsed && `Usado em ${benefit.usedByPartnerName || 'Parceiro'}`}
                                {isExpired && 'Benefício Expirado'}
                              </p>
                              <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                Ganho em: {new Date(benefit.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {(isAvailable || isQrGerado) && (
                              <>
                                <p className={`text-xs font-black ${daysLeft <= 2 ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {daysLeft > 0 ? `${daysLeft}d` : 'Hoje!'}
                                </p>
                                <p className={`text-[8px] font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>restantes</p>
                              </>
                            )}
                            {isUsed && benefit.usedAt && (
                              <p className="text-[9px] text-emerald-500 font-black">
                                {new Date(benefit.usedAt).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>

                        {(isAvailable || isQrGerado) && (
                          <div className={`mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${
                            isQrGerado
                              ? 'bg-amber-500/20 text-amber-500'
                              : 'bg-[#C58A4A] text-black'
                          }`}>
                            <QrCode size={14} />
                            {isQrGerado ? 'Ver QR Code' : 'Gerar QR Code'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Lista de parceiros (preview) */}
              {activePartners.length > 0 && (
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Parceiros Disponíveis
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {activePartners.map(p => (
                      <div
                        key={p.id}
                        className={`rounded-2xl p-4 border text-center transition-all ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-zinc-200'} ${!hasAvailable ? 'opacity-40' : ''}`}
                      >
                        {p.logo ? (
                          <img src={p.logo} className="w-10 h-10 rounded-xl object-contain mx-auto mb-2" alt={p.businessName} />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[#C58A4A]/20 flex items-center justify-center mx-auto mb-2 text-lg">
                            {CATEGORY_ICONS[p.category || 'Outro'] || '🏪'}
                          </div>
                        )}
                        <p className={`text-[10px] font-black truncate ${txt}`}>{p.businessName || p.name}</p>
                        <p className="text-[9px] text-[#C58A4A] font-black mt-0.5">{p.discount}% OFF</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: Escolha o Parceiro ── */}
          {step === 'partners' && (
            <>
              {selectedBenefit && (
                <div className={`p-4 rounded-2xl border border-[#C58A4A]/30 bg-[#C58A4A]/5 flex items-center gap-3`}>
                  <Gift size={20} className="text-[#C58A4A] flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#C58A4A]">Benefício Selecionado</p>
                    <p className={`text-xs font-bold ${txt}`}>
                      Válido até {new Date(selectedBenefit.expiryDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              )}

              {activePartners.length === 0 ? (
                <div className={`rounded-2xl p-12 text-center border ${card}`}>
                  <p className={`font-black text-sm uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Nenhum parceiro ativo no momento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activePartners.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPartner(p)}
                      disabled={loading}
                      className={`rounded-2xl border p-5 text-left transition-all hover:border-[#C58A4A]/50 group ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-zinc-200 hover:bg-amber-50'}`}
                    >
                      {/* Imagem do parceiro */}
                      {p.image && (
                        <div className="w-full h-24 rounded-xl overflow-hidden mb-4">
                          <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-all" alt={p.businessName} />
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        {p.logo ? (
                          <img src={p.logo} className="w-10 h-10 rounded-xl object-contain flex-shrink-0" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[#C58A4A]/20 flex items-center justify-center flex-shrink-0 text-xl">
                            {CATEGORY_ICONS[p.category || 'Outro'] || '🏪'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-black text-sm truncate ${txt}`}>{p.businessName || p.name}</p>
                          {p.category && (
                            <span className={`text-[8px] font-black uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{p.category}</span>
                          )}
                          {p.description && (
                            <p className={`text-[10px] mt-1 line-clamp-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{p.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black text-black gradiente-ouro">
                          {p.discount}% OFF
                        </span>
                        {p.phone && (
                          <span className={`text-[9px] font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {p.phone}
                          </span>
                        )}
                      </div>

                      <div className={`mt-3 w-full py-2.5 rounded-xl text-[9px] font-black uppercase text-center transition-all ${
                        loading
                          ? isDark ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-400'
                          : 'gradiente-ouro text-black group-hover:scale-[1.02]'
                      }`}>
                        {loading ? 'Gerando...' : '📱 Usar Desconto'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── STEP 3: QR Code ── */}
          {step === 'qr' && selectedPartner && (
            <div className="flex flex-col items-center gap-6 text-center">
              {qrError ? (
                <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl w-full">
                  <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
                  <p className="text-red-500 font-black text-sm">{qrError}</p>
                  <button
                    onClick={() => { setStep('partners'); setQrError(null); }}
                    className="mt-4 gradiente-ouro text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase"
                  >
                    Gerar Novo QR
                  </button>
                </div>
              ) : generatedToken ? (
                <>
                  {/* Info do parceiro */}
                  <div className={`w-full p-5 rounded-2xl border flex items-center gap-4 ${isDark ? 'border-[#C58A4A]/30 bg-[#C58A4A]/5' : 'border-amber-300 bg-amber-50'}`}>
                    <div className="text-2xl">{CATEGORY_ICONS[selectedPartner.category || 'Outro'] || '🏪'}</div>
                    <div className="text-left">
                      <p className="font-black text-[#C58A4A] text-sm">{selectedPartner.businessName || selectedPartner.name}</p>
                      <p className={`text-[10px] font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {selectedPartner.discount}% de desconto · Apresente o QR na recepção
                      </p>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white p-6 rounded-[2rem] shadow-2xl shadow-[#C58A4A]/20">
                    <img
                      src={QR_IMG(generatedToken)}
                      alt="QR Code Benefício"
                      className="w-56 h-56"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border ${isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-300 bg-emerald-50'}`}>
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                        Válido para uso único
                      </span>
                    </div>
                    <p className={`text-[9px] font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      QR Code expira em 24h. Mostre ao parceiro para confirmar.
                    </p>
                  </div>

                  {/* Instruções */}
                  <div className={`w-full p-5 rounded-2xl border space-y-3 text-left ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Como usar</p>
                    {[
                      '📱 Mostre este QR Code ao atendente do parceiro',
                      '✅ Ele vai escanear e confirmar no sistema',
                      '🎉 Seu desconto será aplicado automaticamente',
                    ].map((step, i) => (
                      <p key={i} className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{step}</p>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#C58A4A] border-t-transparent rounded-full animate-spin" />
                  <p className={`text-sm font-bold ${txt}`}>Gerando QR Code seguro...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClubeBeneficios;
