import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Phone, Search, Circle, Check, CheckCheck, Trash2, User } from 'lucide-react';
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
  timestamp: number;
};

const Inbox: React.FC = () => {
  const { theme, clients } = useBarberStore() as any;
  const isDark = theme !== 'light';

  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [selectedConv,  setSelectedConv]    = useState<Conversation | null>(null);
  const [messages,      setMessages]        = useState<Message[]>([]);
  const [replyText,     setReplyText]       = useState('');
  const [sending,       setSending]         = useState(false);
  const [searchTerm,    setSearchTerm]      = useState('');
  const [confirmDelete, setConfirmDelete]   = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const cardClass = isDark ? 'cartao-vidro border-white/5' : 'bg-white border border-zinc-200 shadow-sm';

  // Escuta conversas em tempo real
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'inbox'),
      snap => {
        const convs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
        convs.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        setConversations(convs);
      }
    );
    return unsub;
  }, []);

  // Escuta mensagens da conversa selecionada
  useEffect(() => {
    if (!selectedConv) { setMessages([]); return; }
    const q = query(
      collection(db, 'inbox', selectedConv.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    // Marca como lida
    updateDoc(doc(db, 'inbox', selectedConv.id), { unread: false }).catch(() => {});
    return unsub;
  }, [selectedConv?.id]);

  // Rola para o fim quando mensagens mudam
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!replyText.trim() || !selectedConv || sending) return;
    setSending(true);
    const textToSend = replyText.trim();
    setReplyText('');
    try {
      const res = await fetch(REPLY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          convId: selectedConv.id,
          toPhone: selectedConv.clientPhone,
          text: textToSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar');
      if (data.sent === false && data.saved) {
        // Mensagem salva no histórico mas não entregue pelo Meta
        console.warn('Mensagem salva mas não entregue:', data.warning);
      }
    } catch (err) {
      alert('Erro ao enviar mensagem. Verifique a conexão.');
      setReplyText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const deleteConversation = async (convId: string) => {
    try {
      // Deleta todas as mensagens da subcolecao
      const msgsSnap = await getDocs(collection(db, 'inbox', convId, 'messages'));
      await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
      // Deleta o documento da conversa
      await deleteDoc(doc(db, 'inbox', convId));
      if (selectedConv?.id === convId) setSelectedConv(null);
      setConfirmDelete(null);
    } catch (err) {
      alert('Erro ao apagar conversa.');
    }
  };

  // Resolve nome do cliente pelo telefone
  const resolveClientName = (conv: Conversation) => {
    if (!clients) return conv.clientName;
    const phone = conv.clientPhone?.replace(/\D/g, '');
    const found = clients.find((cl: any) => cl.phone?.replace(/\D/g, '') === phone);
    return found?.name || conv.clientName;
  };

  const totalUnread = conversations.filter(c => c.unread).length;

  const filteredConvs = conversations.filter(c =>
    c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clientPhone.includes(searchTerm)
  );

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className={`text-3xl font-black font-display italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Mensagens
            {totalUnread > 0 && (
              <span className="ml-3 inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white text-xs font-black">
                {totalUnread}
              </span>
            )}
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            WhatsApp Business API — respostas dos clientes
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className={`flex-1 flex overflow-hidden rounded-[2.5rem] border ${isDark ? 'border-white/5 bg-black/20' : 'border-zinc-200 bg-white'}`}>

        {/* ── Lista de conversas ── */}
        <div className={`w-80 shrink-0 flex flex-col border-r ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
          {/* Search */}
          <div className="p-4 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-bold outline-none ${isDark ? 'bg-white/5 border border-white/10 text-white placeholder:text-zinc-600' : 'bg-zinc-100 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400'}`}
              />
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {filteredConvs.length === 0 && (
              <div className="p-8 text-center">
                <MessageCircle size={32} className="mx-auto mb-3 text-zinc-700"/>
                <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma mensagem ainda'}
                </p>
                {!searchTerm && <p className={`text-[9px] mt-2 ${isDark ? 'text-zinc-700' : 'text-zinc-400'}`}>As mensagens dos clientes aparecerão aqui quando responderem no WhatsApp.</p>}
              </div>
            )}
            {filteredConvs.map(conv => (
              <div
                key={conv.id}
                className={`relative border-b group/conv ${isDark ? 'border-white/5' : 'border-zinc-100'} ${selectedConv?.id === conv.id ? (isDark ? 'bg-[#C58A4A]/10 border-l-2 border-l-[#C58A4A]' : 'bg-amber-50 border-l-2 border-l-[#C58A4A]') : ''}`}
              >
                <button
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full text-left px-4 py-4 transition-all flex items-center gap-3 ${isDark ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black shrink-0 relative ${isDark ? 'bg-[#C58A4A]/20 text-[#C58A4A]' : 'bg-amber-100 text-amber-700'}`}>
                    {resolveClientName(conv)?.charAt(0) || '?'}
                    {clients?.find((cl: any) => cl.phone?.replace(/\D/g,'') === conv.clientPhone?.replace(/\D/g,'')) && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-black flex items-center justify-center">
                        <User size={7} className="text-white"/>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{resolveClientName(conv)}</p>
                      <span className={`text-[9px] shrink-0 ml-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{formatTime(conv.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-[11px] truncate ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{conv.lastMessage}</p>
                      {conv.unread && <span className="w-2.5 h-2.5 rounded-full bg-[#C58A4A] shrink-0 ml-2"/>}
                    </div>
                  </div>
                </button>
                {/* Botão apagar — aparece no hover */}
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelete(conv.id); }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover/conv:opacity-100 transition-all ${isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-red-50 text-red-400 hover:bg-red-100'}`}
                >
                  <Trash2 size={13}/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <MessageCircle size={48} className="text-zinc-700"/>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                Selecione uma conversa
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className={`px-6 py-4 flex items-center justify-between border-b shrink-0 ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-base ${isDark ? 'bg-[#C58A4A]/20 text-[#C58A4A]' : 'bg-amber-100 text-amber-700'}`}>
                    {selectedConv.clientName?.charAt(0)}
                  </div>
                  <div>
                    <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>{resolveClientName(selectedConv)}</p>
                    <a href={`https://wa.me/${selectedConv.clientPhone}`} target="_blank" rel="noreferrer" className="text-[10px] text-zinc-500 hover:text-[#C58A4A] flex items-center gap-1 transition-all">
                      <Phone size={10}/> {selectedConv.clientPhone}
                    </a>
                  </div>
                </div>
                <button onClick={() => setSelectedConv(null)} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                  <X size={16}/>
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-700' : 'text-zinc-400'}`}>Nenhuma mensagem</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.from === 'admin'
                        ? 'bg-[#C58A4A] text-black rounded-br-md'
                        : isDark ? 'bg-white/10 text-white rounded-bl-md' : 'bg-zinc-100 text-zinc-900 rounded-bl-md'
                    }`}>
                      <p className="text-sm font-medium leading-snug">{msg.text}</p>
                      <p className={`text-[9px] mt-1 text-right ${msg.from === 'admin' ? 'text-black/50' : isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {formatTime(msg.timestamp)}
                        {msg.from === 'admin' && <CheckCheck size={10} className="inline ml-1"/>}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef}/>
              </div>

              {/* Reply input */}
              <div className={`p-4 border-t shrink-0 ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
                <div className="flex gap-3 items-end">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Digite sua resposta... (Enter para enviar)"
                    className={`flex-1 resize-none rounded-2xl p-3 text-sm font-medium outline-none border transition-all ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#C58A4A]/50' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-[#C58A4A]'}`}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!replyText.trim() || sending}
                    className="w-12 h-12 rounded-2xl gradiente-ouro text-black flex items-center justify-center shadow-lg disabled:opacity-40 hover:scale-105 active:scale-95 transition-all shrink-0"
                  >
                    {sending ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : <Send size={18}/>}
                  </button>
                </div>
                <p className={`text-[9px] mt-2 ${isDark ? 'text-zinc-700' : 'text-zinc-400'}`}>
                  ⚠️ Você só pode responder dentro de 24h após a última mensagem do cliente.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

      {/* Modal confirmar apagar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className={`w-full max-w-xs rounded-[2rem] p-7 space-y-5 ${isDark ? 'cartao-vidro border-white/10' : 'bg-white border border-zinc-200'}`} onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                <Trash2 size={24} className="text-red-400"/>
              </div>
              <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-zinc-900'}`}>Apagar conversa?</h3>
              <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Todas as mensagens serão apagadas permanentemente.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${isDark ? 'bg-white/5 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>Cancelar</button>
              <button onClick={() => deleteConversation(confirmDelete)} className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase bg-red-500 text-white">Apagar</button>
            </div>
          </div>
        </div>
      )}
