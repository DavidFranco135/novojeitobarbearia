import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Phone, Search, CheckCheck, Trash2, User, ArrowLeft } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, orderBy, query, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { useBarberStore } from '../store';

const REPLY_URL = 'https://us-central1-financeiro-a7116.cloudfunctions.net/whatsappReply';

type Conversation = {
  id: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  lastMessage: string;
  lastMessageAt: number;
  unread: boolean;
};

type Message = {
  id: string;
  from: 'client' | 'admin';
  text: string;
  type: string;
  mediaUrl?: string;
  timestamp: number;
};

const Inbox: React.FC = () => {
  const { theme, clients } = useBarberStore() as any;
  const isDark = theme !== 'light';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv,  setSelectedConv]  = useState<Conversation | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [replyText,     setReplyText]     = useState('');
  const [sending,       setSending]       = useState(false);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [lightbox,       setLightbox]       = useState<string | null>(null);
  const [mobileView,    setMobileView]    = useState<'list' | 'chat'>('list');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inbox'), snap => {
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
      convs.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      setConversations(convs);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selectedConv) { setMessages([]); return; }
    const q = query(collection(db, 'inbox', selectedConv.id, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    updateDoc(doc(db, 'inbox', selectedConv.id), { unread: false }).catch(() => {});
    return unsub;
  }, [selectedConv?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConv = (conv: Conversation) => {
    setSelectedConv(conv);
    setMobileView('chat');
  };

  const handleSend = async () => {
    if (!replyText.trim() || !selectedConv || sending) return;
    setSending(true);
    const textToSend = replyText.trim();
    setReplyText('');
    try {
      const res = await fetch(REPLY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ convId: selectedConv.id, toPhone: selectedConv.clientPhone, text: textToSend }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar');
    } catch {
      alert('Erro ao enviar. Verifique a conexão.');
      setReplyText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const deleteConversation = async (convId: string) => {
    try {
      const msgsSnap = await getDocs(collection(db, 'inbox', convId, 'messages'));
      await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'inbox', convId));
      if (selectedConv?.id === convId) { setSelectedConv(null); setMobileView('list'); }
      setConfirmDelete(null);
    } catch { alert('Erro ao apagar conversa.'); }
  };

  const resolveClientName = (conv: Conversation) => {
    if (!clients) return conv.clientName;
    const phone = conv.clientPhone?.replace(/\D/g, '');
    const found = clients.find((cl: any) => cl.phone?.replace(/\D/g, '') === phone);
    return found?.name || conv.clientName;
  };

  const isRegistered = (conv: Conversation) => {
    if (!clients) return false;
    const phone = conv.clientPhone?.replace(/\D/g, '');
    return clients.some((cl: any) => cl.phone?.replace(/\D/g, '') === phone);
  };

  const totalUnread = conversations.filter(c => c.unread).length;

  const filteredConvs = conversations.filter(c =>
    resolveClientName(c).toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clientPhone.includes(searchTerm)
  );

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const divider = isDark ? 'border-white/5' : 'border-zinc-100';
  const txt     = isDark ? 'text-white'     : 'text-zinc-900';
  const sub     = isDark ? 'text-zinc-500'  : 'text-zinc-400';
  const panel   = isDark ? 'bg-black/40 border-white/5' : 'bg-white border-zinc-200';

  const ListPanel = (
    <div className={`flex flex-col h-full w-full border-r ${divider}`}>
      <div className={`px-4 pt-5 pb-3 shrink-0 border-b ${divider}`}>
        <div className="flex items-center gap-2 mb-3">
          <h1 className={`text-xl font-black font-display italic ${txt}`}>Mensagens</h1>
          {totalUnread > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-black">{totalUnread}</span>
          )}
        </div>
        <div className="relative">
          <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${sub}`} />
          <input
            type="text" placeholder="Pesquisar..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-8 pr-3 py-2 rounded-xl text-sm font-bold outline-none border ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600' : 'bg-zinc-100 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'}`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{WebkitOverflowScrolling:"touch", overflowY:"auto"}}>
        {filteredConvs.length === 0 && (
          <div className="p-8 text-center">
            <MessageCircle size={32} className={`mx-auto mb-3 ${sub}`} />
            <p className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>
              {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma mensagem ainda'}
            </p>
          </div>
        )}
        {filteredConvs.map(conv => (
          <div key={conv.id} className={`relative border-b group/conv ${divider} ${selectedConv?.id === conv.id ? (isDark ? 'bg-[#C58A4A]/10 border-l-4 border-l-[#C58A4A]' : 'bg-amber-50 border-l-4 border-l-[#C58A4A]') : ''}`}>
            <button onClick={() => openConv(conv)} onTouchEnd={e => { e.preventDefault(); openConv(conv); }} className={`w-full text-left px-4 py-4 flex items-center gap-3 transition-all ${isDark ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-black shrink-0 relative ${isDark ? 'bg-[#C58A4A]/20 text-[#C58A4A]' : 'bg-amber-100 text-amber-700'}`}>
                {resolveClientName(conv)?.charAt(0)?.toUpperCase() || '?'}
                {isRegistered(conv) && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-black flex items-center justify-center">
                    <User size={7} className="text-white" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className={`text-sm font-black truncate ${txt}`}>{resolveClientName(conv)}</p>
                  <span className={`text-[9px] shrink-0 ${sub}`}>{formatTime(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <p className={`text-[11px] truncate ${sub}`}>{conv.lastMessage}</p>
                  {conv.unread && <span className="w-2.5 h-2.5 rounded-full bg-[#C58A4A] shrink-0" />}
                </div>
              </div>
            </button>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(conv.id); }}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover/conv:opacity-100 transition-all ${isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-red-50 text-red-400 hover:bg-red-100'}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const ChatPanel = (
    <div className="flex flex-col h-full w-full min-w-0">
      {!selectedConv ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <MessageCircle size={48} className={sub} />
          <p className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Selecione uma conversa</p>
        </div>
      ) : (
        <>
          <div className={`px-4 py-3 flex items-center justify-between border-b shrink-0 ${divider}`}>
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileView('list')} onTouchEnd={e => { e.preventDefault(); setMobileView('list'); }} className={`md:hidden p-2 rounded-xl ${isDark ? 'bg-white/5 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                <ArrowLeft size={18} />
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-base shrink-0 ${isDark ? 'bg-[#C58A4A]/20 text-[#C58A4A]' : 'bg-amber-100 text-amber-700'}`}>
                {resolveClientName(selectedConv)?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <p className={`font-black text-sm ${txt}`}>{resolveClientName(selectedConv)}</p>
                <a href={`https://wa.me/${selectedConv.clientPhone}`} target="_blank" rel="noreferrer" className={`text-[10px] flex items-center gap-1 hover:text-[#C58A4A] transition-all ${sub}`}>
                  <Phone size={10} /> {selectedConv.clientPhone}
                </a>
              </div>
            </div>
            <button onClick={() => { setSelectedConv(null); setMobileView('list'); }} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500'}`}>
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide" style={{WebkitOverflowScrolling:"touch", overflowY:"auto"}}>
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Nenhuma mensagem</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl overflow-hidden ${msg.from === 'admin' ? 'bg-[#C58A4A] text-black rounded-br-sm' : isDark ? 'bg-white/10 text-white rounded-bl-sm' : 'bg-zinc-100 text-zinc-900 rounded-bl-sm'}`}>
                  {/* Imagem */}
                  {msg.mediaUrl && (msg.type === 'image' || msg.type === 'sticker') && (
                    <img
                      src={msg.mediaUrl}
                      alt="imagem"
                      onClick={() => setLightbox(msg.mediaUrl!)}
                      className="w-full max-w-[260px] cursor-pointer hover:opacity-90 transition-opacity block"
                    />
                  )}
                  {/* Texto */}
                  {(msg.text && msg.text !== '[📷 Imagem]' && msg.text !== '[🎭 Sticker]') && (
                    <p className="text-sm font-medium leading-snug whitespace-pre-wrap px-4 pt-2.5">{msg.text}</p>
                  )}
                  {/* Áudio com player */}
                  {(msg.type === 'audio' || msg.type === 'voice') && msg.mediaUrl && (
                    <div className="px-3 pt-2.5 pb-1">
                      <audio controls controlsList="nodownload" preload="none"
                        className="w-full max-w-[260px] h-9"
                        style={{filter: msg.from === 'admin' ? 'invert(0)' : 'none'}}
                      >
                        <source src={msg.mediaUrl} type="audio/ogg" />
                        <source src={msg.mediaUrl} type="audio/mpeg" />
                        <source src={msg.mediaUrl} type="audio/mp4" />
                      </audio>
                    </div>
                  )}
                  {/* Áudio sem URL */}
                  {(msg.type === 'audio' || msg.type === 'voice') && !msg.mediaUrl && (
                    <p className="text-sm font-medium px-4 pt-2.5">🎤 Áudio</p>
                  )}
                  {/* Sem URL mas é imagem */}
                  {!msg.mediaUrl && (msg.type === 'image' || msg.type === 'sticker') && (
                    <p className="text-sm font-medium px-4 pt-2.5">{msg.type === 'sticker' ? '🎭 Sticker' : '📷 Imagem'}</p>
                  )}
                  {/* Outros tipos sem media (exceto audio que já tratamos) */}
                  {!msg.mediaUrl && msg.type !== 'image' && msg.type !== 'sticker' && msg.type !== 'text' && msg.type !== 'audio' && msg.type !== 'voice' && (
                    <p className="text-sm font-medium px-4 pt-2.5">{msg.text}</p>
                  )}
                  <p className={`text-[9px] pb-2 px-4 pt-1 text-right ${msg.from === 'admin' ? 'text-black/50' : sub}`}>
                    {formatTime(msg.timestamp)}
                    {msg.from === 'admin' && <CheckCheck size={10} className="inline ml-1" />}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className={`p-3 border-t shrink-0 ${divider}`}>
            <div className="flex gap-2 items-end">
              <textarea
                rows={2} value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Digite sua resposta..."
                className={`flex-1 resize-none rounded-2xl p-3 text-sm font-medium outline-none border transition-all ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#C58A4A]/50' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]'}`}
              />
              <button onClick={handleSend} onTouchEnd={e => { e.preventDefault(); handleSend(); }} disabled={!replyText.trim() || sending}
                className="w-11 h-11 rounded-2xl gradiente-ouro text-black flex items-center justify-center shadow-lg disabled:opacity-40 hover:scale-105 active:scale-95 transition-all shrink-0">
                {sending ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className={`text-[9px] mt-1.5 ${isDark ? 'text-zinc-700' : 'text-zinc-400'}`}>
              ⚠️ Respostas entregues apenas dentro de 24h após a última mensagem do cliente.
            </p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col animate-in fade-in duration-500 overflow-hidden" style={{height:"100%", maxHeight:"100%"}}>

      {/* Header desktop */}
      <div className="hidden md:flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className={`text-3xl font-black font-display italic tracking-tight ${txt}`}>
            Mensagens
            {totalUnread > 0 && (
              <span className="ml-3 inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white text-xs font-black">{totalUnread}</span>
            )}
          </h1>
          <p className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>WhatsApp Business API</p>
        </div>
      </div>

      {/* Layout */}
      <div className={`flex-1 flex overflow-hidden rounded-[2rem] border ${panel}`}>
        {/* Desktop: lado a lado */}
        <div className="hidden md:flex w-80 shrink-0 h-full">{ListPanel}</div>
        <div className="hidden md:flex flex-1 min-w-0 h-full">{ChatPanel}</div>

        {/* Mobile: alterna */}
        <div className="flex md:hidden flex-1 min-w-0 h-full">
          {mobileView === 'list' ? ListPanel : ChatPanel}
        </div>
      </div>

      {/* Lightbox imagem */}
      {lightbox && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
            <X size={20}/>
          </button>
          <img src={lightbox} alt="imagem" className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl" onClick={e => e.stopPropagation()}/>
        </div>
      )}

      {/* Modal apagar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className={`w-full max-w-xs rounded-[2rem] p-7 space-y-5 ${isDark ? 'cartao-vidro border-white/10' : 'bg-white border border-zinc-200'}`} onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <h3 className={`font-black text-lg ${txt}`}>Apagar conversa?</h3>
              <p className={`text-[11px] ${sub}`}>Todas as mensagens serão apagadas permanentemente.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${isDark ? 'bg-white/5 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>Cancelar</button>
              <button onClick={() => deleteConversation(confirmDelete)} className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase bg-red-500 text-white">Apagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
