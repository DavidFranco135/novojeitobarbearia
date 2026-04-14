// pages/FilaEspera.tsx — Página pública da fila de espera
// Clientes acessam pelo celular, entram na fila sem precisar de login
import React, { useState, useEffect } from 'react';
import { useBarberStore } from '../store';

const FilaEspera: React.FC = () => {
  const store = useBarberStore() as any;
  const { professionals, waitQueue, addToWaitQueue, removeFromWaitQueue, config, theme } = store;

  const isDark = theme !== 'light';

  const [step, setStep] = useState<'form' | 'waiting' | 'called'>('form');
  const [name, setName] = useState('');
  const [profId, setProfId] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Monitora se foi chamado
  useEffect(() => {
    if (!myId) return;
    const myEntry = waitQueue.find((w: any) => w.id === myId);
    if (!myEntry) {
      // Removido da fila = foi chamado ou saiu
      if (step === 'waiting') setStep('called');
    } else if (myEntry.status === 'CHAMADO') {
      setStep('called');
    }
  }, [waitQueue, myId, step]);

  const activePros = (professionals || []).filter((p: any) => p.status !== 'INATIVO');

  const myPosition = myId
    ? waitQueue.filter((w: any) => w.status === 'AGUARDANDO').findIndex((w: any) => w.id === myId) + 1
    : 0;

  const handleEntrar = async () => {
    if (!name.trim()) return alert('Digite seu nome.');
    setLoading(true);
    try {
      const prof = activePros.find((p: any) => p.id === profId);
      const entry = {
        name: name.trim(),
        profId: profId || '',
        profName: prof?.name || 'Qualquer barbeiro',
        since: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'AGUARDANDO',
      };
      const ref = await addToWaitQueue(entry);
      // addDoc returns void, get the id from waitQueue after
      // Use a short polling to get the id
      setTimeout(() => {
        const found = waitQueue.find((w: any) =>
          w.name === entry.name && w.since === entry.since
        );
        if (found) setMyId(found.id);
      }, 1500);
      setStep('waiting');
    } catch (e) {
      alert('Erro ao entrar na fila. Tente novamente.');
    }
    setLoading(false);
  };

  const handleSair = async () => {
    if (myId) await removeFromWaitQueue(myId);
    setMyId(null);
    setStep('form');
    setName('');
    setProfId('');
  };

  const bg = isDark ? 'bg-[#050505]' : 'bg-[#F8F9FA]';
  const card = isDark ? 'bg-[#0f0f0f] border border-white/10' : 'bg-white border border-zinc-200 shadow-lg';
  const txt = isDark ? 'text-white' : 'text-zinc-900';
  const sub = isDark ? 'text-zinc-500' : 'text-zinc-500';
  const inp = `w-full border p-4 rounded-2xl text-sm font-bold outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#C58A4A]' : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500'}`;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${bg}`}>

      {/* Logo + nome */}
      <div className="text-center mb-8">
        {config?.logo && (
          <img src={config.logo} className="w-20 h-20 rounded-3xl mx-auto mb-4 object-cover shadow-2xl" alt=""/>
        )}
        <h1 className={`text-2xl font-black font-display italic ${txt}`}>{config?.name || 'Barbearia'}</h1>
        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${sub}`}>Lista de Espera</p>
      </div>

      {/* STEP: FORM */}
      {step === 'form' && (() => {
        // Verifica se a barbearia está aberta
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const [openH, openM] = (config?.openingTime || '08:00').split(':').map(Number);
        const [closeH, closeM] = (config?.closingTime || '20:00').split(':').map(Number);
        const isOpen = nowMinutes >= (openH * 60 + openM) && nowMinutes < (closeH * 60 + closeM);

        // Verifica se há barbeiro disponível hoje
        const todayDow = now.getDay();
        const hasBarber = (activePros || []).some((p: any) => {
          const ws = (p as any).weekSchedule;
          const day = ws ? (ws[todayDow] || ws[String(todayDow)]) : null;
          return day ? day.active !== false : true;
        });

        if (!isOpen || !hasBarber) {
          return (
            <div className={`w-full max-w-sm rounded-[2.5rem] p-8 space-y-5 text-center ${card}`}>
              <div className="text-5xl">🔒</div>
              <h2 className={`text-xl font-black font-display italic ${txt}`}>
                {!isOpen ? 'Barbearia Fechada' : 'Sem Barbeiros Hoje'}
              </h2>
              <p className={`text-sm ${sub}`}>
                {!isOpen
                  ? `Funcionamos das ${config?.openingTime || '08:00'} às ${config?.closingTime || '20:00'}. Volte em breve!`
                  : 'Todos os barbeiros estão de folga hoje. Volte em outro dia!'}
              </p>
            </div>
          );
        }

        return (
        <div className={`w-full max-w-sm rounded-[2.5rem] p-8 space-y-5 ${card}`}>
          <div>
            <h2 className={`text-xl font-black font-display italic ${txt}`}>Entre na fila ✂️</h2>
            <p className={`text-[11px] mt-1 ${sub}`}>Adicione seu nome e aguarde ser chamado.</p>
          </div>

          <input
            type="text"
            placeholder="Seu nome *"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inp}
          />

          <select
            value={profId}
            onChange={e => setProfId(e.target.value)}
            className={inp}
          >
            <option value="">Qualquer barbeiro</option>
            {activePros.map((p: any) => (
              <option key={p.id} value={p.id} className="bg-zinc-950">{p.name}</option>
            ))}
          </select>

          {/* Fila atual */}
          {waitQueue.filter((w: any) => w.status === 'AGUARDANDO').length > 0 && (
            <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/3 border border-white/5' : 'bg-zinc-50 border border-zinc-100'}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${sub}`}>
                ⏳ {waitQueue.filter((w: any) => w.status === 'AGUARDANDO').length} na fila agora
              </p>
              {waitQueue.filter((w: any) => w.status === 'AGUARDANDO').map((w: any, i: number) => (
                <div key={w.id} className="flex items-center gap-2 py-1">
                  <span className="text-[#C58A4A] font-black text-xs w-4">{i + 1}.</span>
                  <span className={`text-xs font-bold ${txt}`}>{w.name}</span>
                  <span className={`text-[9px] ml-auto ${sub}`}>{w.profName !== 'Qualquer barbeiro' ? w.profName : ''}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleEntrar}
            disabled={loading}
            className="w-full gradiente-ouro text-black py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '⏳ Entrando...' : '✂️ Entrar na fila'}
          </button>
        </div>
        );
      })()}

      {/* STEP: AGUARDANDO */}
      {step === 'waiting' && (
        <div className={`w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 text-center ${card}`}>
          {/* Número na fila */}
          <div>
            <div className="w-24 h-24 rounded-full gradiente-ouro flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-[#C58A4A]/30">
              <span className="text-4xl font-black text-black">{myPosition || '...'}</span>
            </div>
            <h2 className={`text-2xl font-black font-display italic ${txt}`}>Você está na fila!</h2>
            <p className={`text-[11px] mt-1 ${sub}`}>Posição atual · fique de olho na tela</p>
          </div>

          <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/3 border border-white/5' : 'bg-zinc-50 border border-zinc-100'} text-left space-y-2`}>
            <div className="flex justify-between">
              <span className={`text-[10px] font-black uppercase ${sub}`}>Nome</span>
              <span className={`text-sm font-black ${txt}`}>{name}</span>
            </div>
            <div className="flex justify-between">
              <span className={`text-[10px] font-black uppercase ${sub}`}>Barbeiro</span>
              <span className={`text-sm font-black ${txt}`}>{activePros.find((p: any) => p.id === profId)?.name || 'Qualquer'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#C58A4A] animate-bounce" style={{animationDelay:'0ms'}}/>
            <div className="w-2 h-2 rounded-full bg-[#C58A4A] animate-bounce" style={{animationDelay:'150ms'}}/>
            <div className="w-2 h-2 rounded-full bg-[#C58A4A] animate-bounce" style={{animationDelay:'300ms'}}/>
          </div>
          <p className={`text-[11px] ${sub}`}>Aguarde ser chamado pelo barbeiro</p>

          <button
            onClick={handleSair}
            className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase border transition-all ${isDark ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:text-zinc-900'}`}
          >
            Sair da fila
          </button>
        </div>
      )}

      {/* STEP: CHAMADO */}
      {step === 'called' && (
        <div className={`w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 text-center ${card}`}>
          <div className="text-6xl animate-bounce">✂️</div>
          <h2 className={`text-2xl font-black font-display italic ${txt}`}>É a sua vez!</h2>
          <p className={`text-sm ${sub}`}>O barbeiro está esperando por você.</p>
          <button
            onClick={() => { setStep('form'); setName(''); setProfId(''); setMyId(null); }}
            className="w-full gradiente-ouro text-black py-4 rounded-2xl font-black uppercase tracking-widest text-sm"
          >
            Obrigado! ✓
          </button>
        </div>
      )}
    </div>
  );
};

export default FilaEspera;
