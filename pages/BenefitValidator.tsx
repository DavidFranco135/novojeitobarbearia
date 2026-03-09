// ============================================================
// pages/BenefitValidator.tsx — Validação de QR Code pelo Parceiro
// NOVO ARQUIVO — acessado via URL: ?validateBenefit=TOKEN
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  QrCode, Check, X, AlertCircle, Loader2, User,
  Gift, CheckCircle2, Scissors, Phone
} from 'lucide-react';
import { useBarberStore } from '../store';
import { ClientBenefit } from '../types';

interface BenefitValidatorProps {
  token: string;
  onBack: () => void;
}

type ValidationState = 'idle' | 'loading' | 'valid' | 'invalid' | 'used' | 'expired' | 'confirmed';

const BenefitValidator: React.FC<BenefitValidatorProps> = ({ token, onBack }) => {
  const store = useBarberStore() as any;
  const { validateAndUseBenefit, clientBenefits, theme } = store;

  const [state, setState] = useState<ValidationState>('idle');
  const [benefit, setBenefit] = useState<ClientBenefit | null>(null);
  const [previewBenefit, setPreviewBenefit] = useState<ClientBenefit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isDark = theme !== 'light';

  // Ao carregar, busca o benefício pelo token para preview
  useEffect(() => {
    if (!token) return;
    const now = new Date();
    const found = (clientBenefits || []).find((b: ClientBenefit) => b.qrToken === token);
    if (!found) {
      setState('invalid');
      return;
    }
    if (found.status === 'USADO') {
      setState('used');
      setPreviewBenefit(found);
      return;
    }
    if (found.status === 'EXPIRADO' || new Date(found.expiryDate) < now) {
      setState('expired');
      setPreviewBenefit(found);
      return;
    }
    if (found.qrExpiryDate && new Date(found.qrExpiryDate) < now) {
      setState('expired');
      setPreviewBenefit(found);
      return;
    }
    setPreviewBenefit(found);
    setState('valid');
  }, [token, clientBenefits]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const result = await validateAndUseBenefit(token);
      if (result) {
        setBenefit(result);
        setState('confirmed');
      } else {
        setState('invalid');
        setError('Este QR Code não pôde ser validado. Pode estar expirado ou já utilizado.');
      }
    } catch (err) {
      setState('invalid');
      setError('Erro ao validar. Tente novamente.');
    } finally {
      setConfirming(false);
    }
  };

  const bg = isDark ? 'bg-[#050505]' : 'bg-[#F8F9FA]';
  const card = isDark ? 'bg-[#0A0A0A] border-white/10' : 'bg-white border-zinc-200 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-zinc-900';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${bg}`}>
      {/* Logo / Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 gradiente-ouro rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
          <Scissors size={28} className="text-black" />
        </div>
        <h1 className={`text-2xl font-black font-display italic ${txt}`}>Clube de Benefícios</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Validação de QR Code</p>
      </div>

      <div className={`w-full max-w-sm rounded-[3rem] p-10 border space-y-8 shadow-2xl ${card}`}>

        {/* Token */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
            <QrCode size={12} /> {token}
          </div>
        </div>

        {/* ── ESTADO: LOADING ── */}
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 size={40} className="text-[#C58A4A] animate-spin" />
            <p className={`text-sm font-bold ${txt}`}>Verificando QR Code...</p>
          </div>
        )}

        {/* ── ESTADO: VÁLIDO — Aguardando Confirmação ── */}
        {state === 'valid' && previewBenefit && (
          <>
            <div className="space-y-6">
              {/* Info do Cliente */}
              <div className={`p-5 rounded-2xl border ${isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-300 bg-emerald-50'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-3">
                  ✅ QR Code Válido
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 gradiente-ouro rounded-xl flex items-center justify-center text-xl font-black text-black">
                    {previewBenefit.clientName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className={`font-black text-lg ${txt}`}>{previewBenefit.clientName}</p>
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Phone size={10} /> {previewBenefit.clientPhone}
                    </p>
                  </div>
                </div>
              </div>

              {/* Benefício */}
              <div className={`p-5 rounded-2xl border ${isDark ? 'border-[#C58A4A]/20 bg-[#C58A4A]/5' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex items-center gap-3">
                  <Gift size={24} className="text-[#C58A4A]" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A]">Benefício</p>
                    <p className={`font-black text-sm ${txt}`}>
                      Desconto especial para cliente da barbearia
                    </p>
                    <p className="text-[9px] text-zinc-500">
                      Parceiro: {previewBenefit.partnerName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Validade */}
              <div className="text-center">
                <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Benefício válido até
                </p>
                <p className="text-emerald-500 font-black text-sm">
                  {new Date(previewBenefit.expiryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Botão Confirmar */}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full gradiente-ouro text-black py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {confirming ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Confirmando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Check size={16} /> Confirmar Uso do Benefício
                </span>
              )}
            </button>

            <p className={`text-[9px] text-center font-bold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
              ⚠️ Após confirmar, o QR Code será invalidado permanentemente.
            </p>
          </>
        )}

        {/* ── ESTADO: CONFIRMADO ── */}
        {state === 'confirmed' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
              <CheckCircle2 size={48} className="text-white" />
            </div>
            <div>
              <h3 className={`text-2xl font-black font-display italic ${txt}`}>Benefício Confirmado!</h3>
              <p className={`text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                O desconto foi aplicado com sucesso.
              </p>
            </div>
            {benefit && (
              <div className={`w-full p-5 rounded-2xl border ${isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-300 bg-emerald-50'}`}>
                <p className={`font-black ${txt}`}>{benefit.clientName}</p>
                <p className="text-[10px] text-emerald-500 font-bold mt-1">
                  Usado em {benefit.usedAt ? new Date(benefit.usedAt).toLocaleString('pt-BR') : 'agora'}
                </p>
              </div>
            )}
            <p className={`text-[9px] font-bold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
              Este QR Code foi invalidado e não pode mais ser utilizado.
            </p>
          </div>
        )}

        {/* ── ESTADO: JÁ UTILIZADO ── */}
        {state === 'used' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center">
              <X size={40} className="text-zinc-400" />
            </div>
            <div>
              <h3 className={`text-xl font-black font-display italic ${txt}`}>Já Utilizado</h3>
              <p className={`text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Este QR Code já foi usado anteriormente e não pode ser reutilizado.
              </p>
            </div>
            {previewBenefit?.usedAt && (
              <p className="text-[10px] text-zinc-500 font-bold">
                Usado em: {new Date(previewBenefit.usedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* ── ESTADO: EXPIRADO ── */}
        {state === 'expired' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertCircle size={40} className="text-amber-500" />
            </div>
            <div>
              <h3 className={`text-xl font-black font-display italic ${txt}`}>QR Code Expirado</h3>
              <p className={`text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                O prazo de validade deste QR Code já passou. O cliente precisa gerar um novo.
              </p>
            </div>
          </div>
        )}

        {/* ── ESTADO: INVÁLIDO ── */}
        {state === 'invalid' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <div>
              <h3 className={`text-xl font-black font-display italic ${txt}`}>QR Code Inválido</h3>
              <p className={`text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {error || 'Este QR Code não foi encontrado ou é inválido.'}
              </p>
            </div>
          </div>
        )}

        {/* Voltar */}
        <button
          onClick={onBack}
          className={`w-full py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all ${isDark ? 'bg-white/5 text-zinc-500 hover:text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}
        >
          Voltar ao Site
        </button>
      </div>
    </div>
  );
};

export default BenefitValidator;
