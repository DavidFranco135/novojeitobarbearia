import React, { useState, useMemo, useEffect } from 'react';
import { 
  Scissors, Calendar, Check, MapPin, ChevronLeft, ChevronRight, ArrowRight, Clock, User, Phone, 
  History, Sparkles, Instagram, Star, Heart, LogOut, MessageSquare, Quote, Mail, Upload, Save, Lock, Send, X, Crown, CheckCircle2, Gift, Trophy, Medal, Share2, Users, Copy, QrCode
} from 'lucide-react';
// Crown já importado acima — usado para badge Barbeiro Master
import { useBarberStore } from '../store';
import { Service, Review, Professional, Client } from '../types';
import ClubeBeneficios from '../components/ClubeBeneficios'; // ── NOVO

interface PublicBookingProps {
  initialView?: 'HOME' | 'BOOKING' | 'LOGIN' | 'CLIENT_DASHBOARD';
}

const PublicBooking: React.FC<PublicBookingProps> = ({ initialView = 'HOME' }) => {
  const { services, professionals, appointments, addAppointment, addClient, updateClient, config, theme, likeProfessional, addShopReview, addSuggestion, updateSuggestion, clients, user, logout, suggestions, isSlotBlocked, addSubscription, referrals, createReferral, validateReferral, cancelReferral, loyaltyCards } = useBarberStore() as any;
  const { partners } = useBarberStore() as any;
  const { products } = useBarberStore() as any;
  
  const [view, setView] = useState<'HOME' | 'BOOKING' | 'LOGIN' | 'CLIENT_DASHBOARD'>(initialView);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralName, setReferralName] = useState('');
  const [referralPhone, setReferralPhone] = useState('');
  const [referralEmail, setReferralEmail] = useState('');
  const [referralCpf, setReferralCpf] = useState('');
  const [referralBirthdate, setReferralBirthdate] = useState('');
  const [referralSaving, setReferralSaving] = useState(false);
  const [referralDone, setReferralDone] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  // ── Indicação via URL ?ref=ID ──
  const [urlReferrerId, setUrlReferrerId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref');
  });
  const [urlReferrerName, setUrlReferrerName] = useState<string>('');
  const [passo, setPasso] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', userName: '', clientPhone: '' });
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [selecao, setSelecao] = useState({ serviceId: '', professionalId: '', date: '', time: '', clientName: '', clientPhone: '', clientEmail: '' });
  
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loggedClient, setLoggedClient] = useState<Client | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Estados para verificação de cadastro no agendamento (passo 4)
  const [lookupInput, setLookupInput] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupClientFound, setLookupClientFound] = useState<Client | null>(null);
  const [lookupPassword, setLookupPassword] = useState('');
  const [lookupPasswordError, setLookupPasswordError] = useState<string | null>(null);
  const [clientVerified, setClientVerified] = useState(false);

  // Estados para cadastro no Portal do Cliente
  const [loginMode, setLoginMode] = useState<'login' | 'register' | 'setpassword' | 'forgot'>('login');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'phone' | 'reset'>('phone');
  const [bookingPayLink, setBookingPayLink] = useState<string | null>(null);
  const [wantsPayNow, setWantsPayNow] = useState(false);
  const [vipModal, setVipModal] = useState<any>(null);
  // ── Galeria de fotos de cortes ──────────────────────────────
  const [galleryLightbox, setGalleryLightbox] = useState<{url:string;desc:string}|null>(null);
  const [showGalleryUpload, setShowGalleryUpload] = useState(false);
  const [galleryUploadDesc, setGalleryUploadDesc] = useState('');
  const [galleryUploading, setGalleryUploading] = useState(false);
  const IMGBB_KEY_GALLERY = 'da736db48f154b9108b23a36d4393848';

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryUploading(true);
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = async () => {
        const MAX = 1200;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio; canvas.height = img.height * ratio;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85));
        const formData = new FormData();
        formData.append('image', blob, 'photo.jpg');
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY_GALLERY}`, { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) throw new Error('Falha no upload');
        const imgUrl = json.data.url;
        const currentPhotos: {url:string;desc:string}[] = (config as any).cutGallery || [];
        await updateConfig({ cutGallery: [...currentPhotos, { url: imgUrl, desc: galleryUploadDesc.trim() }] } as any);
        setGalleryUploadDesc('');
        setShowGalleryUpload(false);
        setGalleryUploading(false);
      };
      img.onerror = () => { setGalleryUploading(false); alert('Erro ao processar imagem.'); };
      img.src = url;
    } catch(err) {
      alert('Erro ao enviar foto.');
      setGalleryUploading(false);
    }
    e.target.value = '';
  };

  const handleGalleryDelete = async (idx: number) => {
    if (!window.confirm('Excluir esta foto da galeria?')) return;
    const currentPhotos: {url:string;desc:string}[] = (config as any).cutGallery || [];
    await updateConfig({ cutGallery: currentPhotos.filter((_,i) => i !== idx) } as any);
    setGalleryLightbox(null);
  };
  const [vipForm, setVipForm] = useState({ name: '', phone: '', cpf: '' });
  const [vipLoading, setVipLoading] = useState(false);
  const [vipPayLink, setVipPayLink] = useState<string | null>(null);
  const [vipError, setVipError] = useState<string | null>(null);
  const [forgotClient, setForgotClient] = useState<any>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [registerData, setRegisterData] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [registerError, setRegisterError] = useState<string | null>(null);
  // Cliente pré-cadastrado pelo admin (sem senha) — precisa apenas definir senha
  const [noPasswordClient, setNoPasswordClient] = useState<any>(null);
  const [setPasswordData, setSetPasswordData] = useState({ password: '', confirmPassword: '' });

  // States para o portal do membro
  const [suggestionText, setSuggestionText] = useState('');
  const [likedSuggs, setLikedSuggs] = React.useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('nj_liked_suggs');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  const [editData, setEditData] = useState({ name: '', phone: '', email: '' });

  // State para modal de história do barbeiro
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [showProfessionalModal, setShowProfessionalModal] = useState(false);
  const [showBeneficios, setShowBeneficios] = useState(false); // ── NOVO
  const [activeReviewTab, setActiveReviewTab] = useState<'reviews'|'comments'>('reviews');

  // ✅ CORREÇÃO: Estado para modal de criação rápida de cliente
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClient, setQuickClient] = useState({ name: '', phone: '', email: '' });
  const [quickClientError, setQuickClientError] = useState<string | null>(null);

  // LOGICA PARA DESTAQUES: Mais agendados primeiro, depois o restante
  const sortedServicesForHighlights = useMemo(() => {
    const counts = appointments.reduce((acc: Record<string, number>, curr) => {
      acc[curr.serviceId] = (acc[curr.serviceId] || 0) + 1;
      return acc;
    }, {});

    const withAppts = services.filter(s => (counts[s.id] || 0) > 0);
    const withoutAppts = services.filter(s => (counts[s.id] || 0) === 0);

    withAppts.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));

    return [...withAppts, ...withoutAppts];
  }, [services, appointments]);

  // ── Detecta ?ref=ID na URL → abre cadastro com banner de indicação ──
  useEffect(() => {
    if (!urlReferrerId || !clients || clients.length === 0) return;
    const referrer = clients.find((cl: any) => cl.id === urlReferrerId);
    if (referrer) setUrlReferrerName(referrer.name);
    if (!loggedClient) {
      setView('LOGIN');
      setLoginMode('register');
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, [urlReferrerId, clients]);

  // Sincroniza o usuário logado do store com o loggedClient deste componente
  useEffect(() => {
    if (user && user.role === 'CLIENTE') {
      const client = clients.find(c => c.id === user.id);
      if (client) {
        setLoggedClient(client);
        setEditData({ name: client.name, phone: client.phone, email: client.email });
        setNewReview(prev => ({ ...prev, userName: client.name, clientPhone: client.phone }));
        if (initialView === 'CLIENT_DASHBOARD') setView('CLIENT_DASHBOARD');
      }
    }
  }, [user, clients, initialView]);

  // Estados para drag scroll
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const destaqueRef = React.useRef<HTMLDivElement>(null);
  const experienciaRef = React.useRef<HTMLDivElement>(null);
  const membroRef = React.useRef<HTMLDivElement>(null);
  const produtosRef = React.useRef<HTMLDivElement>(null);
  const comentRef    = React.useRef<HTMLDivElement>(null);
  const [selectedProduct, setSelectedProduct] = React.useState<any | null>(null);

  // ── Accordion das seções da home ────────────────────────────
  const [openSections, setOpenSections] = React.useState<Set<string>>(() => new Set());
  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const AccordionHeader: React.FC<{ sectionKey: string; label: string; icon?: React.ReactNode }> = ({ sectionKey, label, icon }) => {
    const isOpen = openSections.has(sectionKey);
    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        className={`w-full flex items-center justify-between px-6 py-5 rounded-[2rem] border transition-all duration-300 ${
          isOpen
            ? theme === 'light' ? 'bg-white border-[#C58A4A]/40 shadow-sm' : 'bg-white/5 border-[#C58A4A]/30'
            : theme === 'light' ? 'bg-white border-zinc-200 hover:border-[#C58A4A]/30' : 'bg-white/[0.03] border-white/8 hover:border-[#C58A4A]/20'
        }`}
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-[#C58A4A]">{icon}</span>}
          <span className={`text-base font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{label}</span>
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${isOpen ? 'gradiente-ouro' : theme === 'light' ? 'bg-zinc-100' : 'bg-white/10'}`}>
          <ChevronRight size={18} className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-black' : theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`} />
        </div>
      </button>
    );
  };

  const handleMouseDown = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!isDragging || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2;
    ref.current.scrollLeft = scrollLeft - walk;
  };

  const handleBookingStart = (svc: Service) => {
    setSelecao(prev => ({ ...prev, serviceId: svc.id }));
    setView('BOOKING'); setPasso(2);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const checkAvailability = (date: string, time: string, profId: string) => {
    // Horário já agendado
    const hasAppointment = appointments.some(a => a.date === date && a.startTime === time && a.professionalId === profId && a.status !== 'CANCELADO');
    // Horário bloqueado pelo admin (almoço, reunião, folga parcial etc.)
    const isBlocked = isSlotBlocked ? isSlotBlocked(profId, date, time) : false;
    return hasAppointment || isBlocked;
  };

  const turnos = useMemo(() => {
    const times = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    return {
      manha: times.filter(t => parseInt(t.split(':')[0]) < 12),
      tarde: times.filter(t => parseInt(t.split(':')[0]) >= 12 && parseInt(t.split(':')[0]) < 18),
      noite: times.filter(t => parseInt(t.split(':')[0]) >= 18)
    };
  }, []);

  const categories = useMemo(() => ['Todos', ...Array.from(new Set(services.map(s => s.category)))], [services]);
  const filteredServices = useMemo(() => selectedCategory === 'Todos' ? services : services.filter(s => s.category === selectedCategory), [services, selectedCategory]);

  // ✅ CORREÇÃO: Função para criar cliente rápido na aba de agendamento
  const handleQuickClientCreate = async () => {
    if (!quickClient.name || !quickClient.phone || !quickClient.email) {
      setQuickClientError("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const existingClient = clients.find(c => c.email && c.email.toLowerCase() === quickClient.email.toLowerCase());
      if (existingClient) {
        setQuickClientError("Este email já está cadastrado no sistema.");
        setLoading(false);
        return;
      }

      await addClient({ name: quickClient.name, phone: quickClient.phone, email: quickClient.email });
      setSelecao(prev => ({ ...prev, clientName: quickClient.name, clientPhone: quickClient.phone, clientEmail: quickClient.email }));
      setClientVerified(true);
      setShowQuickClient(false);
      setQuickClient({ name: '', phone: '', email: '' });
      setQuickClientError(null);
      if (passo === 1 || passo < 2) setPasso(2);
    } catch (err: any) {
      setQuickClientError(err.message || "Erro ao criar cliente.");
    } finally {
      setLoading(false);
    }
  };

  const handleLookupClient = () => {
    if (!lookupInput.trim()) {
      setLookupError("Informe seu celular ou e-mail.");
      return;
    }
    const normalizePhone = (p: string) => p.replace(/\D/g, '');
    const found = clients.find(c => {
      const emailMatch = c.email && c.email.toLowerCase() === lookupInput.toLowerCase().trim();
      const phoneMatch = normalizePhone(c.phone) === normalizePhone(lookupInput);
      return emailMatch || phoneMatch;
    });
    if (found) {
      setLookupClientFound(found);
      setLookupError(null);
      setLookupPassword('');
      setLookupPasswordError(null);
    } else {
      setLookupError("Nenhum cadastro encontrado com esses dados.");
    }
  };

  const handleVerifyPassword = () => {
    if (!lookupClientFound) return;

    // Cliente sem senha (cadastrado pelo admin) → aceita qualquer entrada e define a senha
    if (!lookupClientFound.password) {
      if (!lookupPassword || lookupPassword.length < 4) {
        setLookupPasswordError("Sua conta ainda não tem senha. Digite uma senha com pelo menos 4 caracteres para criar agora.");
        return;
      }
      // Salva a senha e libera o agendamento
      updateClient(lookupClientFound.id, { password: lookupPassword });
      setLookupClientFound({ ...lookupClientFound, password: lookupPassword });
      setSelecao(prev => ({ ...prev, clientName: lookupClientFound.name, clientPhone: lookupClientFound.phone, clientEmail: lookupClientFound.email || '' }));
      setClientVerified(true);
      setLookupPasswordError(null);
      return;
    }

    if (!lookupPassword) {
      setLookupPasswordError("Digite sua senha.");
      return;
    }
    if (lookupClientFound.password !== lookupPassword) {
      setLookupPasswordError("Senha incorreta. Tente novamente.");
      return;
    }
    setSelecao(prev => ({ ...prev, clientName: lookupClientFound.name, clientPhone: lookupClientFound.phone, clientEmail: lookupClientFound.email || '' }));
    setClientVerified(true);
    setLookupPasswordError(null);
  };

  const handleRegisterPortal = async () => {
    if (!registerData.name || !registerData.phone || !registerData.email || !registerData.password) {
      setRegisterError("Preencha todos os campos obrigatórios."); return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setRegisterError("As senhas não conferem."); return;
    }
    const exists = clients.find((c: any) => {
      const emailMatch = c.email && c.email.toLowerCase() === registerData.email.toLowerCase();
      const phoneMatch = c.phone.replace(/\D/g,'') === registerData.phone.replace(/\D/g,'');
      return emailMatch || phoneMatch;
    });
    // Cliente pré-cadastrado pelo admin sem senha — redireciona para definir senha
    if (exists && !exists.password) {
      setNoPasswordClient(exists);
      setSetPasswordData({ password: '', confirmPassword: '' });
      setLoginMode('setpassword');
      setRegisterError(null);
      return;
    }
    if (exists) {
      setRegisterError("Já existe um cadastro com este e-mail ou celular. Tente fazer login."); return;
    }
    setLoading(true);
    try {
      const client = await addClient({ name: registerData.name, phone: registerData.phone, email: registerData.email, password: registerData.password });
      setLoggedClient(client);
      setEditData({ name: client.name, phone: client.phone, email: client.email });
      setNewReview(prev => ({ ...prev, userName: client.name, clientPhone: client.phone }));
      setRegisterData({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
      setRegisterError(null);

      // ── Se veio de link de indicação (?ref=ID), cria a indicação ──
      if (urlReferrerId && urlReferrerId !== client.id) {
        try {
          const referrer = clients.find((cl: any) => cl.id === urlReferrerId);
          if (referrer) {
            const rewardAmount = (config as any).referralRewardAmount ?? 5;
            await createReferral({
              referrerId: urlReferrerId,
              referrerName: referrer.name,
              referredName: client.name,
              referredPhone: client.phone,
              referredEmail: client.email || '',
              referredClientId: client.id,
              status: 'PENDENTE',
              rewardAmount,
              rewardCredited: false,
            });
          }
        } catch (_) {}
        setUrlReferrerId(null);
        setUrlReferrerName('');
      }

      // Se veio de um agendamento em progresso, volta para o agendamento já verificado
      if (selecao.serviceId && selecao.date && selecao.time && selecao.professionalId) {
        setSelecao(prev => ({ ...prev, clientName: client.name, clientPhone: client.phone, clientEmail: client.email || '' }));
        setClientVerified(true);
        setLookupInput(client.email || client.phone);
        setLookupError(null);
        setView('BOOKING');
      } else {
        setView('CLIENT_DASHBOARD');
      }
    } catch (err: any) {
      setRegisterError(err.message || "Erro ao criar conta.");
    } finally { setLoading(false); }
  };

  const handleConfirmBooking = async () => {
    if (!clientVerified || !selecao.clientName || !selecao.clientPhone) {
      alert("Por favor, verifique seu cadastro antes de confirmar.");
      return;
    }
    if (checkAvailability(selecao.date, selecao.time, selecao.professionalId)) {
      setBookingError("Este horário acabou de ser ocupado. Por favor, escolha outro.");
      return;
    }

    setLoading(true);
    try {
      const normalizePhone = (p: string) => p.replace(/\D/g, '');
      const client = clients.find(c => {
        const emailMatch = selecao.clientEmail && c.email && c.email.toLowerCase() === selecao.clientEmail.toLowerCase();
        const phoneMatch = normalizePhone(c.phone) === normalizePhone(selecao.clientPhone);
        return emailMatch || phoneMatch;
      });
      if (!client) { alert("Cliente não encontrado. Verifique seu cadastro."); setLoading(false); return; }
      const serv = services.find(s => s.id === selecao.serviceId);
      const prof = professionals.find(p => p.id === selecao.professionalId);
      const surcharge = (prof?.isMaster && prof?.masterSurcharge) ? prof.masterSurcharge : 0;
      const finalPrice = (serv?.price || 0) + surcharge;
      const [h, m] = selecao.time.split(':').map(Number);
      const endTime = `${Math.floor((h * 60 + m + (serv?.durationMinutes || 30)) / 60).toString().padStart(2, '0')}:${((h * 60 + m + (serv?.durationMinutes || 30)) % 60).toString().padStart(2, '0')}`;
      await addAppointment({ clientId: client.id, clientName: client.name, clientPhone: client.phone, serviceId: selecao.serviceId, serviceName: serv?.name || '', professionalId: selecao.professionalId, professionalName: prof?.name || '', date: selecao.date, startTime: selecao.time, endTime, price: finalPrice, ...(wantsPayNow ? { awaitingOnlinePayment: true } : {}) }, true);
      setSuccess(true);
      // Gera link de pagamento Asaas apenas se cliente escolheu pagar online
      if (wantsPayNow) {
        try {
          const asaasKey = (config as any).asaasKey || '';
          const asaasEnv = (config as any).asaasEnv || 'sandbox';
          if (asaasKey) {
            const proxy = (endpoint: string, method = 'GET', body?: any) =>
              fetch('https://us-central1-financeiro-a7116.cloudfunctions.net/asaasProxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint, method, key: asaasKey, env: asaasEnv, body })
              }).then(r => r.json());

            // 1. Cria ou busca cliente no Asaas
            const phone = client.phone.replace(/\D/g, '');
            const extRef = `nj_${client.id}`;
            const cpfCnpj = (client as any).cpfCnpj?.replace(/\D/g, '')
              || (asaasEnv === 'sandbox' ? '00000000191' : undefined);

            let customerId: string | undefined;
            const byRef = await proxy(`/customers?externalReference=${extRef}`);
            customerId = byRef?.data?.[0]?.id;
            if (!customerId && phone) {
              const byPhone = await proxy(`/customers?mobilePhone=${phone}`);
              customerId = byPhone?.data?.[0]?.id;
            }
            if (!customerId) {
              const newCust = await proxy('/customers', 'POST', {
                name: client.name || 'Cliente',
                mobilePhone: phone || undefined,
                cpfCnpj,
                externalReference: extRef,
                notificationDisabled: true,
              });
              customerId = newCust?.id;
            } else if (cpfCnpj) {
              await proxy(`/customers/${customerId}`, 'PUT', { cpfCnpj, notificationDisabled: true });
            }

            if (customerId) {
              // 2. Cria cobrança UNDEFINED (cliente escolhe PIX/cartão/boleto no link)
              const charge = await proxy('/payments', 'POST', {
                customer: customerId,
                billingType: 'UNDEFINED',
                value: finalPrice,
                dueDate: selecao.date,
                description: `${serv?.name || 'Serviço'} — ${prof?.name || 'Barbeiro'}`,
                externalReference: `booking_${client.id}_${selecao.date}`,
              });
              if (charge?.invoiceUrl) setBookingPayLink(charge.invoiceUrl);
            }
          }
        } catch(e) { console.warn('Asaas booking payment failed:', e); }
      }
    } catch (err) { alert("Erro ao agendar."); }
    finally { setLoading(false); }
  };


  // ── ESQUECI SENHA — Portal do Cliente ──────────────────────
  const handleForgotLookup = () => {
    setForgotError(null);
    const found = clients.find((cl: any) => cl.phone === forgotPhone.replace(/\D/g, '') || cl.phone === forgotPhone);
    if (!found) { setForgotError('Número não encontrado. Verifique e tente novamente.'); return; }
    setForgotClient(found);
    setForgotStep('reset');
  };
  const handleForgotReset = async () => {
    setForgotError(null);
    if (!forgotNewPassword || forgotNewPassword.length < 4) { setForgotError('A senha deve ter pelo menos 4 caracteres.'); return; }
    if (forgotNewPassword !== forgotConfirmPassword) { setForgotError('As senhas não conferem.'); return; }
    await updateClient(forgotClient.id, { password: forgotNewPassword });
    setForgotSuccess(true);
    setTimeout(() => {
      setForgotSuccess(false); setForgotStep('phone'); setForgotPhone('');
      setForgotNewPassword(''); setForgotConfirmPassword(''); setForgotClient(null);
      setLoginMode('login');
    }, 2000);
  };

  // Definir senha para cliente pré-cadastrado pelo admin (sem senha)
  const handleSetPassword = async () => {
    if (!setPasswordData.password || !setPasswordData.confirmPassword) {
      setRegisterError("Preencha os dois campos de senha."); return;
    }
    if (setPasswordData.password.length < 4) {
      setRegisterError("A senha deve ter pelo menos 4 caracteres."); return;
    }
    if (setPasswordData.password !== setPasswordData.confirmPassword) {
      setRegisterError("As senhas não conferem."); return;
    }
    setLoading(true);
    try {
      await updateClient(noPasswordClient.id, { password: setPasswordData.password });
      // Loga automaticamente o cliente
      const updatedClient = { ...noPasswordClient, password: setPasswordData.password };
      setLoggedClient(updatedClient);
      setEditData({ name: updatedClient.name, phone: updatedClient.phone, email: updatedClient.email });
      setNewReview((prev: any) => ({ ...prev, userName: updatedClient.name, clientPhone: updatedClient.phone }));
      setNoPasswordClient(null);
      setSetPasswordData({ password: '', confirmPassword: '' });
      setRegisterError(null);
      if (selecao.serviceId && selecao.date && selecao.time && selecao.professionalId) {
        setSelecao((prev: any) => ({ ...prev, clientName: updatedClient.name, clientPhone: updatedClient.phone, clientEmail: updatedClient.email || '' }));
        setClientVerified(true);
        setView('BOOKING');
      } else {
        setView('CLIENT_DASHBOARD');
      }
    } catch (err: any) {
      setRegisterError(err.message || "Erro ao definir senha.");
    } finally { setLoading(false); }
  };

  const handleLoginPortal = () => {
    if (!loginIdentifier || !loginPassword) {
      alert("Preencha e-mail/celular e senha.");
      return;
    }

    const normalizePhone = (p: string) => p.replace(/\D/g, '');

    // 1º — Busca o cliente APENAS pelo identificador (sem checar senha aqui)
    const client = clients.find(c => {
      const emailMatch = c.email && c.email.toLowerCase() === loginIdentifier.toLowerCase().trim();
      const phoneMatch = normalizePhone(c.phone) === normalizePhone(loginIdentifier);
      return emailMatch || phoneMatch;
    });

    // 2º — Cliente não existe na base
    if (!client) {
      alert("Cliente não encontrado. Verifique seu e-mail ou celular cadastrado.");
      return;
    }

    // 3º — Cliente existe mas não tem senha definida (cadastrado pelo admin sem senha)
    // → Redireciona automaticamente para a tela de definir senha
    if (!client.password) {
      setNoPasswordClient(client);
      setSetPasswordData({ password: '', confirmPassword: '' });
      setRegisterError(null);
      setLoginMode('setpassword');
      return;
    }

    // 4º — Senha incorreta
    if (client.password !== loginPassword) {
      alert("Senha incorreta. Tente novamente.");
      return;
    }

    // 5º — Tudo certo: acesso liberado
    setLoggedClient(client);
    setEditData({ name: client.name, phone: client.phone, email: client.email });
    setNewReview(prev => ({ ...prev, userName: client.name, clientPhone: client.phone }));
    setLoginPassword('');
    setView('CLIENT_DASHBOARD');
  };

  const handleLikeProfessional = async (profId: string) => {
    if (!loggedClient) {
      alert("Faça login para curtir um barbeiro.");
      return;
    }
    const alreadyLiked = loggedClient.likedProfessionals?.includes(profId);
    if (alreadyLiked) {
      alert("Você já curtiu este barbeiro!");
      return;
    }
    await likeProfessional(profId);
    const updatedLikedProfessionals = [...(loggedClient.likedProfessionals || []), profId];
    await updateClient(loggedClient.id, { likedProfessionals: updatedLikedProfessionals });
    setLoggedClient({ ...loggedClient, likedProfessionals: updatedLikedProfessionals });
    alert("Curtida registrada com sucesso!");
  };

  const handleUpdateProfilePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && loggedClient) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await updateClient(loggedClient.id, { avatar: base64 });
        setLoggedClient({ ...loggedClient, avatar: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendSuggestion = async () => {
    if (!suggestionText.trim() || !loggedClient) return;
    setLoading(true);
    try {
      await addSuggestion({
        clientName: loggedClient.name,
        clientPhone: loggedClient.phone,
        text: suggestionText,
        date: new Date().toISOString()
      });
      setSuggestionText('');
      alert("Sugestão enviada com sucesso!");
    } catch (err) {
      alert("Erro ao enviar sugestão.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddReview = () => {
    if (!newReview.comment) return alert("Escreva um comentário!");
    if (config.reviews?.some(r => r.clientPhone === loggedClient?.phone)) {
        return alert("Você já deixou sua avaliação exclusiva!");
    }
    addShopReview(newReview);
    setShowReviewModal(false);
    setNewReview({ rating: 5, comment: '', userName: loggedClient?.name || '', clientPhone: loggedClient?.phone || '' });
    alert("Obrigado pela sua avaliação!");
  };

  const handleLogout = () => {
    setLoggedClient(null);
    logout();
    setView('HOME');
  };


  const handleVipSubscribe = async () => {
    if (!vipModal) return;
    const name  = loggedClient?.name  || vipForm.name.trim();
    const phone = loggedClient?.phone || vipForm.phone.trim();
    const cpf   = (loggedClient as any)?.cpfCnpj || vipForm.cpf.trim();
    if (!name || !phone) { setVipError('Preencha nome e telefone.'); return; }
    const asaasKey = (config as any).asaasKey || '';
    const asaasEnv = (config as any).asaasEnv || 'sandbox';
    if (!asaasKey) {
      const w = `Ola! Quero assinar o plano ${vipModal.name} (R$ ${vipModal.price.toFixed(2)}).`;
      window.open(`https://wa.me/55${(config as any).whatsapp?.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(w)}`, '_blank');
      return;
    }
    setVipLoading(true); setVipError(null);
    try {
      const proxy = (endpoint: string, method = 'GET', body?: any) =>
        fetch('https://us-central1-financeiro-a7116.cloudfunctions.net/asaasProxy', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, method, key: asaasKey, env: asaasEnv, body })
        }).then(r => r.json());
      const phoneClean = phone.replace(/[^0-9]/g, '');
      const cpfClean = cpf.replace(/[^0-9]/g, '') || (asaasEnv === 'sandbox' ? '00000000191' : undefined);
      let customerId: string | undefined;
      if (phoneClean) { const r = await proxy('/customers?mobilePhone=' + phoneClean); customerId = r?.data?.[0]?.id; }
      if (!customerId) { const r = await proxy('/customers', 'POST', { name, mobilePhone: phoneClean||undefined, cpfCnpj: cpfClean, notificationDisabled: true }); customerId = r?.id; }
      else if (cpfClean) { await proxy('/customers/' + customerId, 'PUT', { cpfCnpj: cpfClean }); }
      if (!customerId) throw new Error('Erro ao criar cliente no Asaas.');
      const periodMap: {[key: string]: string} = { ANUAL: 'YEARLY', SEMANAL: 'WEEKLY', MENSAL: 'MONTHLY' };
      const cycle = periodMap[vipModal.period] || 'MONTHLY';
      const sub = await proxy('/subscriptions', 'POST', {
        customer: customerId, billingType: 'UNDEFINED', value: vipModal.price,
        nextDueDate: new Date().toISOString().split('T')[0], cycle,
        description: vipModal.name + ' — Barbearia Novo Jeito',
      });
      if (!sub?.id) throw new Error((sub?.errors?.[0]?.description) || 'Erro ao criar assinatura.');
      const charges = await proxy('/payments?subscription=' + sub.id);
      const invoiceUrl = charges?.data?.[0]?.invoiceUrl || sub.invoiceUrl || '';

      // ── Salva assinatura no Firestore para aparecer no painel ──
      try {
        const planEndDate = new Date();
        if (vipModal.period === 'ANUAL') planEndDate.setFullYear(planEndDate.getFullYear() + 1);
        else if (vipModal.period === 'SEMANAL') planEndDate.setDate(planEndDate.getDate() + 7);
        else planEndDate.setMonth(planEndDate.getMonth() + 1);
        const clientFound = clients.find((c: any) => c.phone?.replace(/\D/g,'') === phoneClean);
        await addSubscription({
          clientId:            clientFound?.id || phoneClean,
          clientName:          name,
          clientPhone:         phone,
          planId:              vipModal.id,
          planName:            vipModal.name,
          price:               vipModal.price,
          status:              'PENDENTE_PAGAMENTO',
          startDate:           new Date().toISOString(),
          endDate:             planEndDate.toISOString(),
          asaasSubscriptionId: sub.id,
          asaasInvoiceUrl:     invoiceUrl,
        });
      } catch(e) { console.warn('Firestore subscription save failed:', e); }

      setVipPayLink(invoiceUrl);
      if (invoiceUrl) window.open(invoiceUrl, '_blank');
    } catch(err: any) {
      setVipError(err.message || 'Erro ao processar.');
    } finally { setVipLoading(false); }
  };


  // ── Ranking de clientes ──────────────────────────────────
  const clientRanking = useMemo(() => {
    return clients
      .filter((cl: any) => cl.phone)
      .map((cl: any) => {
        const card = loyaltyCards?.find((lc: any) => lc.clientId === cl.id);
        const totalCuts = appointments.filter((a: any) =>
          (a.clientId === cl.id || a.clientPhone === cl.phone) && a.status === 'CONCLUIDO_PAGO'
        ).length;
        const totalReferrals = referrals?.filter((r: any) => r.referrerId === cl.id && r.status === 'VALIDADO').length || 0;
        return { ...cl, totalCuts, totalReferrals, credits: card?.credits || 0, card };
      })
      .sort((a: any, b: any) => (b.totalCuts + b.totalReferrals * 2) - (a.totalCuts + a.totalReferrals * 2))
      .slice(0, 20);
  }, [clients, appointments, referrals, loyaltyCards]);

  // ── Link de indicação do cliente logado ──────────────────
  const referralLink = useMemo(() => {
    if (!loggedClient) return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?ref=${loggedClient.id}`;
  }, [loggedClient]);

  // ── QR Code simples via API pública ─────────────────────
  const referralQrUrl = useMemo(() => {
    if (!referralLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralLink)}`;
  }, [referralLink]);

  const handleCreateReferral = async () => {
    if (!loggedClient || !referralName.trim()) return;
    if (!referralPhone.trim() && !referralEmail.trim()) {
      alert('Informe ao menos o WhatsApp ou e-mail do amigo.');
      return;
    }
    setReferralSaving(true);
    try {
      const rewardAmount = (config as any).referralRewardAmount ?? 5;
      await createReferral({
        referrerId: loggedClient.id,
        referrerName: loggedClient.name,
        referredName: referralName.trim(),
        referredPhone: referralPhone.trim(),
        referredEmail: referralEmail.trim(),
        referredCpf: referralCpf.trim(),
        referredBirthdate: referralBirthdate.trim(),
        status: 'PENDENTE',
        rewardAmount,
        rewardCredited: false,
      });
      setReferralDone(true);
      setReferralName(''); setReferralPhone('');
      setReferralEmail(''); setReferralCpf(''); setReferralBirthdate('');
      setTimeout(() => { setReferralDone(false); setShowReferralModal(false); }, 3000);
    } catch (e) { alert('Erro ao registrar indicação.'); }
    finally { setReferralSaving(false); }
  };

  // ✅ CORREÇÃO: Return de success DEPOIS de todos os hooks
  if (success) return (
    <div className={`min-h-screen flex items-center justify-center p-6 animate-in zoom-in ${theme === 'dark' ? 'bg-[#050505]' : 'bg-[#F8F9FA]'}`}>
      <div className={`w-full max-w-lg p-12 rounded-[3rem] text-center space-y-8 ${theme === 'dark' ? 'cartao-vidro border-[#C58A4A]/30' : 'bg-white border border-zinc-200'}`}>
        <div className="w-20 h-20 gradiente-ouro rounded-full mx-auto flex items-center justify-center"><Check className="w-10 h-10 text-black" /></div>
        <h2 className="text-3xl font-black font-display italic text-[#C58A4A]">Reserva Confirmada!</h2>
        <p className={`text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>Aguardamos você para sua melhor experiência da sua vida.</p>
        {bookingPayLink && (
          <a href={bookingPayLink} target="_blank" rel="noreferrer"
            className="block w-full gradiente-ouro text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl text-center">
            ⚡ Pagar Agora
          </a>
        )}
        <button onClick={() => { setSuccess(false); setBookingPayLink(null); window.location.reload(); }}
          className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'bg-white/5 text-zinc-400' : 'bg-zinc-100 text-zinc-700'}`}>
          Voltar ao Início
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen flex flex-col theme-transition ${theme === 'light' ? 'bg-[#F3F4F6] text-black' : 'bg-[#050505] text-white'}`}>
      {view === 'HOME' && (
        <div className="animate-in fade-in flex flex-col min-h-screen">
          <header className="relative h-[65vh] overflow-hidden flex flex-col items-center justify-center">
            <img src={config.coverImage} className="absolute inset-0 w-full h-full object-cover brightness-50" alt="Capa" />
            <div className={`absolute inset-0 bg-gradient-to-t ${theme === 'light' ? 'from-[#F8F9FA] via-transparent to-transparent' : 'from-[#050505] via-transparent to-transparent'}`}></div>
            <div className="absolute top-6 right-6 z-[100]"><button onClick={() => setView('LOGIN')} className="bg-[#C58A4A] text-black px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl transition-all hover:scale-105 active:scale-95"><History size={16}/> PORTAL DO CLIENTE</button></div>
            <div className="relative z-20 text-center px-6 mt-10">
               <div className="w-32 h-32 rounded-3xl gradiente-ouro p-1 mx-auto mb-6"><div className="w-full h-full rounded-[2.2rem] bg-black overflow-hidden"><img src={config.logo} className="w-full h-full object-cover" alt="Logo" /></div></div>
               <h1 className={`text-5xl md:text-7xl font-black font-display italic tracking-tight ${theme === 'light' ? 'text-white drop-shadow-lg' : 'text-white'}`}>{config.name}</h1>
               <p className="text-[#C58A4A] text-[10px] font-black uppercase tracking-[0.4em] mt-3">{config.description}</p>
            </div>
          </header>

          <main className="max-w-6xl mx-auto w-full px-6 flex-1 -mt-10 relative z-30 pb-40">
             {/* 1. Destaques da Casa */}
             <section className="mb-20 pt-10">
                <h2 className={`text-2xl font-black font-display italic mb-8 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Destaques da Casa <div className="h-1 flex-1 gradiente-ouro opacity-10"></div></h2>
                <div className="relative group">
                  <button 
                    onClick={() => destaqueRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                    className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl ${theme === 'light' ? 'bg-white border-2 border-zinc-300 text-zinc-900 hover:bg-zinc-50' : 'bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70'}`}
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    onClick={() => destaqueRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                    className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl ${theme === 'light' ? 'bg-white border-2 border-zinc-300 text-zinc-900 hover:bg-zinc-50' : 'bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70'}`}
                  >
                    <ChevronRight size={24} />
                  </button>
                  
                  <div 
                    ref={destaqueRef}
                    className="flex gap-4 overflow-x-auto pb-6 snap-x cursor-grab active:cursor-grabbing scrollbar-hide"
                    style={{ scrollBehavior: 'smooth' }}
                    onMouseDown={(e) => handleMouseDown(e, destaqueRef)}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={(e) => handleMouseMove(e, destaqueRef)}
                  >
                   {sortedServicesForHighlights.map(svc => (
                     <div key={svc.id} className={`snap-center flex-shrink-0 w-64 md:w-72 rounded-[2.5rem] overflow-hidden group shadow-2xl transition-all ${theme === 'light' ? 'bg-black border border-zinc-800 hover:border-[#C58A4A]/30' : 'bg-black border border-white/5 hover:border-[#C58A4A]/30'}`}>
                        <div className="w-full aspect-[4/3] overflow-hidden bg-black flex items-center justify-center">
                          <img src={svc.image} className="w-full h-full object-contain group-hover:scale-105 transition-all duration-700" alt="" />
                        </div>
                        <div className="p-6">
                           <h3 className={`text-xl font-black font-display italic leading-tight ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{svc.name}</h3>
                           <p className={`text-xl font-black mt-2 ${theme === 'light' ? 'text-blue-600' : 'text-[#C58A4A]'}`}>R$ {svc.price.toFixed(2)}</p>
                           <p className={`text-[9px] font-black uppercase ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>{svc.durationMinutes} min</p>
                           <button onClick={() => handleBookingStart(svc)} className="w-full mt-6 gradiente-ouro text-black py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl">RESERVAR</button>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
             </section>

             {/* ── PLANOS VIP — logo após Destaques ───────────────────── */}
             {config.vipPlans && config.vipPlans.filter(p => p.status === 'ATIVO').length > 0 && (
               <section className="mb-16">
                 <h2 className={`text-2xl font-black font-display italic mb-8 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                   Planos VIP <Crown size={22} className="text-[#C58A4A]" />
                   <div className="h-1 flex-1 gradiente-ouro opacity-10"></div>
                 </h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {config.vipPlans.filter(p => p.status === 'ATIVO').map((plan) => (
                     <div key={plan.id} className={`rounded-[2.5rem] p-8 border relative overflow-hidden transition-all hover:scale-[1.02] ${!!plan.featured ? 'border-[#C58A4A]/40 bg-gradient-to-br from-[#C58A4A]/10 to-transparent' : theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-white/10'}`}>
                       {!!plan.featured && <div className="absolute top-0 inset-x-0 h-1 gradiente-ouro"></div>}
                       <div className="flex items-center gap-3 mb-6">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!!plan.featured ? 'gradiente-ouro' : 'bg-white/5 border border-white/10'}`}>
                           <Crown size={18} className={!!plan.featured ? 'text-black' : 'text-[#C58A4A]'} />
                         </div>
                         <div>
                           <p className={`font-black text-lg ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{plan.name}</p>
                           {plan.discount && plan.discount > 0 ? <span className="text-[9px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">{plan.discount}% OFF</span> : null}
                         </div>
                       </div>
                       <p className={`text-4xl font-black mb-1 ${!!plan.featured ? 'text-[#C58A4A]' : theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                         R$ {plan.price.toFixed(2)}
                         <span className={`text-sm font-bold ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>/{plan.period === 'MENSAL' ? 'mês' : plan.period === 'ANUAL' ? 'ano' : plan.period === 'SEMANAL' ? 'sem' : 'período'}</span>
                       </p>
                       {plan.maxCuts && (
                         <p className="text-[10px] font-black text-[#C58A4A] uppercase tracking-widest mt-1">
                           ✂️ {plan.maxCuts} cortes incluídos
                         </p>
                       )}
                       <div className="mt-6 space-y-3">
                         {plan.benefits.map((benefit, bi) => (
                           <div key={bi} className="flex items-start gap-3">
                             <CheckCircle2 size={16} className="text-[#C58A4A] shrink-0 mt-0.5" />
                             <p className={`text-sm ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>{benefit}</p>
                           </div>
                         ))}
                       </div>
                       <button
                         onClick={() => { setVipModal(plan); setVipForm({ name: loggedClient?.name||'', phone: loggedClient?.phone||'', cpf: (loggedClient as any)?.cpfCnpj||'' }); setVipPayLink(null); setVipError(null); }}
                         className={`w-full mt-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all hover:scale-105 ${!!plan.featured ? 'gradiente-ouro text-black shadow-lg' : theme === 'light' ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}
                       >
                         Quero esse plano
                       </button>
                     </div>
                   ))}
                 </div>
               </section>
             )}

             {/* ── GALERIA DE FOTOS DE CORTES ──────────────────────────── */}
             {(() => {
               const cutGallery: {url:string;desc:string}[] = (config as any).cutGallery || [];
               const isAdmin = user?.role === 'ADMIN';
               if (cutGallery.length === 0 && !isAdmin) return null;
               return (
                 <section className="mb-16">
                   <div className="flex items-center justify-between mb-8">
                     <h2 className={`text-2xl font-black font-display italic flex items-center gap-4 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                       📸 Galeria de Cortes
                       <div className="h-1 flex-1 gradiente-ouro opacity-10 min-w-[40px]"></div>
                     </h2>
                     {isAdmin && (
                       <button
                         onClick={() => setShowGalleryUpload(v => !v)}
                         className="flex items-center gap-2 gradiente-ouro text-black px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
                       >
                         + Adicionar Foto
                       </button>
                     )}
                   </div>

                   {/* Upload form — admin only */}
                   {isAdmin && showGalleryUpload && (
                     <div className={`mb-6 p-6 rounded-2xl border animate-in slide-in-from-top-2 space-y-4 ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-[#C58A4A]/20'}`}>
                       <p className="text-[10px] font-black uppercase tracking-widest text-[#C58A4A]">Nova foto de corte</p>
                       <input
                         type="text"
                         placeholder="Descrição do corte (ex: Degradê com barba delineada)"
                         value={galleryUploadDesc}
                         onChange={e => setGalleryUploadDesc(e.target.value)}
                         className={`w-full border p-4 rounded-xl text-sm font-bold outline-none ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-white/5 border-white/10 text-white'}`}
                       />
                       <label className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all font-black text-[10px] uppercase tracking-widest ${galleryUploading ? 'opacity-60 pointer-events-none border-zinc-600 text-zinc-500' : 'border-[#C58A4A]/40 text-[#C58A4A] hover:border-[#C58A4A] hover:bg-[#C58A4A]/5'}`}>
                         {galleryUploading ? '⟳ Enviando...' : '📷 Escolher foto do dispositivo'}
                         <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={galleryUploading} />
                       </label>
                       <button onClick={() => setShowGalleryUpload(false)} className={`text-[9px] font-black text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest`}>Cancelar</button>
                     </div>
                   )}

                   {/* Photo grid */}
                   {cutGallery.length === 0 ? (
                     <div className={`text-center py-14 rounded-3xl border-2 border-dashed ${theme === 'light' ? 'border-zinc-200 text-zinc-400' : 'border-white/10 text-zinc-600'}`}>
                       <p className="text-4xl mb-3">📸</p>
                       <p className="font-black uppercase text-[10px] tracking-widest">Nenhuma foto cadastrada ainda</p>
                     </div>
                   ) : (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                       {cutGallery.map((photo, idx) => (
                         <div
                           key={idx}
                           className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group shadow-lg"
                           onClick={() => setGalleryLightbox(photo)}
                         >
                           <img src={photo.url} alt={photo.desc || `Corte ${idx+1}`} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex items-end p-3">
                             {photo.desc && <p className="text-white text-[10px] font-bold leading-tight line-clamp-2">{photo.desc}</p>}
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                 </section>
               );
             })()}

             {/* Lightbox galeria */}
             {galleryLightbox && (
               <div
                 className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in"
                 onClick={() => setGalleryLightbox(null)}
               >
                 <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
                   <img src={galleryLightbox.url} alt={galleryLightbox.desc} className="w-full rounded-3xl object-contain max-h-[70vh] shadow-2xl" />
                   {galleryLightbox.desc && (
                     <div className="mt-4 px-2">
                       <p className="text-white font-black text-lg font-display italic">{galleryLightbox.desc}</p>
                     </div>
                   )}
                   <div className="flex gap-3 mt-4">
                     {user?.role === 'ADMIN' && (
                       <button
                         onClick={() => {
                           const photos: {url:string;desc:string}[] = (config as any).cutGallery || [];
                           const idx = photos.findIndex(p => p.url === galleryLightbox.url);
                           if (idx > -1) handleGalleryDelete(idx);
                         }}
                         className="flex-1 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/30 transition-all"
                       >
                         🗑 Excluir
                       </button>
                     )}
                     <button
                       onClick={() => setGalleryLightbox(null)}
                       className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-300 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all"
                     >
                       Fechar
                     </button>
                   </div>
                 </div>
               </div>
             )}

             {/* 2. Nossos Rituais */}
             <section className="mb-6" id="catalogo">
                <AccordionHeader sectionKey="servicos" label="Todos os Serviços" icon={<Scissors size={18}/>} />
                {openSections.has('servicos') && (
                <div className="mt-3 px-2 pb-6 animate-in slide-in-from-top-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                   <h2 className={`text-2xl font-black font-display italic flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Todos os serviços <div className="h-1 w-10 gradiente-ouro opacity-10"></div></h2>
                </div>
                <div className="space-y-4">
                   {categories.filter(cat => cat !== 'Todos').map(cat => {
                     const categoryServices = services.filter(s => s.category === cat);
                     const isExpanded = expandedCategories.includes(cat);
                     
                     return (
                       <div key={cat} className={`rounded-2xl overflow-hidden transition-all ${theme === 'light' ? 'bg-white border border-zinc-200' : 'bg-white/5 border border-white/10'}`}>
                          <button 
                            onClick={() => toggleCategory(cat)}
                            className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-all"
                          >
                             <span className={`text-lg font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{cat}</span>
                             <ChevronRight 
                               className={`transition-transform ${isExpanded ? 'rotate-90' : ''} ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`} 
                               size={20}
                             />
                          </button>
                          
                          {isExpanded && (
                            <div className={`border-t animate-in slide-in-from-top-2 ${theme === 'light' ? 'border-zinc-200' : 'border-white/10'}`}>
                               {categoryServices.map(svc => (
                                 <div key={svc.id} className={`p-6 border-b last:border-b-0 flex items-center justify-between hover:bg-white/5 transition-all ${theme === 'light' ? 'border-zinc-200' : 'border-white/10'}`}>
                                    <div className="flex-1">
                                       <h4 className={`text-base font-bold mb-1 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{svc.name}</h4>
                                       <p className={`text-xs mb-2 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>{svc.description}</p>
                                       <div className="flex items-center gap-4">
                                          <span className={`text-xl font-black ${theme === 'light' ? 'text-blue-600' : 'text-[#B8860B]'}`}>R$ {svc.price.toFixed(2)}</span>
                                          <span className={`text-xs font-black ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>{svc.durationMinutes} min</span>
                                       </div>
                                    </div>
                                    <button 
                                      onClick={() => handleBookingStart(svc)} 
                                      className="ml-4 gradiente-ouro text-black px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
                                    >
                                       Agendar
                                    </button>
                                 </div>
                               ))}\
                            </div>
                          )}
                       </div>
                     );
                   })}
                </div>
                </div>
                )}
             </section>

             {/* 2.5 Produtos */}
             {products && products.filter((p: any) => p.active !== false).length > 0 && (
             <section className="mb-6">
                <AccordionHeader sectionKey="produtos" label="Produtos" icon={<span style={{fontSize:16}}>🛒</span>} />
                {openSections.has('produtos') && (
                <div className="mt-3 px-2 pb-6 animate-in slide-in-from-top-2">
                <h2 className={`text-2xl font-black font-display italic mb-8 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                  Produtos <div className="h-1 flex-1 gradiente-ouro opacity-10"></div>
                </h2>
                <div className="relative group">
                  <button
                    onClick={() => produtosRef.current?.scrollBy({ left: -400, behavior: 'smooth' })}
                    className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl ${theme === 'light' ? 'bg-white border-2 border-zinc-300 text-zinc-900 hover:bg-zinc-50' : 'bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70'}`}
                  >
                    <ChevronLeft size={24}/>
                  </button>
                  <button
                    onClick={() => produtosRef.current?.scrollBy({ left: 400, behavior: 'smooth' })}
                    className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl ${theme === 'light' ? 'bg-white border-2 border-zinc-300 text-zinc-900 hover:bg-zinc-50' : 'bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70'}`}
                  >
                    <ChevronRight size={24}/>
                  </button>
                  <div
                    ref={produtosRef}
                    className="flex gap-4 overflow-x-auto pb-6 snap-x cursor-grab active:cursor-grabbing scrollbar-hide"
                    style={{ scrollBehavior: 'smooth' }}
                    onMouseDown={(e) => handleMouseDown(e, produtosRef)}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={(e) => handleMouseMove(e, produtosRef)}
                  >
                    {products.filter((p: any) => p.active !== false).map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className={`snap-center flex-shrink-0 w-72 md:w-80 rounded-[2.5rem] overflow-hidden group shadow-2xl transition-all cursor-pointer hover:scale-[1.02] hover:border-[#C58A4A]/40 ${theme === 'light' ? 'bg-black border-4 border-zinc-800' : 'bg-black border-4 border-white/5'}`}
                      >
                        {/* Foto completa sem corte */}
                        <div className="w-full bg-black flex items-center justify-center p-3">
                          {p.image
                            ? <img src={p.image} alt={p.name} className="w-full h-auto object-contain max-h-[420px] group-hover:scale-105 transition-all duration-500"/>
                            : <div className="w-full h-48 flex items-center justify-center"><span className="text-5xl">🛒</span></div>
                          }
                        </div>
                        {/* Info */}
                        <div className={`p-4 border-t border-white/5`}>
                          <h3 className="text-sm font-black text-white leading-tight">{p.name}</h3>
                          {p.category && <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">{p.category}</p>}
                          <p className="text-base font-black text-[#C58A4A] mt-1">R$ {Number(p.price).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
                )}
             </section>
             )}

             {/* 3. A Experiência Signature */}
             <section className="mb-6">
                <AccordionHeader sectionKey="ambiente" label="Nosso Ambiente" icon={<span style={{fontSize:16}}>📸</span>} />
                {openSections.has('ambiente') && (
                <div className="mt-3 px-2 pb-6 animate-in slide-in-from-top-2">
                <h2 className={`text-2xl font-black font-display italic mb-8 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Nosso Ambiente <div className="h-1 flex-1 gradiente-ouro opacity-10"></div></h2>
                <div className="relative group">
                  <button 
                    onClick={() => experienciaRef.current?.scrollBy({ left: -500, behavior: 'smooth' })}
                    className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl ${theme === 'light' ? 'bg-white border-2 border-zinc-300 text-zinc-900 hover:bg-zinc-50' : 'bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70'}`}
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    onClick={() => experienciaRef.current?.scrollBy({ left: 500, behavior: 'smooth' })}
                    className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl ${theme === 'light' ? 'bg-white border-2 border-zinc-300 text-zinc-900 hover:bg-zinc-50' : 'bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70'}`}
                  >
                    <ChevronRight size={24} />
                  </button>
                  
                  <div 
                    ref={experienciaRef}
                    className="flex gap-4 overflow-x-auto pb-6 snap-x cursor-grab active:cursor-grabbing scrollbar-hide"
                    style={{ scrollBehavior: 'smooth' }}
                    onMouseDown={(e) => handleMouseDown(e, experienciaRef)}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={(e) => handleMouseMove(e, experienciaRef)}
                  >
                   {(Array.isArray(config.gallery) ? config.gallery : []).map((img, i) => (
                     <div key={i} className={`snap-center flex-shrink-0 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all hover:scale-[1.02] ${theme === 'light' ? 'border-4 border-zinc-200 bg-black' : 'border-4 border-white/5 bg-black'}`}>
                        <img src={img} className="max-h-[480px] w-auto max-w-[85vw] md:max-w-[500px] object-contain block" alt="" />
                     </div>
                   ))}
                   {(!config.gallery || config.gallery.length === 0) && <p className={`italic py-10 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-600'}`}>Em breve, novas fotos do nosso ambiente.</p>}
                </div>
              </div>
                </div>
                )}
             </section>

             {/* 4. Avaliações & Comentários — unificado */}
             {((config.reviews && config.reviews.length > 0) || (suggestions && suggestions.length > 0)) && (() => {
               const hasReviews  = config.reviews && config.reviews.length > 0;
               const hasComments = suggestions && suggestions.length > 0;
               return (
               <section className="mb-6">
                 <AccordionHeader sectionKey="avaliacoes" label="Avaliações & Comentários" icon={<Star size={18}/>} />
                 {openSections.has('avaliacoes') && (
                 <div className="mt-3 animate-in slide-in-from-top-2 py-6 -mx-6 px-6 bg-black">
                 <h2 className="text-2xl font-black font-display italic mb-6 flex items-center gap-6 text-white">
                   Avaliações & Comentários <div className="h-1 flex-1 gradiente-ouro opacity-10"></div>
                 </h2>
                 {/* Tabs */}
                 <div className="flex gap-2 mb-8">
                   <button onClick={() => setActiveReviewTab('reviews')} onTouchEnd={e=>{e.preventDefault();setActiveReviewTab('reviews');}} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeReviewTab==='reviews' ? 'gradiente-ouro text-black' : 'bg-white/5 text-zinc-500 hover:text-white'}`}>
                     ⭐ Avaliações{hasReviews ? ` (${config.reviews.length})` : ''}
                   </button>
                   <button onClick={() => setActiveReviewTab('comments')} onTouchEnd={e=>{e.preventDefault();setActiveReviewTab('comments');}} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeReviewTab==='comments' ? 'gradiente-ouro text-black' : 'bg-white/5 text-zinc-500 hover:text-white'}`}>
                     💬 Comentários{hasComments ? ` (${suggestions.length})` : ''}
                   </button>
                 </div>
                 {/* Avaliações */}
                 {activeReviewTab === 'reviews' && (
                   <div className="relative group">
                     <button onClick={() => membroRef.current?.scrollBy({ left: -400, behavior: 'smooth' })} className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all shadow-xl"><ChevronLeft size={24}/></button>
                     <button onClick={() => membroRef.current?.scrollBy({ left: 400, behavior: 'smooth' })} className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all shadow-xl"><ChevronRight size={24}/></button>
                     <div ref={membroRef} className="flex gap-6 overflow-x-auto pb-6 snap-x cursor-grab active:cursor-grabbing scrollbar-hide" style={{scrollBehavior:'smooth'}} onMouseDown={e=>handleMouseDown(e,membroRef)} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={e=>handleMouseMove(e,membroRef)}>
                       {!hasReviews && <p className="italic py-10 text-center w-full text-zinc-500">Aguardando seu feedback para brilhar aqui.</p>}
                       {config.reviews?.map((rev: any, i: number) => (
                         <div key={i} className="snap-center flex-shrink-0 w-80 p-8 rounded-[2rem] relative cartao-vidro border-white/5">
                           <div className="absolute -top-4 -left-4 w-10 h-10 gradiente-ouro rounded-full flex items-center justify-center text-black shadow-lg"><Quote size={18} fill="currentColor"/></div>
                           <div className="flex gap-1 mb-4">{[1,2,3,4,5].map(s => <Star key={s} size={14} fill={s<=rev.rating?'#C58A4A':'none'} className={s<=rev.rating?'text-[#C58A4A]':'text-zinc-800'}/>)}</div>
                           <p className="text-sm italic leading-relaxed mb-6 text-zinc-300">"{rev.comment}"</p>
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-[#C58A4A]/20 flex items-center justify-center"><User size={18} className="text-[#C58A4A]"/></div>
                             <p className="text-[10px] font-black text-white">{rev.userName}</p>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
                 {/* Comentários */}
                 {activeReviewTab === 'comments' && (
                   <div className="relative group">
                     <button onClick={() => comentRef.current?.scrollBy({ left: -400, behavior: 'smooth' })} className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all shadow-xl"><ChevronLeft size={24}/></button>
                     <button onClick={() => comentRef.current?.scrollBy({ left: 400, behavior: 'smooth' })} className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all shadow-xl"><ChevronRight size={24}/></button>
                     <div ref={comentRef} className="flex gap-6 overflow-x-auto pb-6 snap-x cursor-grab active:cursor-grabbing scrollbar-hide" style={{scrollBehavior:'smooth'}} onMouseDown={e=>handleMouseDown(e,comentRef)} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={e=>handleMouseMove(e,comentRef)}>
                       {!hasComments && <p className="italic py-10 text-center w-full text-zinc-500">Nenhum comentário ainda.</p>}
                       {suggestions?.slice().reverse().map((sugg: any) => {
                         const alreadyLiked = likedSuggs.has(sugg.id);
                         const likeCount = sugg.likes || 0;
                         const handleLike = () => {
                           if (alreadyLiked) return;
                           const next = new Set(likedSuggs).add(sugg.id);
                           setLikedSuggs(next);
                           try { localStorage.setItem('nj_liked_suggs', JSON.stringify([...next])); } catch {}
                           updateSuggestion(sugg.id, { likes: likeCount + 1, likedBy: [...(sugg.likedBy||[]), 'anon_'+Date.now()] });
                         };
                         const dateStr = (() => { if (!sugg.date) return ''; const d = new Date(sugg.date); return isNaN(d.getTime()) ? sugg.date : d.toLocaleDateString('pt-BR'); })();
                         return (
                           <div key={sugg.id} className="snap-center flex-shrink-0 w-80 p-8 rounded-[2rem] relative cartao-vidro border-white/5 flex flex-col">
                             <div className="absolute -top-4 -left-4 w-10 h-10 gradiente-ouro rounded-full flex items-center justify-center text-black shadow-lg"><Quote size={18} fill="currentColor"/></div>
                             <p className="text-sm italic leading-relaxed text-zinc-300 flex-1 mb-6">"{sugg.text}"</p>
                             {sugg.response && (
                               <div className="mb-4 pl-4 border-l-2 border-[#C58A4A]/40">
                                 <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A] mb-1">Barbearia respondeu</p>
                                 <p className="text-xs text-zinc-400 leading-relaxed">{sugg.response}</p>
                               </div>
                             )}
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                 <div className="w-9 h-9 rounded-full bg-[#C58A4A]/20 flex items-center justify-center"><User size={16} className="text-[#C58A4A]"/></div>
                                 <div>
                                   <p className="text-[10px] font-black text-white">{sugg.clientName}</p>
                                   {dateStr && <p className="text-[9px] text-zinc-600">{dateStr}</p>}
                                 </div>
                               </div>
                               <button onClick={handleLike} onTouchEnd={e=>{e.preventDefault();handleLike();}} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${alreadyLiked?'bg-[#C58A4A]/20 text-[#C58A4A]':'bg-white/5 text-zinc-500 hover:text-[#C58A4A] hover:bg-[#C58A4A]/10'}`}>
                                 <Heart size={13} fill={alreadyLiked?'currentColor':'none'}/>
                                 {likeCount > 0 && <span>{likeCount}</span>}
                               </button>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}
               </div>
               )}
               </section>
               );
             })()}
             {/* 5. Nossos Artífices */}
             <section className="mb-6">
                <AccordionHeader sectionKey="profissionais" label="Nossos Profissionais" icon={<User size={18}/>} />
                {openSections.has('profissionais') && (
                <div className="mt-3 px-2 pb-6 animate-in slide-in-from-top-2">
                <h2 className={`text-2xl font-black font-display italic mb-10 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                  Nossos Profissionais <div className="h-1 flex-1 gradiente-ouro opacity-10"></div>
                </h2>
                {/* ── Barbeiro Master (destaque full-width) ── */}
                {professionals.filter(p => p.isMaster).length > 0 && (
                  <div className="mb-8 space-y-4">
                    <div className="flex items-center gap-3">
                      <Crown size={14} className="text-[#C58A4A]" />
                      <span className={`text-[9px] font-black uppercase tracking-[0.25em] ${theme === 'light' ? 'text-[#8B5E2A]' : 'text-[#C58A4A]'}`}>Barbeiro Master</span>
                      <div className="h-px flex-1 bg-gradient-to-r from-[#C58A4A]/40 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {professionals.filter(p => p.isMaster).map(prof => (
                        <div
                          key={prof.id}
                          className={`relative rounded-[2rem] overflow-hidden border group transition-all hover:scale-[1.02] cursor-pointer
                            ${theme === 'light'
                              ? 'bg-gradient-to-br from-amber-50 to-white border-[#C58A4A]/40 hover:border-[#C58A4A] shadow-lg shadow-[#C58A4A]/10'
                              : 'bg-gradient-to-br from-[#C58A4A]/10 via-[#0A0A0A] to-[#0A0A0A] border-[#C58A4A]/40 hover:border-[#C58A4A] shadow-xl shadow-[#C58A4A]/10'
                            }`}
                          onClick={() => { setSelectedProfessional(prof); setShowProfessionalModal(true); }}
                        >
                          {/* Faixa dourada no topo */}
                          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#8B5E2A] via-[#C58A4A] to-[#E8B97A]" />

                          <div className="flex items-center gap-6 p-6 pt-7">
                            {/* Foto grande */}
                            <div className="relative shrink-0">
                              <img
                                src={prof.avatar}
                                className="w-28 h-auto rounded-2xl object-contain border-2 border-[#C58A4A] shadow-xl block"
                                alt={prof.name}
                              />
                              <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-[#8B5E2A] to-[#E8B97A] p-2 rounded-xl shadow-lg">
                                <Crown size={14} className="text-black" />
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-black text-xl font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{prof.name}</p>
                                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-[#8B5E2A] to-[#C58A4A] text-black text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                                  <Crown size={7} /> Master
                                </span>
                              </div>
                              <p className={`text-[9px] uppercase tracking-widest font-black ${theme === 'light' ? 'text-[#8B5E2A]' : 'text-[#C58A4A]'}`}>
                                Proprietário · Barbeiro Master
                              </p>
                              {prof.description && (
                                <p className={`text-xs leading-relaxed line-clamp-2 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>{prof.description}</p>
                              )}
                              {/* Adicional Master */}
                              {prof.masterSurcharge && prof.masterSurcharge > 0 ? (
                                <p className={`text-[9px] font-black inline-flex items-center gap-1 px-2 py-1 rounded-lg ${theme === 'light' ? 'bg-amber-100 text-[#8B5E2A]' : 'bg-[#C58A4A]/15 text-[#C58A4A]'}`}>
                                  + R$ {prof.masterSurcharge.toFixed(2)} por serviço
                                </p>
                              ) : null}
                              {/* Likes */}
                              <div className="flex items-center gap-1 mt-1">
                                <Heart size={11} fill="currentColor" className="text-red-500" />
                                <span className="text-red-500 text-[10px] font-black">{prof.likes || 0} curtidas</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Equipe regular ── */}
                {professionals.filter(p => !p.isMaster).length > 0 && (
                  <div className="space-y-4">
                    {professionals.filter(p => p.isMaster).length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black uppercase tracking-[0.25em] ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>Equipe</span>
                        <div className={`h-px flex-1 ${theme === 'light' ? 'bg-zinc-200' : 'bg-white/5'}`} />
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {professionals.filter(p => !p.isMaster).map(prof => (
                        <div
                          key={prof.id}
                          className={`rounded-[2rem] p-6 text-center space-y-4 group transition-all hover:scale-105 cursor-pointer ${theme === 'light' ? 'bg-white border border-zinc-200 hover:border-[#C58A4A]/40' : 'cartao-vidro border-white/5 hover:border-[#C58A4A]/30'}`}
                          onClick={() => { setSelectedProfessional(prof); setShowProfessionalModal(true); }}
                        >
                          <div className="relative mx-auto w-28">
                            <img src={prof.avatar} className="w-full h-auto rounded-2xl object-contain border-2 border-[#C58A4A] shadow-lg block" alt="" />
                            <div className="absolute -right-8 top-1 text-red-500 text-xs font-black flex items-center gap-0.5 whitespace-nowrap">
                              <Heart size={12} fill="currentColor" /> <span>{prof.likes || 0}</span>
                            </div>
                          </div>
                          <div>
                            <p className={`font-black text-sm ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{prof.name}</p>
                            <p className={`text-[8px] uppercase tracking-widest font-black mt-1 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-600'}`}>{prof.specialty}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
                )}
             </section>

             {/* Planos VIP movidos para após Destaques */}

                          {/* 7. Programa de Fidelidade */}
             {((config as any).stampsForFreeCut || (config as any).cashbackPercent) && (
               <section className="mb-6">
                 <AccordionHeader sectionKey="fidelidade" label="Programa de Fidelidade" icon={<Star size={18}/>} />
                 {openSections.has('fidelidade') && (
                 <div className="mt-3 px-2 pb-6 animate-in slide-in-from-top-2">
                 <h2 className={`text-2xl font-black font-display italic mb-10 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                   Programa de Fidelidade <Star size={24} className="text-[#C58A4A]" /> <div className="h-1 flex-1 gradiente-ouro opacity-10"></div>
                 </h2>
                 <div className={`rounded-[2.5rem] p-8 md:p-12 border overflow-hidden relative ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-[#C58A4A]/20'}`}>
                   <div className="absolute top-0 inset-x-0 h-1 gradiente-ouro"></div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                     <div className="space-y-6">
                       <p className={`text-lg font-bold leading-relaxed ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>
                         Cada visita te aproxima de uma recompensa. Acumule selos e cashback a cada serviço realizado!
                       </p>
                       <div className="space-y-4">
                         {(config as any).stampsForFreeCut && (
                           <div className={`flex items-center gap-4 p-4 rounded-2xl ${theme === 'light' ? 'bg-zinc-50 border border-zinc-200' : 'bg-white/5 border border-white/10'}`}>
                             <div className="w-12 h-12 gradiente-ouro rounded-xl flex items-center justify-center shrink-0">
                               <Scissors size={20} className="text-black" />
                             </div>
                             <div>
                               <p className={`font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Corte Grátis</p>
                               <p className={`text-sm ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>A cada <strong>{(config as any).stampsForFreeCut} visitas</strong>, ganhe um corte grátis</p>
                             </div>
                           </div>
                         )}
                         {(config as any).cashbackPercent && (
                           <div className={`flex items-center gap-4 p-4 rounded-2xl ${theme === 'light' ? 'bg-zinc-50 border border-zinc-200' : 'bg-white/5 border border-white/10'}`}>
                             <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center shrink-0">
                               <span className="text-emerald-500 font-black text-sm">%</span>
                             </div>
                             <div>
                               <p className={`font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Cashback {(config as any).cashbackPercent}%</p>
                               <p className={`text-sm ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>{(config as any).cashbackPercent}% de cada serviço volta como crédito para você</p>
                             </div>
                           </div>
                         )}
                       </div>
                       <button
                         onClick={() => setView('LOGIN')}
                         className="inline-flex items-center gap-3 gradiente-ouro text-black px-8 py-4 rounded-full font-black text-xs uppercase shadow-2xl hover:scale-105 transition-all"
                       >
                         <Star size={16} /> Ativar meu cartão fidelidade
                       </button>
                     </div>
                     {/* Cartão de selos visual */}
                     <div className={`rounded-[2rem] p-6 border ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
                       <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>Seu Cartão Digital</p>
                       <p className={`text-lg font-black italic mb-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Acumule selos a cada visita</p>
                       <div className="grid grid-cols-5 gap-2 mb-6">
                         {Array.from({ length: (config as any).stampsForFreeCut || 10 }).map((_, i) => (
                           <div key={i} className={`aspect-square rounded-xl flex items-center justify-center border-2 transition-all ${i < 3 ? 'gradiente-ouro border-transparent' : theme === 'light' ? 'bg-zinc-100 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
                             {i < 3 ? <Scissors size={14} className="text-black" /> : <span className={`text-[10px] font-black ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>{i + 1}</span>}
                           </div>
                         ))}
                       </div>
                       <div className={`flex items-center justify-between text-sm ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                         <span>3/{(config as any).stampsForFreeCut || 10} selos</span>
                         <span className="text-[#C58A4A] font-black">{(config as any).cashbackPercent || 5}% cashback por visita</span>
                       </div>
                     </div>
                   </div>
                 </div>
                 </div>
                 )}
               </section>
             )}

             {/* Vitrine de Parceiros — sem QR público */}
             {(partners || []).filter((p: any) => p.status === 'ATIVO').length > 0 && (
               <section className="mb-6">
                 <AccordionHeader sectionKey="parceiros" label="Parceiros & Benefícios" icon={<Gift size={18}/>} />
                 {openSections.has('parceiros') && (
                 <div className="mt-3 px-2 pb-6 animate-in slide-in-from-top-2">
                 <h2 className={`text-2xl font-black font-display italic mb-4 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                   Parceiros & Benefícios <div className="h-1 flex-1 gradiente-ouro opacity-10"></div>
                 </h2>
                 <p className={`text-sm mb-10 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                   Faça login no portal para gerar seu QR Code e usar o desconto em qualquer parceiro.
                 </p>

                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                   {(partners || [])
                     .filter((p: any) => p.status === 'ATIVO')
                     .map((partner: any) => {
                       const categoryIcons: Record<string, string> = {
                         'Açaí': '🍧', 'Hamburgueria': '🍔', 'Loja Masculina': '👔',
                         'Academia': '💪', 'Lava-jato': '🚗', 'Ótica': '👓',
                         'Restaurante': '🍽️', 'Farmácia': '💊', 'Pet Shop': '🐾', 'Outro': '🏪',
                       };
                       const icon = categoryIcons[partner.category || 'Outro'] || '🏪';
                       return (
                         <div key={partner.id} className={`rounded-[2.5rem] overflow-hidden border transition-all hover:scale-[1.02] ${theme === 'light' ? 'bg-black border-zinc-800' : 'bg-black border-white/10'}`}>

                           {/* Banner / imagem do parceiro */}
                           {partner.image ? (
                             <div className={`w-full aspect-[16/9] overflow-hidden flex items-center justify-center bg-black`}>
                               <img src={partner.image} alt={partner.businessName} className="w-full h-full object-contain" />
                             </div>
                           ) : (
                             <div className={`h-36 flex items-center justify-center text-5xl ${theme === 'light' ? 'bg-zinc-100' : 'bg-white/5'}`}>
                               {icon}
                             </div>
                           )}

                           <div className="p-6">
                             {/* Logo + nome */}
                             <div className="flex items-center gap-3 mb-4">
                               {partner.logo ? (
                                 <img src={partner.logo} className="w-10 h-10 rounded-xl object-contain border border-white/10" alt="" />
                               ) : (
                                 <div className="w-10 h-10 rounded-xl bg-[#C58A4A]/20 flex items-center justify-center text-xl flex-shrink-0">
                                   {icon}
                                 </div>
                               )}
                               <div>
                                 <p className={`font-black text-base leading-tight ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                                   {partner.businessName || partner.name}
                                 </p>
                                 {partner.category && (
                                   <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                     {partner.category}
                                   </p>
                                 )}
                               </div>
                             </div>

                             {/* Descrição */}
                             {partner.description && (
                               <p className={`text-xs mb-4 leading-relaxed ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                 {partner.description}
                               </p>
                             )}

                             {/* Badges desconto */}
                             <div className="flex items-center gap-2 mb-5 flex-wrap">
                               {partner.discount > 0 && (
                                 <span className="text-[9px] font-black text-emerald-500 uppercase bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                   {partner.discount}% desconto
                                 </span>
                               )}
                               {partner.cashbackPercent > 0 && (
                                 <span className="text-[9px] font-black text-[#C58A4A] uppercase bg-[#C58A4A]/10 border border-[#C58A4A]/20 px-3 py-1 rounded-full">
                                   {partner.cashbackPercent}% cashback
                                 </span>
                               )}
                             </div>

                             {/* CTA — leva para o login */}
                             <button
                               onClick={() => setView('LOGIN')}
                               className="w-full gradiente-ouro text-black py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all"
                             >
                               🔑 Entrar para usar
                             </button>
                           </div>
                         </div>
                       );
                     })
                   }
                 </div>
                 </div>
                 )}
               </section>
             )}

             {/* ── INDIQUE E GANHE — Banner ── */}
             <section className="mb-10">
               <button
                 onClick={() => setView('LOGIN')}
                 className="w-full relative overflow-hidden rounded-[2rem] p-0 border-2 border-[#C58A4A]/40 hover:border-[#C58A4A] transition-all group"
                 style={{background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0e00 50%, #0a0a0a 100%)'}}
               >
                 {/* Glow animado */}
                 <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500" style={{background: 'radial-gradient(ellipse at center, rgba(197,138,74,0.15) 0%, transparent 70%)'}}/>
                 {/* Linha dourada topo */}
                 <div className="absolute top-0 left-0 right-0 h-0.5" style={{background: 'linear-gradient(90deg, transparent, #C58A4A, #E8B97A, #C58A4A, transparent)'}}/>

                 <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-6 sm:px-10 sm:py-8">
                   <div className="flex items-center gap-5 text-left">
                     <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0" style={{background: 'linear-gradient(135deg, #8B5E2A, #E8B97A)'}}>
                       <span className="text-2xl sm:text-3xl">🎁</span>
                     </div>
                     <div>
                       <p className="text-[#E8B97A] text-[10px] font-black uppercase tracking-[0.3em] mb-1">Programa de Indicação</p>
                       <p className="text-white text-xl sm:text-2xl font-black font-display italic leading-tight">
                         Indique e Ganhe{' '}
                         <span style={{color: '#C58A4A'}}>R$ {(config as any).referralRewardAmount ?? 5}</span>
                       </p>
                       <p className="text-zinc-400 text-[11px] sm:text-xs mt-1">
                         Cada amigo que cortar = crédito na sua carteira · {(config as any).referralFreeCutThreshold ?? 3} indicações = 1 corte grátis
                       </p>
                     </div>
                   </div>
                   <div className="shrink-0">
                     <span className="inline-flex items-center gap-2 text-black font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg transition-all group-hover:scale-105" style={{background: 'linear-gradient(135deg, #C58A4A, #E8B97A)'}}>
                       Quero Indicar <ArrowRight size={14}/>
                     </span>
                   </div>
                 </div>
                 {/* Linha dourada base */}
                 <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{background: 'linear-gradient(90deg, transparent, #C58A4A, #E8B97A, #C58A4A, transparent)'}}/>
               </button>
             </section>

             {/* ── RANKING TOP 10 ── */}
             <section className="mb-6" id="ranking">
               <AccordionHeader sectionKey="ranking" label="Ranking de Clientes" icon={<Trophy size={18}/>} />
               {openSections.has('ranking') && (
               <div className="mt-3 px-2 pb-6 animate-in slide-in-from-top-2">
               <div className="flex items-center gap-3 mb-3">
                 <Trophy size={22} className="text-[#C58A4A] shrink-0"/>
                 <h2 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Ranking de Clientes</h2>
                 <div className="h-px flex-1 gradiente-ouro opacity-20"/>
               </div>
               <p className={`text-sm mb-6 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Os clientes mais dedicados da nossa família. ✂️ cortes + 👥 indicações</p>

               {/* Top 3 — destaque especial */}
               {clientRanking.length > 0 && (
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                   {clientRanking.slice(0, 3).map((cl: any, idx: number) => {
                     // 1º = PREMIUM BLACK (centro, maior), 2º = OURO (esquerda), 3º = PRATA (direita)
                     const tiers = [
                       {
                         // 1º lugar — PREMIUM BLACK
                         label: 'PREMIUM BLACK',
                         medal: '1',           // número da posição
                         icon: '👑',
                         nameColor: '#E8B97A',  // dourado — legível no fundo preto
                         statColor: 'rgba(232,185,122,0.7)',
                         labelColor: '#C58A4A',
                         borderColor: '#C58A4A',
                         bg: 'linear-gradient(160deg, #0a0a0a 0%, #1c1000 60%, #0a0a0a 100%)',
                         glow: '0 0 32px rgba(197,138,74,0.4), 0 0 64px rgba(197,138,74,0.15)',
                         badgeBg: 'linear-gradient(135deg, #8B5E2A, #C58A4A)',
                         badgeTextColor: '#000',
                         order: 'sm:order-2',
                         scale: 'sm:scale-105',
                       },
                       {
                         // 2º lugar — OURO
                         label: 'OURO',
                         medal: '2',
                         icon: '🥈',            // 🥈 = prata = 2º lugar (medalha correta)
                         nameColor: '#1a0800',
                         statColor: 'rgba(0,0,0,0.6)',
                         labelColor: '#000',
                         borderColor: '#E8B97A',
                         bg: 'linear-gradient(135deg, #C58A4A 0%, #E8B97A 100%)',
                         glow: '0 0 20px rgba(197,138,74,0.5)',
                         badgeBg: 'rgba(0,0,0,0.25)',
                         badgeTextColor: '#1a0800',
                         order: 'sm:order-1',
                         scale: '',
                       },
                       {
                         // 3º lugar — PRATA
                         label: 'PRATA',
                         medal: '3',
                         icon: '🥉',            // 🥉 = bronze = 3º lugar (medalha correta)
                         nameColor: '#1a1a1a',
                         statColor: 'rgba(0,0,0,0.5)',
                         labelColor: '#333',
                         borderColor: '#cbd5e1',
                         bg: 'linear-gradient(135deg, #94a3b8 0%, #e2e8f0 100%)',
                         glow: '0 0 16px rgba(148,163,184,0.3)',
                         badgeBg: 'rgba(0,0,0,0.15)',
                         badgeTextColor: '#1a1a1a',
                         order: 'sm:order-3',
                         scale: '',
                       },
                     ][idx];
                     return (
                       <div key={cl.id} className={`relative rounded-[1.5rem] border-2 p-5 flex flex-col items-center text-center transition-all ${tiers.order} ${tiers.scale} ${idx === 0 ? 'sm:mt-0' : 'sm:mt-6'}`}
                         style={{background: tiers.bg, borderColor: tiers.borderColor, boxShadow: tiers.glow}}>
                         {/* Badge label no topo */}
                         <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest whitespace-nowrap"
                           style={{background: tiers.badgeBg, color: tiers.badgeTextColor, border: `1.5px solid ${tiers.borderColor}`}}>
                           {tiers.label}
                         </div>
                         {/* Ícone medalha */}
                         <span className="text-4xl mt-3 mb-2 drop-shadow-lg">{tiers.icon}</span>
                         {/* Nome — sempre legível */}
                         <p className="font-black text-sm leading-tight mb-1 truncate w-full" style={{color: tiers.nameColor}}>{cl.name}</p>
                         {/* Stats */}
                         <div className="flex gap-3 text-[9px] font-black mt-1" style={{color: tiers.statColor}}>
                           <span>✂️ {cl.totalCuts}</span>
                           <span>👥 {cl.totalReferrals}</span>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}

               {/* 4º ao 10º — lista compacta */}
               {clientRanking.length > 3 && (
                 <div className="space-y-2">
                   {clientRanking.slice(3, 10).map((cl: any, idx: number) => (
                     <div key={cl.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${theme === 'light' ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-white/[0.04] border-white/5 hover:border-white/10'}`}>
                       <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${theme === 'light' ? 'bg-zinc-100 text-zinc-500' : 'bg-white/10 text-zinc-400'}`}>{idx + 4}</span>
                       <span className={`flex-1 font-bold text-sm truncate ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-200'}`}>{cl.name}</span>
                       <span className={`text-[10px] font-black shrink-0 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>✂️ {cl.totalCuts} · 👥 {cl.totalReferrals}</span>
                     </div>
                   ))}
                 </div>
               )}

               {clientRanking.length === 0 && (
                 <p className={`text-center py-10 text-sm italic ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>Nenhum cliente no ranking ainda. Seja o primeiro! ✂️</p>
               )}
               </div>
               )}
             </section>

             {/* 8. Onde Nos Encontrar */}
             <section className="mb-24">
                <h2 className={`text-2xl font-black font-display italic mb-10 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Onde Nos Encontrar <div className="h-1 flex-1 gradiente-ouro opacity-10"></div></h2>
                <div className={`rounded-[2.5rem] overflow-hidden shadow-2xl ${theme === 'light' ? 'border border-zinc-200' : 'border border-white/5'}`}>
                   <div className="overflow-hidden rounded-[2rem] shadow-2xl cursor-pointer hover:opacity-90 transition-all" onClick={() => config.locationUrl && window.open(config.locationUrl, '_blank')}>
                      {config.locationImage ? (
                        <img src={config.locationImage} className="w-full rounded-[2rem] object-contain shadow-2xl" alt="Nossa localização" />
                      ) : (
                        <MapPin className="text-[#C58A4A]" size={48}/>
                      )}
                   </div>
                   <div className={`p-8 ${theme === 'light' ? 'bg-white' : 'bg-white/5'}`}>
                      <p className={`text-sm font-bold mb-2 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{config.address}</p>
                      <p className={`text-xs ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>{config.phone}</p>
                   </div>
                </div>
             </section>

             {/* 7. Redes Sociais */}

             <section className="mb-20 text-center">
                <h2 className={`text-2xl font-black font-display italic mb-10 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Conecte-se Conosco</h2>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                   <a href="https://www.instagram.com/novojeitobarbearia/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-10 py-4 rounded-full font-black text-xs uppercase shadow-2xl hover:scale-105 transition-all">
                      <Instagram size={20}/> Siga no Instagram
                   </a>
                   <a href="https://wa.me/5521973708141" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-green-500 text-white px-10 py-4 rounded-full font-black text-xs uppercase shadow-2xl hover:scale-105 transition-all">
                      <Phone size={20}/> Fale no WhatsApp
                   </a>
                </div>
             </section>

             {/* 8. Quem Somos */}
             <section className="mb-24">
                <h2 className={`text-2xl font-black font-display italic mb-10 flex items-center gap-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{config.aboutTitle || 'Quem Somos'} <div className="h-1 flex-1 gradiente-ouro opacity-10"></div></h2>
                <div className={`rounded-[2.5rem] p-8 md:p-12 ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-white/5'}`}>
                   <div className="grid md:grid-cols-2 gap-8 items-center">
                      {config.aboutImage && (
                        <div className="h-64 md:h-80 rounded-2xl overflow-hidden">
                           <img src={config.aboutImage} className="w-full rounded-[2rem] object-contain shadow-xl" alt="Sobre nós" />
                        </div>
                      )}
                      <p className={`text-base leading-relaxed ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>
                         {config.aboutText || 'Tradição, estilo e excelência em cada serviço. Nossa barbearia é mais que um lugar para cortar cabelo - é um espaço de encontro, cultura e cuidado pessoal.'}
                      </p>
                   </div>
                </div>
             </section>
          </main>

          {/* ── Modal: Detalhes do Produto ── */}
          {selectedProduct && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95" onClick={() => setSelectedProduct(null)}>
              <div
                className={`w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-[#0a0a0a] border-white/10'}`}
                onClick={e => e.stopPropagation()}
              >
                {/* Foto completa */}
                <div className="w-full bg-black flex items-center justify-center p-6 shrink-0">
                  {selectedProduct.image
                    ? <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-auto object-contain max-h-[300px]"/>
                    : <div className="w-full h-48 flex items-center justify-center"><span className="text-6xl">🛒</span></div>
                  }
                </div>
                {/* Info */}
                <div className="flex-1 overflow-y-auto p-7 space-y-4">
                  <div>
                    {selectedProduct.category && (
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A] mb-1">{selectedProduct.category}</p>
                    )}
                    <h2 className={`text-2xl font-black font-display italic leading-tight ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{selectedProduct.name}</h2>
                    <p className="text-3xl font-black text-[#C58A4A] mt-2">R$ {Number(selectedProduct.price).toFixed(2)}</p>
                  </div>
                  {selectedProduct.description && (
                    <p className={`text-sm leading-relaxed font-medium ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>{selectedProduct.description}</p>
                  )}
                  <a
                    href={`https://wa.me/5521973708141?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${selectedProduct.name} (R$ ${Number(selectedProduct.price).toFixed(2)})`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-3 w-full gradiente-ouro text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl"
                  >
                    💬 Tenho Interesse
                  </a>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${theme === 'light' ? 'border-zinc-200 text-zinc-500' : 'border-white/10 text-zinc-500 hover:text-white'}`}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Botão Flutuante: Agendar Agora ── */}
          <div className="fixed bottom-4 right-4 z-[90] animate-in slide-in-from-bottom-4 duration-700">
            <button
              onClick={() => { setView('BOOKING'); setPasso(1); }}
              className="flex items-center gap-1.5 gradiente-ouro text-black px-3 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#C58A4A]/30 hover:scale-105 active:scale-95 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Agendar
            </button>
          </div>

          <footer className={`py-10 text-center border-t ${theme === 'light' ? 'border-zinc-200 bg-zinc-50 text-zinc-600' : 'border-white/5 bg-white/[0.01] text-zinc-600'}`}>
             <p className="text-[10px] font-black uppercase tracking-widest">© 2026 {config.name}. PRODUZIDO POR ©NIKLAUS. Todos os direitos reservados.</p>
          </footer>
        </div>
      )}

      {view === 'LOGIN' && (
        <div className="flex-1 flex items-center justify-center p-6 animate-in fade-in zoom-in">
           <div className={`w-full max-w-md rounded-[3rem] p-12 space-y-10 shadow-2xl ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-[#C58A4A]/20'}`}>
              <div className="text-center space-y-4">
                 <div className="w-16 h-16 rounded-2xl gradiente-ouro p-1 mx-auto"><div className="w-full h-full rounded-[1.8rem] bg-black overflow-hidden flex items-center justify-center"><Lock className="text-[#C58A4A]" size={24}/></div></div>
                 <h2 className={`text-3xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Portal do Cliente</h2>
                 {loginMode !== 'setpassword' && (
                <div className={`flex rounded-xl overflow-hidden border ${theme === 'light' ? 'border-zinc-200' : 'border-white/10'}`}>
                    <button onClick={() => { setLoginMode('login'); setRegisterError(null); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${loginMode === 'login' ? 'bg-[#C58A4A] text-black' : theme === 'light' ? 'bg-zinc-50 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}>Entrar</button>
                    <button onClick={() => { setLoginMode('register'); setRegisterError(null); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${loginMode === 'register' ? 'bg-[#C58A4A] text-black' : theme === 'light' ? 'bg-zinc-50 text-zinc-600' : 'bg-white/5 text-zinc-500'}`}>Criar Conta</button>
                 </div>
              )}
              </div>
              
              {loginMode === 'setpassword' && noPasswordClient ? (
                // ── Tela: definir senha (cliente pré-cadastrado pelo admin) ──
                <div className="space-y-5">
                  <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/20'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme === 'light' ? 'text-blue-700' : 'text-blue-400'}`}>
                      Cadastro encontrado! 👋
                    </p>
                    <p className={`text-xs font-bold ${theme === 'light' ? 'text-blue-600' : 'text-blue-300'}`}>
                      Olá, <strong>{noPasswordClient.name}</strong>! Seu cadastro foi criado pela barbearia. Defina uma senha para acessar seu portal.
                    </p>
                  </div>
                  {registerError && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-[10px] font-black uppercase text-center">{registerError}</div>}
                  <input
                    type="password"
                    placeholder="Criar senha"
                    value={setPasswordData.password}
                    onChange={e => setSetPasswordData(p => ({...p, password: e.target.value}))}
                    className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}
                  />
                  <input
                    type="password"
                    placeholder="Confirmar senha"
                    value={setPasswordData.confirmPassword}
                    onChange={e => setSetPasswordData(p => ({...p, confirmPassword: e.target.value}))}
                    className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}
                  />
                  <button
                    onClick={handleSetPassword}
                    disabled={loading}
                    className="w-full gradiente-ouro text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-105 transition-all"
                  >
                    {loading ? 'Salvando...' : 'DEFINIR SENHA E ENTRAR'}
                  </button>
                  <button
                    onClick={() => { setLoginMode('login'); setNoPasswordClient(null); setRegisterError(null); }}
                    className={`w-full text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    ← Voltar ao login
                  </button>
                </div>
              ) : loginMode === 'forgot' ? (
                <div className="space-y-5">
                  {forgotSuccess ? (
                    <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-500 text-center font-black text-sm">✅ Senha alterada com sucesso!</div>
                  ) : forgotStep === 'phone' ? (
                    <>
                      <p className={`text-[10px] font-black uppercase tracking-widest text-center ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Digite seu WhatsApp cadastrado</p>
                      {forgotError && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-[10px] font-black text-center">{forgotError}</div>}
                      <input type="tel" placeholder="(21) 99999-9999" value={forgotPhone} onChange={e => setForgotPhone(e.target.value)} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                      <button onClick={handleForgotLookup} className="w-full gradiente-ouro text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-105 transition-all">CONTINUAR</button>
                    </>
                  ) : (
                    <>
                      <p className={`text-[10px] font-black uppercase tracking-widest text-center ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Olá, {forgotClient?.name}! Crie sua nova senha</p>
                      {forgotError && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-[10px] font-black text-center">{forgotError}</div>}
                      <input type="password" placeholder="Nova senha (mín. 4 caracteres)" value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                      <input type="password" placeholder="Confirmar nova senha" value={forgotConfirmPassword} onChange={e => setForgotConfirmPassword(e.target.value)} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                      <button onClick={handleForgotReset} className="w-full gradiente-ouro text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-105 transition-all">SALVAR NOVA SENHA</button>
                    </>
                  )}
                  <div className="text-center">
                    <button onClick={() => { setLoginMode('login'); setForgotStep('phone'); setForgotError(null); }} className={`text-[9px] font-black uppercase tracking-widest hover:underline ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>← Voltar ao login</button>
                  </div>
                </div>
              ) : loginMode === 'login' ? (
                <div className="space-y-6">
                   <input type="text" placeholder="E-mail ou WhatsApp" value={loginIdentifier} onChange={e => setLoginIdentifier(e.target.value)} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                   <input type="password" placeholder="Senha" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                   <button onClick={handleLoginPortal} className="w-full gradiente-ouro text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-105 transition-all">ACESSAR PORTAL</button>
                   <div className="text-center pt-1">
                     <button onClick={() => { setLoginMode('forgot'); setForgotStep('phone'); setForgotError(null); }} className={`text-[9px] font-black uppercase tracking-widest hover:underline ${theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300'}`}>🔑 Esqueci minha senha</button>
                   </div>
                </div>
              ) : (
                <div className="space-y-4">
                   {registerError && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-[10px] font-black uppercase text-center">{registerError}</div>}
                  {/* Banner de indicação quando vem via link */}
                  {urlReferrerId && (
                    <div className="rounded-2xl p-4 border mb-2" style={{background:'linear-gradient(135deg,#0d0800,#1a0e00)', borderColor:'#C58A4A'}}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl shrink-0">🎁</span>
                        <div>
                          <p className="text-[#E8B97A] font-black text-[10px] uppercase tracking-widest">Você foi indicado!</p>
                          <p className={`text-sm font-bold mt-0.5 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                            {urlReferrerName ? <><strong className="text-[#C58A4A]">{urlReferrerName}</strong> te convidou para a barbearia!</> : 'Você foi convidado por um amigo!'}
                          </p>
                          <p className="text-zinc-400 text-[10px] mt-1">Cadastre-se e faça seu primeiro corte — seu amigo ganha uma recompensa 💰</p>
                        </div>
                      </div>
                    </div>
                  )}
                   <input type="text" placeholder="Nome Completo" value={registerData.name} onChange={e => setRegisterData({...registerData, name: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                   <input type="tel" placeholder="WhatsApp" value={registerData.phone} onChange={e => setRegisterData({...registerData, phone: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                   <input type="email" placeholder="E-mail" value={registerData.email} onChange={e => setRegisterData({...registerData, email: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                   <input type="password" placeholder="Senha" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                   <input type="password" placeholder="Confirmar Senha" value={registerData.confirmPassword} onChange={e => setRegisterData({...registerData, confirmPassword: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                   <button onClick={handleRegisterPortal} disabled={loading} className="w-full gradiente-ouro text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-105 transition-all">{loading ? 'Criando...' : 'CRIAR MINHA CONTA'}</button>
                </div>
              )}
              
              <button onClick={() => setView('HOME')} className={`w-full text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-600 hover:text-[#C58A4A]'}`}>Voltar ao Início</button>
           </div>
        </div>
      )}

      {view === 'CLIENT_DASHBOARD' && loggedClient && (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-6 pb-20 animate-in fade-in">
           {/* ── NOVO: Clube de Benefícios overlay ── */}
           {showBeneficios && loggedClient && (
             <ClubeBeneficios clientId={loggedClient.id} onClose={() => setShowBeneficios(false)} />
           )}

           <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <h1 className={`text-3xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Meu Portal</h1>
                <button
                  onClick={() => setShowBeneficios(true)}
                  className="flex items-center gap-2 gradiente-ouro text-black px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
                >
                  <Gift size={14} /> Benefícios 🎁
                </button>
              </div>
              <button onClick={handleLogout} className={`flex items-center gap-2 px-6 py-3 rounded-xl border transition-all ${theme === 'light' ? 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}>
                 <LogOut size={16}/> Sair
              </button>
           </div>

           <div className="grid md:grid-cols-3 gap-6 mb-10">
              <div className={`md:col-span-1 rounded-[2rem] p-8 text-center space-y-6 ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-white/5'}`}>
                 <div className="relative inline-block">
                    <img src={loggedClient.avatar || 'https://via.placeholder.com/120'} className="w-28 h-28 rounded-3xl object-cover border-4 border-[#C58A4A]" alt="" />
                    <label className="absolute -bottom-2 -right-2 bg-[#C58A4A] text-black p-2 rounded-xl cursor-pointer hover:scale-110 transition-all shadow-lg">
                       <Upload size={14}/>
                       <input type="file" accept="image/*" onChange={handleUpdateProfilePhoto} className="hidden"/>
                    </label>
                 </div>
                 <div>
                    <p className={`text-xl font-black font-display ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{loggedClient.name}</p>
                    <p className={`text-[9px] uppercase tracking-widest font-black mt-2 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Cliente Exclusivo</p>
                 </div>
                 <div className={`space-y-2 text-left ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-400'}`}>
                    <p className="text-xs flex items-center gap-2"><Phone size={12} className="text-[#C58A4A]"/> {loggedClient.phone}</p>
                    <p className="text-xs flex items-center gap-2"><Mail size={12} className="text-[#C58A4A]"/> {loggedClient.email}</p>
                 </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                 <div className={`rounded-[2rem] p-8 ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-white/5'}`}>
                    <h3 className={`text-lg font-black font-display italic mb-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Enviar Sugestão</h3>
                    <textarea rows={4} placeholder="Conte-nos suas ideias..." value={suggestionText} onChange={e => setSuggestionText(e.target.value)} className={`w-full border p-4 rounded-xl outline-none text-sm ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}/>
                    <button onClick={handleSendSuggestion} disabled={loading} className="mt-4 w-full gradiente-ouro text-black py-4 rounded-xl font-black uppercase text-[10px] shadow-xl">
                       {loading ? 'Enviando...' : <><Send size={14} className="inline mr-2"/> Enviar Sugestão</>}
                    </button>
                 </div>

                 <div className={`rounded-[2rem] p-8 ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-white/5'}`}>
                    <h3 className={`text-lg font-black font-display italic mb-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Minhas Sugestões e Respostas</h3>
                    <div className="space-y-4 max-h-80 overflow-y-auto scrollbar-hide">
                       {suggestions.filter(s => s.clientPhone === loggedClient.phone).length === 0 && (
                          <p className={`text-center py-6 italic text-sm ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-600'}`}>Nenhuma sugestão enviada ainda.</p>
                       )}
                       {suggestions.filter(s => s.clientPhone === loggedClient.phone).map(sugg => (
                          <div key={sugg.id} className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
                             <div className="flex items-start gap-3 mb-2">
                                <MessageSquare size={16} className="text-[#C58A4A] flex-shrink-0 mt-1" />
                                <div className="flex-1">
                                   <p className={`text-xs font-bold mb-1 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Enviado em {sugg.date}</p>
                                   <p className={`text-sm ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{sugg.message}</p>
                                </div>
                             </div>
                             {sugg.response && (
                                <div className={`mt-3 pt-3 border-t ${theme === 'light' ? 'border-zinc-200' : 'border-white/10'}`}>
                                   <div className="flex items-start gap-2">
                                      <div className="w-6 h-6 rounded-full bg-[#C58A4A] flex items-center justify-center flex-shrink-0">
                                         <Check size={12} className="text-black" />
                                      </div>
                                      <div>
                                         <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>Resposta do Administrador:</p>
                                         <p className={`text-sm ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>{sugg.response}</p>
                                      </div>
                                   </div>
                                </div>
                             )}
                             {!sugg.response && (
                                <p className={`text-xs italic mt-2 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-600'}`}>Aguardando resposta...</p>
                             )}
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className={`rounded-[2rem] p-8 ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-white/5'}`}>
                    <h3 className={`text-lg font-black font-display italic mb-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Avaliar Experiência</h3>
                    <button onClick={() => setShowReviewModal(true)} className="w-full gradiente-ouro text-black py-4 rounded-xl font-black uppercase text-[10px] shadow-xl">
                       <Star size={14} className="inline mr-2"/> Deixar Avaliação
                    </button>
                 </div>
              </div>
           </div>

           <div className={`rounded-[2rem] p-8 mb-10 ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-white/5'}`}>
              <h3 className={`text-lg font-black font-display italic mb-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Nossos Barbeiros</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {professionals.map(prof => {
                    const isLiked = loggedClient.likedProfessionals?.includes(prof.id);
                    return (
                      <div key={prof.id} className={`rounded-2xl p-4 text-center space-y-3 transition-all ${theme === 'light' ? 'bg-zinc-50 border border-zinc-200' : 'bg-white/5 border border-white/10'}`}>
                         <div className="relative mx-auto w-24 h-28 flex items-center justify-center">
                            <img 
                              src={prof.avatar} 
                              className="w-full h-full rounded-xl object-cover object-top border-2 border-[#B8860B] cursor-pointer" 
                              alt="" 
                              onClick={() => { setSelectedProfessional(prof); setShowProfessionalModal(true); }}
                            />
                            <div className="absolute -right-8 top-0.5 text-red-500 text-[8px] font-black flex items-center gap-0.5 whitespace-nowrap">
                               <Heart size={8} fill="currentColor"/> <span className="text-red-500">{prof.likes || 0}</span>
                            </div>
                         </div>
                         <div>
                            <p className={`font-bold text-sm ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{prof.name}</p>
                            <p className={`text-[8px] uppercase tracking-widest font-black mt-1 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-600'}`}>{prof.specialty}</p>
                         </div>
                         <button 
                           onClick={() => handleLikeProfessional(prof.id)} 
                           disabled={isLiked}
                           className={`w-full py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                             isLiked 
                               ? 'bg-emerald-500 text-white cursor-not-allowed' 
                               : 'gradiente-ouro text-black hover:scale-105'
                           }`}
                         >
                            {isLiked ? (
                              <><Check size={10} className="inline mr-1"/> Curtido</>
                            ) : (
                              <><Heart size={10} className="inline mr-1"/> Curtir</>
                            )}
                         </button>
                      </div>
                    );
                 })}
              </div>
           </div>

           <div className={`rounded-[2rem] p-8 ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-white/5'}`}>
              <h3 className={`text-lg font-black font-display italic mb-6 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Meus Agendamentos</h3>
              <div className="space-y-4">
                 {appointments.filter(a => a.clientPhone === loggedClient.phone).length === 0 && (
                    <p className={`text-center py-10 italic ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-600'}`}>Nenhum agendamento ainda.</p>
                 )}
                 {appointments.filter(a => a.clientPhone === loggedClient.phone).map(app => (
                    <div key={app.id} className={`flex items-center justify-between p-5 rounded-2xl transition-all ${theme === 'light' ? 'bg-zinc-50 border border-zinc-200' : 'bg-white/5 border border-white/5'}`}>
                       <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${app.status === 'CONCLUIDO_PAGO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>
                             {app.status === 'CONCLUIDO_PAGO' ? <Check size={20}/> : <Calendar size={20}/>}
                          </div>
                          <div>
                             <p className={`text-lg font-black italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{app.serviceName}</p>
                             <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}`}>{new Date(app.date).toLocaleDateString('pt-BR')} • {app.startTime} com {app.professionalName}</p>
                          </div>
                       </div>
                       <div className={`px-4 py-2 rounded-full text-[8px] font-black uppercase ${app.status === 'CONCLUIDO_PAGO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>
                          {app.status.replace('_', ' ')}
                       </div>
                    </div>
                 ))}
              </div>

              {/* ── INDIQUE E GANHE ── */}
              <div className={`rounded-[2rem] p-6 border mt-6 ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-white/5'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`font-black font-display italic text-lg ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>🎁 Indique e Ganhe!</h3>
                    <p className={`text-[10px] mt-1 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Ganhe <strong className="text-[#C58A4A]">R$ {(config as any).referralRewardAmount ?? 5}</strong> por cada amigo que cortar aqui. A cada <strong className="text-[#C58A4A]">{(config as any).referralFreeCutThreshold ?? 3} indicações</strong> validadas: 1 corte grátis!
                    </p>
                  </div>
                  <button onClick={() => setShowReferralModal(true)} className="gradiente-ouro text-black px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shrink-0 ml-3">
                    Indicar Amigo
                  </button>
                </div>

                {/* Progresso de indicações */}
                {(() => {
                  const myRefs = (referrals || []).filter((r: any) => r.referrerId === loggedClient.id);
                  const validated = myRefs.filter((r: any) => r.status === 'VALIDADO').length;
                  const pending = myRefs.filter((r: any) => r.status === 'PENDENTE').length;
                  const threshold = (config as any).referralFreeCutThreshold ?? 3;
                  const progress = validated % threshold;
                  return (
                    <div className="space-y-3">
                      <div className="flex justify-between text-[9px] font-black uppercase">
                        <span className={theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}>✅ {validated} validadas · ⏳ {pending} pendentes</span>
                        <span className="text-[#C58A4A]">{progress}/{threshold} para corte grátis</span>
                      </div>
                      <div className={`w-full h-2 rounded-full ${theme === 'light' ? 'bg-zinc-200' : 'bg-white/10'}`}>
                        <div className="h-full rounded-full gradiente-ouro transition-all" style={{width: `${(progress/threshold)*100}%`}}/>
                      </div>
                      {myRefs.length > 0 && (
                        <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                          {myRefs.map((r: any) => (
                            <div key={r.id} className={`flex items-center justify-between p-2.5 rounded-xl ${theme === 'light' ? 'bg-zinc-50' : 'bg-white/5'}`}>
                              <span className={`text-[10px] font-bold ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>👤 {r.referredName}</span>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${r.status === 'VALIDADO' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'CANCELADO' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {r.status === 'VALIDADO' ? `✓ +R$ ${r.rewardAmount}` : r.status === 'CANCELADO' ? 'Cancelada' : 'Aguardando'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Link/QR de indicação */}
                <div className={`mt-4 p-4 rounded-2xl border space-y-3 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Seu link de indicação</p>
                  <div className="flex gap-2">
                    <input readOnly value={referralLink} className={`flex-1 text-[10px] p-2.5 rounded-xl border truncate ${theme === 'light' ? 'bg-white border-zinc-300 text-zinc-700' : 'bg-black/30 border-white/10 text-zinc-300'}`}/>
                    <button onClick={() => { navigator.clipboard?.writeText(referralLink); alert('Link copiado!'); }} className="p-2.5 gradiente-ouro text-black rounded-xl">
                      <Copy size={14}/>
                    </button>
                  </div>
                  {referralQrUrl && (
                    <div className="flex justify-center">
                      <img src={referralQrUrl} alt="QR Code" className="w-28 h-28 rounded-xl"/>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RANKING TOP 20 (posição do cliente) ── */}
              <div className={`rounded-[2rem] p-6 border mt-6 ${theme === 'light' ? 'bg-white border-zinc-200' : 'cartao-vidro border-white/5'}`}>
                <h3 className={`font-black font-display italic text-lg mb-1 flex items-center gap-2 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                  <Trophy size={18} className="text-[#C58A4A]"/> Ranking de Clientes
                </h3>
                <p className={`text-[10px] mb-4 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Top 20 · Sua posição destacada</p>
                <div className="space-y-2">
                  {clientRanking.map((cl: any, idx: number) => {
                    const isMe = cl.id === loggedClient.id;
                    const tier = idx === 0 ? { badge: '👑', label: 'PREMIUM BLACK' }
                      : idx === 1 ? { badge: '🥈', label: 'OURO' }
                      : idx === 2 ? { badge: '🥉', label: 'PRATA' }
                      : { badge: `${idx+1}`, label: '' };
                    return (
                      <div key={cl.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe ? 'border-[#C58A4A]/50 bg-[#C58A4A]/10' : (theme === 'light' ? 'border-zinc-100 bg-zinc-50' : 'border-white/5 bg-white/5')}`}>
                        <span className="text-base w-8 text-center shrink-0">{tier.badge}</span>
                        <div className="flex-1 min-w-0">
                          <span className={`text-[11px] font-black truncate block ${isMe ? 'text-[#C58A4A]' : (theme === 'light' ? 'text-zinc-900' : 'text-white')}`}>
                            {cl.name} {isMe ? '← você' : ''}
                          </span>
                          <span className={`text-[9px] ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>✂️ {cl.totalCuts} · 👥 {cl.totalReferrals}</span>
                        </div>
                        {tier.label && <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full border ${idx === 0 ? 'border-zinc-600 bg-black text-white' : idx === 1 ? 'border-[#C58A4A] bg-[#C58A4A]/20 text-[#C58A4A]' : 'border-zinc-400 bg-zinc-400/20 text-zinc-400'}`}>{tier.label}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

           </div>
        </div>
      )}

      {view === 'BOOKING' && (
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-3 sm:px-6 pb-20 pt-4 sm:pt-6 animate-in fade-in">
           <header className="flex items-center gap-4 mb-10">
             <button onClick={() => { setView('HOME'); setShowQuickClient(false); setClientVerified(false); setLookupInput(''); setLookupError(null); setLookupClientFound(null); setLookupPassword(''); setLookupPasswordError(null); setLookupClientFound(null); setLookupPassword(''); setLookupPasswordError(null); }} className={`p-3 rounded-xl border transition-all ${theme === 'light' ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-50' : 'border-white/10 text-zinc-400 hover:bg-white/5'}`}><ChevronLeft size={24}/></button>
             <h2 className={`text-3xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Reservar Serviço</h2>
           </header>
           
           <div className={`rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 md:p-12 shadow-2xl flex flex-col gap-10 ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-[#C58A4A]/10'}`}>
              {passo === 1 && (
                <div className="space-y-8 animate-in slide-in-from-right-2 text-center">
                  <h3 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Você Tem Cadastro?</h3>
                  <div className="flex flex-col sm:flex-row gap-4 max-w-sm mx-auto w-full">
                    <button onClick={() => setPasso(2)} className="flex-1 gradiente-ouro text-black py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-105 transition-all">SIM, TENHO CADASTRO</button>
                    <button onClick={() => setShowQuickClient(true)} className={`flex-1 border py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 hover:bg-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>NÃO, CRIAR CONTA</button>
                  </div>
                </div>
              )}

              {passo === 2 && (() => {
                const masterList  = professionals.filter(p => p.isMaster);
                const regularList = professionals.filter(p => !p.isMaster);
                const selServ     = services.find(s => s.id === selecao.serviceId);

                const ProfBtn: React.FC<{ p: typeof professionals[0] }> = ({ p }) => {
                  const finalPrice = selServ
                    ? (selServ.price + (p.isMaster && p.masterSurcharge ? p.masterSurcharge : 0))
                    : null;
                  return (
                    <button
                      onClick={() => { setSelecao({ ...selecao, professionalId: p.id }); setPasso(3); }}
                      className={`p-5 rounded-[2rem] border transition-all flex flex-col items-center gap-3 group relative overflow-hidden ${
                        p.isMaster
                          ? theme === 'light'
                            ? 'bg-gradient-to-br from-amber-50 to-white border-[#C58A4A]/50 hover:border-[#C58A4A] shadow-md shadow-[#C58A4A]/10'
                            : 'bg-gradient-to-br from-[#C58A4A]/10 to-transparent border-[#C58A4A]/40 hover:border-[#C58A4A] shadow-lg shadow-[#C58A4A]/10'
                          : theme === 'light'
                            ? 'bg-zinc-50 border-zinc-200 hover:border-[#C58A4A]/50'
                            : 'bg-white/5 border-white/5 hover:border-[#C58A4A]'
                      }`}
                    >
                      {/* Faixa dourada topo Master */}
                      {p.isMaster && (
                        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-[#8B5E2A] via-[#C58A4A] to-[#E8B97A]" />
                      )}

                      <div className="relative mt-1">
                        <img
                          src={p.avatar}
                          className={`w-20 h-20 rounded-2xl object-cover transition-all ${
                            p.isMaster
                              ? 'border-2 border-[#C58A4A] group-hover:border-[#E8B97A]'
                              : 'border-2 border-white/10 group-hover:border-[#C58A4A]'
                          }`}
                          alt=""
                        />
                        {p.isMaster ? (
                          <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-[#8B5E2A] to-[#E8B97A] text-black p-1.5 rounded-lg shadow-lg">
                            <Crown size={10} />
                          </div>
                        ) : (
                          <div className="absolute -bottom-2 -right-2 bg-[#C58A4A] text-black text-[8px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                            <Heart size={8} fill="currentColor" /> {p.likes || 0}
                          </div>
                        )}
                      </div>

                      <div className="text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <span className={`text-[11px] font-black uppercase group-hover:text-[#C58A4A] transition-colors ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                            {p.name}
                          </span>
                          {p.isMaster && (
                            <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-[#8B5E2A] to-[#C58A4A] text-black text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full">
                              <Crown size={6} /> Master
                            </span>
                          )}
                        </div>

                        {/* Preço final com acréscimo Master */}
                        {finalPrice !== null && (
                          <div className="space-y-0.5">
                            <p className={`text-[10px] font-black ${p.isMaster ? 'text-[#C58A4A]' : theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                              R$ {finalPrice.toFixed(2)}
                            </p>
                            {p.isMaster && p.masterSurcharge && p.masterSurcharge > 0 && (
                              <p className={`text-[8px] font-bold ${theme === 'light' ? 'text-[#8B5E2A]' : 'text-[#C58A4A]/70'}`}>
                                + R$ {p.masterSurcharge.toFixed(2)} Master
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                };

                return (
                  <div className="space-y-8 animate-in slide-in-from-right-2 text-center">
                    <h3 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Escolha o Artífice</h3>

                    {/* Masters primeiro */}
                    {masterList.length > 0 && (
                      <div className="space-y-3 text-left">
                        <div className="flex items-center gap-2">
                          <Crown size={12} className="text-[#C58A4A]" />
                          <span className={`text-[8px] font-black uppercase tracking-[0.25em] ${theme === 'light' ? 'text-[#8B5E2A]' : 'text-[#C58A4A]'}`}>Barbeiro Master</span>
                          <div className="h-px flex-1 bg-gradient-to-r from-[#C58A4A]/40 to-transparent" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {masterList.map(p => <ProfBtn key={p.id} p={p} />)}
                        </div>
                      </div>
                    )}

                    {/* Regulares */}
                    {regularList.length > 0 && (
                      <div className="space-y-3 text-left">
                        {masterList.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-black uppercase tracking-[0.25em] ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>Equipe</span>
                            <div className={`h-px flex-1 ${theme === 'light' ? 'bg-zinc-200' : 'bg-white/5'}`} />
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {regularList.map(p => <ProfBtn key={p.id} p={p} />)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {passo === 3 && (
                <div className="space-y-8 animate-in slide-in-from-right-2">
                  <div className="text-center space-y-2"><h3 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Data e Horário</h3></div>
                  {bookingError && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-[10px] font-black uppercase text-center">{bookingError}</div>}
                  <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
                     {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(i => {
                       const d = new Date();
                       d.setDate(d.getDate() + i);
                       const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                       const selProf = professionals.find((p: any) => p.id === selecao.professionalId);
                       const dow = d.getDay();
                       // Folga semanal (weekSchedule)
                       const ws = (selProf as any)?.weekSchedule;
                       const isWeeklyOff = ws ? !ws[dow]?.active : false;
                       // Folga pontual do mês (offDays)
                       const offDays: string[] = (selProf as any)?.offDays || [];
                       const isDayOff = isWeeklyOff || offDays.includes(dateStr);
                       return (
                         <button
                           key={i}
                           disabled={isDayOff}
                           onClick={() => { if (!isDayOff) { setSelecao({...selecao, date: dateStr}); setBookingError(null); } }}
                           title={isDayOff ? (isWeeklyOff ? 'Folga semanal' : 'Folga especial') : undefined}
                           className={`snap-center flex-shrink-0 w-24 h-28 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 relative
                             ${isDayOff
                               ? 'opacity-40 cursor-not-allowed border-dashed ' + (theme === 'light' ? 'bg-zinc-100 border-zinc-300 text-zinc-400' : 'bg-white/[0.02] border-white/10 text-zinc-600')
                               : selecao.date === dateStr
                                 ? 'bg-[#C58A4A] text-black border-transparent scale-105 shadow-xl'
                                 : theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-400' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20'
                             }`}
                         >
                            <span className="text-[8px] font-black uppercase opacity-60">{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                            <span className="text-2xl font-black font-display">{d.getDate()}</span>
                            {isDayOff && (
                              <span className="text-[7px] font-black uppercase tracking-widest text-red-400 mt-0.5">Folga</span>
                            )}
                         </button>
                       );
                     })}
                  </div>
                  {selecao.date && (
                    <div className="space-y-6">
                      {(Object.entries(turnos) as [string, string[]][]).map(([turno, horarios]) => (
                        <div key={turno} className="space-y-4">
                          <h4 className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-4 ${theme === 'light' ? 'text-blue-600' : 'text-[#C58A4A]'}`}>{turno === 'manha' ? 'Manhã' : turno === 'tarde' ? 'Tarde' : 'Noite'} <div className={`h-px flex-1 ${theme === 'light' ? 'bg-zinc-200' : 'bg-white/5'}`}></div></h4>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {horarios.map(t => {
                               const isOccupied = checkAvailability(selecao.date, t, selecao.professionalId);
                               return (
                                 <button key={t} disabled={isOccupied} onClick={() => { setSelecao({...selecao, time: t}); setPasso(4); }} className={`py-3 rounded-xl border text-[10px] font-black transition-all ${isOccupied ? 'border-red-500/20 text-red-500/30 cursor-not-allowed bg-red-500/5' : selecao.time === t ? 'bg-[#C58A4A] text-black border-transparent shadow-lg' : theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-blue-400' : 'bg-white/5 border-white/5 text-zinc-400 hover:border-[#C58A4A]/50'}`}>
                                    {t}
                                 </button>
                               );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {passo === 4 && (
                <div className="space-y-6 animate-in slide-in-from-right-2 text-center">
                  <h3 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Sua Identificação</h3>
                  
                  {!clientVerified ? (
                    <div className="space-y-4 w-full max-w-sm mx-auto">

                      {/* STEP 1: buscar por email/celular */}
                      {!lookupClientFound ? (
                        <>
                          <p className={`text-xs font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                            Informe seu celular ou e-mail cadastrado
                          </p>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C58A4A]" size={18}/>
                            <input 
                              type="text" 
                              placeholder="Celular ou E-mail" 
                              value={lookupInput} 
                              onChange={e => { setLookupInput(e.target.value); setLookupError(null); }}
                              onKeyDown={e => e.key === 'Enter' && handleLookupClient()}
                              className={`w-full border p-4 pl-12 rounded-2xl text-xs font-bold outline-none transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} 
                            />
                          </div>
                          {lookupError && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-3">
                              <p className="text-red-500 text-xs font-black">{lookupError}</p>
                              <button 
                                onClick={() => { setView('LOGIN'); setLoginMode('register'); }} 
                                className="w-full gradiente-ouro text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest"
                              >
                                Criar Conta no Portal
                              </button>
                            </div>
                          )}
                          <button 
                            onClick={handleLookupClient} 
                            className="w-full gradiente-ouro text-black py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all"
                          >
                            Continuar
                          </button>
                          {!lookupError && (
                            <button 
                              onClick={() => { setView('LOGIN'); setLoginMode('register'); }} 
                              className={`w-full text-[10px] font-black uppercase tracking-widest underline transition-all py-2 ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-600 hover:text-[#C58A4A]'}`}
                            >
                              Não tenho cadastro — Criar Conta
                            </button>
                          )}
                        </>
                      ) : (
                        /* STEP 2: confirmar com senha */
                        <>
                          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-left ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
                            <div className="w-10 h-10 rounded-xl bg-[#C58A4A]/20 flex items-center justify-center flex-shrink-0">
                              <User size={18} className="text-[#C58A4A]"/>
                            </div>
                            <div className="text-left min-w-0">
                              <p className={`font-black text-sm truncate ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{lookupClientFound.name}</p>
                              <p className="text-zinc-500 text-[10px]">{lookupClientFound.phone}</p>
                            </div>
                          </div>
                          <p className={`text-xs font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                            {lookupClientFound.password ? 'Digite sua senha para confirmar' : '🔑 Primeiro acesso — crie sua senha'}
                          </p>
                          {!lookupClientFound.password && (
                            <p className="text-[10px] text-amber-400 font-bold text-center">
                              Sua conta foi criada pela barbearia. Defina uma senha de acesso agora.
                            </p>
                          )}
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C58A4A]" size={18}/>
                            <input 
                              type="password" 
                              placeholder={lookupClientFound.password ? "Senha" : "Crie uma senha (mín. 4 caracteres)"} 
                              value={lookupPassword} 
                              onChange={e => { setLookupPassword(e.target.value); setLookupPasswordError(null); }}
                              onKeyDown={e => e.key === 'Enter' && handleVerifyPassword()}
                              autoFocus
                              className={`w-full border p-4 pl-12 rounded-2xl text-xs font-bold outline-none transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} 
                            />
                          </div>
                          {lookupPasswordError && (
                            <p className="text-red-500 text-xs font-black text-center">{lookupPasswordError}</p>
                          )}
                          <button 
                            onClick={handleVerifyPassword} 
                            className="w-full gradiente-ouro text-black py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all"
                          >
                            Confirmar Identidade
                          </button>
                          <button 
                            onClick={() => { setLookupClientFound(null); setLookupPassword(''); setLookupPasswordError(null); }}
                            className={`w-full text-[10px] font-black uppercase tracking-widest underline transition-all py-2 ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-600 hover:text-[#C58A4A]'}`}
                          >
                            Voltar
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-5 w-full max-w-sm mx-auto">
                      <div className={`p-5 sm:p-6 rounded-2xl border ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                        <CheckCircle2 className="text-emerald-500 mx-auto mb-3" size={40}/>
                        <p className={`font-black text-xl font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{selecao.clientName}</p>
                        <p className="text-zinc-500 text-xs mt-1">{selecao.clientPhone}</p>
                        {selecao.clientEmail && <p className="text-zinc-500 text-xs">{selecao.clientEmail}</p>}
                      </div>
                      {bookingError && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-[10px] font-black uppercase text-center">{bookingError}</div>}
                      
                      {/* Opção de pagamento antecipado */}
                      {(config as any).asaasKey && (
                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
                          <p className={`text-[9px] font-black uppercase tracking-widest mb-3 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>💳 Deseja pagar agora?</p>
                          <div className="flex gap-2">
                            <button onClick={() => setWantsPayNow(false)}
                              className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase border transition-all ${!wantsPayNow ? 'gradiente-ouro text-black border-transparent' : theme === 'light' ? 'bg-white border-zinc-200 text-zinc-500' : 'bg-white/5 border-white/10 text-zinc-500'}`}>
                              Pagar na barbearia
                            </button>
                            <button onClick={() => setWantsPayNow(true)}
                              className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase border transition-all ${wantsPayNow ? 'gradiente-ouro text-black border-transparent' : theme === 'light' ? 'bg-white border-zinc-200 text-zinc-500' : 'bg-white/5 border-white/10 text-zinc-500'}`}>
                              ⚡ Pagar online
                            </button>
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={handleConfirmBooking} 
                        disabled={loading} 
                        className="w-full gradiente-ouro text-black py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-60"
                      >
                        {loading ? 'Processando...' : wantsPayNow ? '⚡ Confirmar e Pagar' : 'Confirmar Serviço'}
                      </button>
                      <button 
                        onClick={() => { setClientVerified(false); setLookupInput(''); setLookupError(null); setLookupClientFound(null); setLookupPassword(''); setLookupPasswordError(null); }} 
                        className={`w-full text-[10px] font-black uppercase tracking-widest underline transition-all py-2 ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-600 hover:text-[#C58A4A]'}`}
                      >
                        Trocar identificação
                      </button>
                    </div>
                  )}
               </div>
              )}
           </div>
        </div>
      )}

      {showQuickClient && (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in-95 ${theme === 'light' ? 'bg-black/70' : 'bg-black/95'}`}>
           <div className={`w-full max-w-md rounded-[3rem] p-12 space-y-8 shadow-2xl ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-[#C58A4A]/30'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>RÁPIDO: NOVO CLIENTE</h2>
                <button onClick={() => setShowQuickClient(false)} className={`p-2 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-zinc-100' : 'hover:bg-white/10'}`}><X size={20} className={theme === 'light' ? 'text-zinc-900' : 'text-white'}/></button>
              </div>
              
              {quickClientError && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-[10px] font-black uppercase text-center">{quickClientError}</div>}
              
              <div className="space-y-4">
                 <input type="text" placeholder="Nome Completo" value={quickClient.name} onChange={e => setQuickClient({...quickClient, name: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                 <input type="tel" placeholder="WhatsApp" value={quickClient.phone} onChange={e => setQuickClient({...quickClient, phone: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
                 <input type="email" placeholder="E-mail" value={quickClient.email} onChange={e => setQuickClient({...quickClient, email: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-bold transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`} />
              </div>
              
              <div className="flex gap-4">
                 <button onClick={() => setShowQuickClient(false)} className={`flex-1 py-5 rounded-xl text-[10px] font-black uppercase transition-all ${theme === 'light' ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}>Cancelar</button>
                 <button onClick={handleQuickClientCreate} disabled={loading} className="flex-1 gradiente-ouro text-black py-5 rounded-xl text-[10px] font-black uppercase shadow-xl hover:scale-105 transition-all">{loading ? 'Criando...' : 'Criar e Continuar'}</button>
              </div>
           </div>
        </div>
      )}

      {showReviewModal && (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in-95 ${theme === 'light' ? 'bg-black/70' : 'bg-black/95'}`}>
           <div className={`w-full max-w-md rounded-[3rem] p-12 space-y-8 shadow-2xl ${theme === 'light' ? 'bg-white border border-zinc-200' : 'cartao-vidro border-[#C58A4A]/30'}`}>
              <div className="text-center space-y-4">
                 <MessageSquare className="w-12 h-12 text-[#C58A4A] mx-auto"/>
                 <h2 className={`text-3xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Sua Experiência</h2>
              </div>
              <div className="space-y-8 text-center">
                 <div className="flex justify-center gap-3">
                    {[1,2,3,4,5].map(star => (
                       <button key={star} onClick={() => setNewReview({...newReview, rating: star})} className={`transition-all ${newReview.rating >= star ? 'text-[#C58A4A] scale-125' : theme === 'light' ? 'text-zinc-300' : 'text-zinc-800'}`}>
                          <Star size={32} fill={newReview.rating >= star ? 'currentColor' : 'none'}/>
                       </button>
                    ))}
                 </div>
                 <textarea rows={4} placeholder="Conte-nos como foi..." value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} className={`w-full border p-5 rounded-2xl outline-none font-medium transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}/>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowReviewModal(false)} className={`flex-1 py-5 rounded-xl text-[10px] font-black uppercase ${theme === 'light' ? 'bg-zinc-100 text-zinc-700' : 'bg-white/5 text-zinc-500'}`}>Voltar</button>
                 <button onClick={handleAddReview} className="flex-1 gradiente-ouro text-black py-5 rounded-xl text-[10px] font-black uppercase shadow-xl">Enviar</button>
              </div>
           </div>
        </div>
      )}

      {showProfessionalModal && selectedProfessional && (
        <div className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-xl animate-in fade-in ${theme === 'light' ? 'bg-black/70' : 'bg-black/95'}`} onClick={() => setShowProfessionalModal(false)}>
           <div
             className={`w-full sm:max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] ${theme === 'light' ? 'bg-white' : 'bg-[#0a0a0a]'}`}
             onClick={e => e.stopPropagation()}
           >
              {/* ── Foto inteira no topo ── */}
              <div className="relative flex-shrink-0">
                <img
                  src={selectedProfessional.avatar}
                  className="w-full h-auto object-contain block rounded-t-[3rem] sm:rounded-t-[3rem]"
                  style={{ maxHeight: '55vh' }}
                  alt={selectedProfessional.name}
                />
                {/* Gradiente sobre a foto */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none rounded-t-[3rem]" />
                {/* Botão fechar */}
                <button
                  onClick={() => setShowProfessionalModal(false)}
                  className="absolute top-4 right-4 p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-all z-10"
                >
                  <X size={20} />
                </button>
                {/* Nome sobre a foto */}
                <div className="absolute bottom-4 left-6 right-6 z-10">
                  <h2 className="text-3xl font-black font-display italic text-white mb-1 drop-shadow-lg">{selectedProfessional.name}</h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[#C58A4A]">
                      <Heart size={13} fill="currentColor" />
                      <span className="text-xs font-black">{selectedProfessional.likes || 0} curtidas</span>
                    </div>
                    {selectedProfessional.workingHours && (
                      <span className="text-white/70 text-[10px] font-black uppercase tracking-widest">
                        {selectedProfessional.workingHours.start} - {selectedProfessional.workingHours.end}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Descrição rolável abaixo da foto ── */}
              <div className="overflow-y-auto scrollbar-hide flex-1 p-6 pt-5">
                {selectedProfessional.specialty && (
                  <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 ${theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-white/10 text-zinc-300'}`}>
                    {selectedProfessional.specialty}
                  </span>
                )}
                {selectedProfessional.description ? (
                  <>
                    <h3 className={`text-base font-black font-display italic mb-3 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>História</h3>
                    <p className={`text-sm leading-relaxed whitespace-pre-line ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>
                      {selectedProfessional.description}
                    </p>
                  </>
                ) : (
                  <p className={`text-sm italic text-center py-4 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    Este profissional ainda não compartilhou sua história.
                  </p>
                )}
                <button
                  onClick={() => setShowProfessionalModal(false)}
                  onTouchEnd={e => { e.preventDefault(); setShowProfessionalModal(false); }}
                  className="w-full mt-6 mb-2 gradiente-ouro text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl"
                >
                  Fechar
                </button>
              </div>
           </div>
        </div>
      )}

      {/* ── MODAL: Registrar Indicação ── */}
      {showReferralModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className={`w-full max-w-md rounded-[2.5rem] p-8 border shadow-2xl space-y-6 ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-[#0f0f0f] border-white/10'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A] mb-1">Indique e Ganhe</p>
                <h2 className={`text-xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Indicar um Amigo</h2>
              </div>
              <button onClick={() => { setShowReferralModal(false); setReferralDone(false); }} className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white"><X size={18}/></button>
            </div>

            {referralDone ? (
              <div className="text-center py-6 space-y-3">
                <div className="text-5xl">🎉</div>
                <p className={`font-black text-lg ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Indicação registrada!</p>
                <p className={`text-sm ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Quando seu amigo concluir o primeiro corte, você recebe <strong className="text-[#C58A4A]">R$ {(config as any).referralRewardAmount ?? 5}</strong> na carteira! 💰
                </p>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-[60vh] scrollbar-hide pr-1">
                <div className={`p-4 rounded-2xl ${theme === 'light' ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                  <p className={`text-[10px] font-bold leading-relaxed ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    ✅ <strong>Validação automática!</strong> Quando seu amigo concluir o primeiro corte aqui, você recebe <strong>R$ {(config as any).referralRewardAmount ?? 5}</strong> automaticamente — sem precisar fazer nada! ✂️
                  </p>
                </div>

                {/* ── Dados do amigo ── */}
                <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A]">Dados do Amigo</p>

                <div className="space-y-2">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Nome Completo <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="Nome completo"
                    value={referralName} onChange={e => setReferralName(e.target.value)}
                    className={`w-full border p-4 rounded-xl outline-none font-bold text-sm transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>WhatsApp <span className="text-red-400">*</span></label>
                  <input type="tel" placeholder="(21) 99999-9999"
                    value={referralPhone} onChange={e => setReferralPhone(e.target.value)}
                    className={`w-full border p-4 rounded-xl outline-none font-bold text-sm transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>E-mail</label>
                  <input type="email" placeholder="email@exemplo.com"
                    value={referralEmail} onChange={e => setReferralEmail(e.target.value)}
                    className={`w-full border p-4 rounded-xl outline-none font-bold text-sm transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>CPF</label>
                    <input type="text" placeholder="000.000.000-00"
                      value={referralCpf} onChange={e => setReferralCpf(e.target.value)}
                      className={`w-full border p-4 rounded-xl outline-none font-bold text-sm transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Nascimento</label>
                    <input type="date"
                      value={referralBirthdate} onChange={e => setReferralBirthdate(e.target.value)}
                      className={`w-full border p-4 rounded-xl outline-none font-bold text-sm transition-all ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#C58A4A]' : 'bg-white/5 border-white/10 text-white focus:border-[#C58A4A]'}`}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2 sticky bottom-0 pb-1">
                  <button onClick={() => setShowReferralModal(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[9px] ${theme === 'light' ? 'bg-zinc-100 text-zinc-500' : 'bg-white/5 text-zinc-500'}`}>Cancelar</button>
                  <button
                    onClick={handleCreateReferral}
                    disabled={referralSaving || !referralName.trim() || (!referralPhone.trim() && !referralEmail.trim())}
                    className="flex-1 gradiente-ouro text-black py-4 rounded-2xl font-black uppercase text-[9px] disabled:opacity-40"
                  >
                    {referralSaving ? '⟳ Cadastrando...' : '🎁 Indicar Agora'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {vipModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in-95">
          <div className={`w-full max-w-md rounded-[2.5rem] border shadow-2xl flex flex-col max-h-[90vh] ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-[#111] border-[#C58A4A]/30'}`}>
            <div className="flex items-center justify-between px-8 pt-8 pb-4 flex-shrink-0">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#C58A4A]">Assinar Plano</p>
                <h2 className={`text-2xl font-black font-display italic ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{vipModal.name}</h2>
                <p className="text-[#C58A4A] font-black text-lg">R$ {vipModal.price.toFixed(2)}<span className="text-zinc-500 text-sm font-bold">/{vipModal.period === 'MENSAL' ? 'mês' : vipModal.period === 'ANUAL' ? 'ano' : 'semana'}</span></p>
              </div>
              <button onClick={() => setVipModal(null)} className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto scrollbar-hide px-8 flex-1 space-y-4 pb-4">
              {vipPayLink !== null ? (
                <div className="space-y-4 text-center py-4">
                  <div className="text-4xl">✅</div>
                  <p className={`font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Assinatura criada!</p>
                  {vipPayLink ? (
                    <a href={vipPayLink} target="_blank" rel="noreferrer" className="block w-full gradiente-ouro text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-center">💳 Ir para pagamento</a>
                  ) : (
                    <p className="text-zinc-500 text-sm">Verifique o Asaas para o link de pagamento.</p>
                  )}
                  <button onClick={() => setVipModal(null)} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase border ${theme === 'light' ? 'border-zinc-200 text-zinc-500' : 'border-white/10 text-zinc-400'}`}>Fechar</button>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {!loggedClient && (
                    <>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>Seus dados</p>
                      <input type="text" placeholder="Nome completo" value={vipForm.name} onChange={e => setVipForm({...vipForm, name: e.target.value})} className={`w-full border p-4 rounded-xl text-sm font-bold outline-none ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-white/5 border-white/10 text-white'}`} />
                      <input type="tel" placeholder="WhatsApp (com DDD)" value={vipForm.phone} onChange={e => setVipForm({...vipForm, phone: e.target.value})} className={`w-full border p-4 rounded-xl text-sm font-bold outline-none ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-white/5 border-white/10 text-white'}`} />
                      <input type="text" placeholder="CPF (opcional)" value={vipForm.cpf} onChange={e => setVipForm({...vipForm, cpf: e.target.value})} className={`w-full border p-4 rounded-xl text-sm font-bold outline-none ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-white/5 border-white/10 text-white'}`} />
                    </>
                  )}
                  {loggedClient && (
                    <div className={`p-4 rounded-2xl ${theme === 'light' ? 'bg-zinc-50' : 'bg-white/5'}`}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Assinando como</p>
                      <p className={`font-black ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{loggedClient.name}</p>
                      <p className="text-zinc-500 text-xs">{loggedClient.phone}</p>
                    </div>
                  )}
                  {vipError && <p className="text-red-400 text-[10px] font-black text-center">{vipError}</p>}
                  <div className={`p-3 rounded-xl text-center ${theme === 'light' ? 'bg-zinc-50' : 'bg-white/5'}`}>
                    <p className={`text-[9px] font-black uppercase ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>💳 Você escolhe PIX, Cartão ou Boleto na próxima página</p>
                  </div>
                </div>
              )}
            </div>
            {vipPayLink === null && (
              <div className="px-8 py-6 flex-shrink-0">
                <button type="button" onClick={handleVipSubscribe} disabled={vipLoading}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full gradiente-ouro text-black py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl disabled:opacity-50">
                  {vipLoading ? '⏳ Processando...' : `⚡ Assinar ${vipModal.period === 'MENSAL' ? 'Mensal' : vipModal.period === 'ANUAL' ? 'Anual' : 'Semanal'}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicBooking;
