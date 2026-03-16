import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  Client, Professional, Service, Appointment, ShopConfig, User,
  FinancialEntry, Notification, Review, Suggestion,
  LoyaltyCard, Subscription, Partner, BlockedSlot, InactivityCampaign,
  ClientBenefit  // ── NOVO ──
} from './types';
import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// ── WhatsApp Cloud API ────────────────────────────────────────
import {
  wppConfirmacaoAgendamento,
  wppLembrete24h,
  wppLembrete1h,
  wppPosAtendimento,
  wppVencimentoVip3dias,
  wppNovaAssinaturaBarbearia,
  wppAssinaturaAtivada,
  wppAssinaturaVencendo,
  wppReagendamento,
  wppNovoAgendamento,
  wppLembreteAgendamento,
  wppLembrete15min,
} from './services/whatsapp';

interface BarberContextType {
  user: User | null;
  clients: Client[];
  professionals: Professional[];
  services: Service[];
  appointments: Appointment[];
  financialEntries: FinancialEntry[];
  notifications: Notification[];
  suggestions: Suggestion[];
  config: ShopConfig;
  loading: boolean;
  theme: 'dark' | 'light';
  loyaltyCards: LoyaltyCard[];
  subscriptions: Subscription[];
  partners: Partner[];
  blockedSlots: BlockedSlot[];
  inactivityCampaigns: InactivityCampaign[];
  clientBenefits: ClientBenefit[];  // ── NOVO ──
  toggleTheme: () => void;
  login: (emailOrPhone: string, pass: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  addClient: (data: Omit<Client, 'id' | 'totalSpent' | 'createdAt'>) => Promise<Client>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addService: (data: Omit<Service, 'id'>) => Promise<void>;
  updateService: (id: string, data: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  addProfessional: (data: Omit<Professional, 'id' | 'likes'>) => Promise<void>;
  updateProfessional: (id: string, data: Partial<Professional>) => Promise<void>;
  deleteProfessional: (id: string) => Promise<void>;
  likeProfessional: (id: string) => void;
  resetAllLikes: () => Promise<void>;
  addAppointment: (data: Omit<Appointment, 'id' | 'status'>, isPublic?: boolean) => Promise<void>;
  markNoShow: (appointmentId: string) => Promise<void>;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => Promise<void>;
  rescheduleAppointment: (id: string, date: string, startTime: string, endTime: string) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  addFinancialEntry: (data: Omit<FinancialEntry, 'id'>) => Promise<void>;
  deleteFinancialEntry: (id: string) => Promise<void>;
  addSuggestion: (data: Omit<Suggestion, 'id' | 'date'>) => Promise<void>;
  updateSuggestion: (id: string, data: Partial<Suggestion>) => Promise<void>;
  deleteSuggestion: (id: string) => Promise<void>;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  updateConfig: (data: Partial<ShopConfig>) => Promise<void>;
  addShopReview: (review: Omit<Review, 'id' | 'date'>) => void;
  addLoyaltyCard: (data: Omit<LoyaltyCard, 'id'>) => Promise<void>;
  updateLoyaltyCard: (clientId: string, data: Partial<LoyaltyCard>) => Promise<void>;
  addSubscription: (data: Omit<Subscription, 'id'>) => Promise<{ id: string; invoiceUrl: string }>;
  updateSubscription: (id: string, data: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  addPartner: (data: Omit<Partner, 'id'>) => Promise<void>;
  updatePartner: (id: string, data: Partial<Partner>) => Promise<void>;
  deletePartner: (id: string) => Promise<void>;
  addBlockedSlot: (data: Omit<BlockedSlot, 'id'>) => Promise<void>;
  deleteBlockedSlot: (id: string) => Promise<void>;
  addCampaign: (data: Omit<InactivityCampaign, 'id'>) => Promise<void>;
  updateCampaign: (id: string, data: Partial<InactivityCampaign>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  isSlotBlocked: (professionalId: string, date: string, time: string) => boolean;
  // ── NOVO: Clube de Benefícios ──────────────────────────────
  addClientBenefit: (data: Omit<ClientBenefit, 'id'>) => Promise<void>;
  updateClientBenefit: (id: string, data: Partial<ClientBenefit>) => Promise<void>;
  deleteClientBenefit: (id: string) => Promise<void>;
  generateBenefitQR: (benefitId: string, partnerId: string, partnerName: string) => Promise<string>;
  validateAndUseBenefit: (qrToken: string) => Promise<ClientBenefit | null>;
}

const BarberContext = createContext<BarberContextType | undefined>(undefined);

const COLLECTIONS = {
  CLIENTS: 'clients',
  PROFESSIONALS: 'professionals',
  SERVICES: 'services',
  APPOINTMENTS: 'appointments',
  FINANCIAL: 'financialEntries',
  CONFIG: 'config',
  NOTIFICATIONS: 'notifications',
  SUGGESTIONS: 'suggestions',
  LOYALTY_CARDS: 'loyaltyCards',
  SUBSCRIPTIONS: 'subscriptions',
  REFERRALS: 'referrals',
  PARTNERS: 'partners',
  BLOCKED_SLOTS: 'blockedSlots',
  INACTIVITY_CAMPAIGNS: 'inactivityCampaigns',
  CLIENT_BENEFITS: 'clientBenefits',  // ── NOVO ──
  PRODUCTS: 'products',
};

// ── Gerador de token único para QR Code de benefício ─────────
const generateBenefitToken = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BNF-${timestamp}-${random}`;
};

// ── Helpers de data ───────────────────────────────────────────
/** Retorna data no formato YYYY-MM-DD para N dias à frente */
function datePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Chave usada no localStorage para controlar lembretes já enviados */
function reminderKey(type: string, id: string, date: string): string {
  return `wpp_reminder_${type}_${id}_${date}`;
}

export function BarberProvider({ children }: { children?: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('brb_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('brb_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [config, setConfig] = useState<ShopConfig>({
    name: "", description: "", aboutTitle: "", aboutText: "", address: "",
    city: "", state: "", whatsapp: "", instagram: "", logo: "", coverImage: "",
    loginBackground: "", locationUrl: "", openingTime: "08:00", closingTime: "20:00",
    email: "", cnpj: "", gallery: [], reviews: []
  });
  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCard[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inactivityCampaigns, setInactivityCampaigns] = useState<InactivityCampaign[]>([]);
  const [clientBenefits, setClientBenefits] = useState<ClientBenefit[]>([]);  // ── NOVO ──

  useEffect(() => { localStorage.setItem('brb_theme', theme); }, [theme]);
  useEffect(() => {
    if (user) localStorage.setItem('brb_user', JSON.stringify(user));
    else localStorage.removeItem('brb_user');
  }, [user]);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(collection(db, COLLECTIONS.CLIENTS), snap => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)))),
      onSnapshot(collection(db, COLLECTIONS.PROFESSIONALS), snap => setProfessionals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Professional)))),
      onSnapshot(collection(db, COLLECTIONS.SERVICES), snap => setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)))),
      onSnapshot(collection(db, COLLECTIONS.APPOINTMENTS), snap => setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))),
      onSnapshot(collection(db, COLLECTIONS.FINANCIAL), snap => setFinancialEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinancialEntry)))),
      onSnapshot(collection(db, COLLECTIONS.NOTIFICATIONS), snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)))),
      onSnapshot(collection(db, COLLECTIONS.SUGGESTIONS), snap => setSuggestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Suggestion)))),
      onSnapshot(collection(db, COLLECTIONS.LOYALTY_CARDS), snap => setLoyaltyCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as LoyaltyCard)))),
      onSnapshot(collection(db, COLLECTIONS.SUBSCRIPTIONS), snap => setSubscriptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subscription)))),
      onSnapshot(collection(db, COLLECTIONS.REFERRALS), snap => setReferrals(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, COLLECTIONS.PARTNERS), snap => setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Partner)))),
      onSnapshot(collection(db, COLLECTIONS.BLOCKED_SLOTS), snap => setBlockedSlots(snap.docs.map(d => ({ id: d.id, ...d.data() } as BlockedSlot)))),
      onSnapshot(collection(db, COLLECTIONS.INACTIVITY_CAMPAIGNS), snap => setInactivityCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as InactivityCampaign)))),
      onSnapshot(collection(db, 'staff'), snap => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, COLLECTIONS.PRODUCTS), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      // ── NOVO: Escuta em tempo real para benefícios ──
      onSnapshot(collection(db, COLLECTIONS.CLIENT_BENEFITS), snap => setClientBenefits(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientBenefit)))),
      onSnapshot(doc(db, COLLECTIONS.CONFIG, 'main'), docSnap => {
        if (docSnap.exists()) {
          const configData = docSnap.data() as ShopConfig;
          setConfig(configData);
          const savedUser = localStorage.getItem('brb_user');
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser.role === 'ADMIN' && configData.adminName) {
              const updatedUser = { ...parsedUser, name: configData.adminName, avatar: configData.logo };
              setUser(updatedUser);
              localStorage.setItem('brb_user', JSON.stringify(updatedUser));
            }
          }
        }
      })
    ];
    setLoading(false);
    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  // ── ─────────────────────────────────────────────────────────
  // CRON SIMULADO: roda uma vez por sessão quando os dados
  // já estiverem carregados (appointments e subscriptions prontos).
  // Envia lembretes de agendamento (amanhã) e assinaturas (3 dias).
  // Usa localStorage para não repetir o envio no mesmo dia.
  // ── ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (appointments.length === 0 && subscriptions.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const cronKey = `wpp_cron_${today}`;

    // Só roda uma vez por dia
    if (localStorage.getItem(cronKey)) return;
    localStorage.setItem(cronKey, '1');

    const tomorrow    = datePlusDays(1);
    const in3Days     = datePlusDays(3);

    // ── Lembretes de agendamento (amanhã) ──────────────────────
    const appointmentsTomorrow = appointments.filter(
      a => a.date === tomorrow && a.status === 'AGENDADO'
    );

    appointmentsTomorrow.forEach(async (a) => {
      const key = reminderKey('agendamento', a.id, tomorrow);
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');

      await wppLembreteAgendamento(
        a.clientPhone,
        a.clientName,
        a.serviceName,
        a.startTime,
        a.professionalName
      );
    });

    // ── Lembretes de assinatura vencendo em 3 dias ─────────────
    const subsExpiring = subscriptions.filter(
      s => s.endDate?.split('T')[0] === in3Days && s.status === 'ATIVA'
    );

    subsExpiring.forEach(async (s) => {
      const key = reminderKey('assinatura', s.id, in3Days);
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');

      // Busca o telefone do cliente
      const client = clients.find(c => c.id === s.clientId);
      const phone = client?.phone || '';
      if (!phone) return;

      await wppAssinaturaVencendo(
        phone,
        s.clientName,
        s.planName,
        3,
        s.endDate.split('T')[0]
      );
    });

  }, [loading, appointments, subscriptions, clients]);

  // ── ─────────────────────────────────────────────────────────
  // LEMBRETE 15 MIN: roda a cada 60 segundos e verifica se
  // algum agendamento de HOJE começa em ~15 minutos.
  // Usa localStorage para garantir envio único por agendamento.
  // ── ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || appointments.length === 0) return;

    const check = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Formata hora atual como "HH:MM"
      const nowHH = String(now.getHours()).padStart(2, '0');
      const nowMM = String(now.getMinutes()).padStart(2, '0');
      const nowTime = `${nowHH}:${nowMM}`;

      // Calcula o horário que será daqui a 15 minutos
      const in15 = new Date(now.getTime() + 15 * 60 * 1000);
      const in15HH = String(in15.getHours()).padStart(2, '0');
      const in15MM = String(in15.getMinutes()).padStart(2, '0');
      const targetTime = `${in15HH}:${in15MM}`;

      const candidates = appointments.filter(
        a =>
          a.date === todayStr &&
          a.startTime === targetTime &&
          (a.status === 'AGENDADO' || a.status === 'PENDENTE')
      );

      candidates.forEach(async (a) => {
        const key = `wpp_15min_${a.id}`;
        if (localStorage.getItem(key)) return; // já enviado
        localStorage.setItem(key, '1');

        await wppLembrete15min(
          a.clientPhone,
          a.clientName,
          a.serviceName,
          a.startTime,
          a.professionalName
        );
      });
    };

    // Roda imediatamente e depois a cada 60 segundos
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);

  }, [loading, appointments]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const login = async (id: string, pass: string) => {
    if (id === 'novojeitoadm@gmail.com' && pass === '654326') {
      const adminName = config.adminName || 'Novo Jeito';
      const adminAvatar = config.logo || 'https://i.pravatar.cc/150';
      setUser({ id: 'admin', name: adminName, email: id, role: 'ADMIN', avatar: adminAvatar });
      return;
    }
    // Check staff members
    const staffMember = staff.find((s: any) => s.email === id && s.password === pass && s.active !== false);
    if (staffMember) {
      setUser({ id: staffMember.id, name: staffMember.name, email: staffMember.email, role: staffMember.role, allowedPages: staffMember.allowedPages, defaultPage: staffMember.defaultPage, professionalId: staffMember.professionalId || null } as any);
      return;
    }
    const client = clients.find(c => (c.phone === id || c.email === id) && c.password === pass);
    if (client) {
      setUser({ id: client.id, name: client.name, email: client.email, role: 'CLIENTE', phone: client.phone });
    } else {
      throw new Error('Credenciais inválidas');
    }
  };

  const logout = () => setUser(null);

  // ── Staff CRUD ──────────────────────────────────────────────────────
  // ── Products CRUD ─────────────────────────────────────────────
  const addProduct = async (data: any) => {
    await addDoc(collection(db, COLLECTIONS.PRODUCTS), { ...data, createdAt: new Date().toISOString() });
  };
  const updateProduct = async (id: string, data: any) => {
    await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), data);
  };
  // ── REFERRAL (Indique e Ganhe) ──────────────────────────
  const createReferral = async (data: Omit<any,'id'>) => {
    await addDoc(collection(db, COLLECTIONS.REFERRALS), { ...data, createdAt: new Date().toISOString() });
  };

  const validateReferral = async (referralId: string) => {
    const ref = referrals.find((r: any) => r.id === referralId);
    if (!ref || ref.status === 'VALIDADO') return;
    
    const rewardAmount = ref.rewardAmount || (config as any).referralRewardAmount || 5;
    
    // Credita na carteira do indicador (loyalty credits)
    const loyaltySnap = await getDocs(collection(db, COLLECTIONS.LOYALTY_CARDS));
    const cardDoc = loyaltySnap.docs.find(d => d.data().clientId === ref.referrerId);
    if (cardDoc) {
      await updateDoc(doc(db, COLLECTIONS.LOYALTY_CARDS, cardDoc.id), {
        credits: parseFloat(((cardDoc.data().credits || 0) + rewardAmount).toFixed(2)),
        referralCount: (cardDoc.data().referralCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Cria cartela se não existir
      const referrer = clients.find((cl: any) => cl.id === ref.referrerId);
      if (referrer) {
        await addDoc(collection(db, COLLECTIONS.LOYALTY_CARDS), {
          clientId: ref.referrerId,
          clientName: referrer.name,
          stamps: 0,
          totalStamps: 0,
          credits: rewardAmount,
          referralCount: 1,
          freeCutsPending: 0,
          freeCutsEarned: 0,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Marca indicação como validada
    await updateDoc(doc(db, COLLECTIONS.REFERRALS, referralId), {
      status: 'VALIDADO',
      rewardCredited: true,
      validatedAt: new Date().toISOString(),
    });

    // Verifica se atingiu o limite de indicações para corte grátis
    const threshold = (config as any).referralFreeCutThreshold || 3;
    const validated = referrals.filter((r: any) => r.referrerId === ref.referrerId && r.status === 'VALIDADO').length + 1;
    if (validated % threshold === 0) {
      const loyaltySnap2 = await getDocs(collection(db, COLLECTIONS.LOYALTY_CARDS));
      const cardDoc2 = loyaltySnap2.docs.find(d => d.data().clientId === ref.referrerId);
      if (cardDoc2) {
        await updateDoc(doc(db, COLLECTIONS.LOYALTY_CARDS, cardDoc2.id), {
          freeCutsPending: (cardDoc2.data().freeCutsPending || 0) + 1,
          freeCutsEarned: (cardDoc2.data().freeCutsEarned || 0) + 1,
        });
      }
    }
  };

  const cancelReferral = async (referralId: string) => {
    await updateDoc(doc(db, COLLECTIONS.REFERRALS, referralId), { status: 'CANCELADO' });
  };

  const deleteProduct = async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id));
  };

  // ── Reduz estoque de um produto ao ser consumido ─────────
  const decreaseProductStock = async (productId: string, qty = 1) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product || product.stock === null || product.stock === undefined) return;
    const newStock = Math.max(0, (product.stock ?? 0) - qty);
    await updateDoc(doc(db, COLLECTIONS.PRODUCTS, productId), { stock: newStock });
  };

  const addStaff = async (data: any) => {
    const ref = await addDoc(collection(db, 'staff'), { ...data, createdAt: new Date().toISOString() });
    return ref.id;
  };
  const updateStaff = async (id: string, data: any) => {
    await updateDoc(doc(db, 'staff', id), data);
  };
  const deleteStaff = async (id: string) => {
    await deleteDoc(doc(db, 'staff', id));
  };

  const updateUser = (data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('brb_user', JSON.stringify(updated));
      return updated;
    });
  };

  // ── CLIENTS ──────────────────────────────────────────────────
  const addClient = async (data: any) => {
    const docRef = await addDoc(collection(db, COLLECTIONS.CLIENTS), { ...data, totalSpent: 0, createdAt: new Date().toISOString() });
    return { id: docRef.id, ...data } as Client;
  };
  const updateClient = async (id: string, data: any) => { await updateDoc(doc(db, COLLECTIONS.CLIENTS, id), data); };
  const deleteClient = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.CLIENTS, id)); };

  // ── SERVICES ─────────────────────────────────────────────────
  const addService = async (data: any) => { await addDoc(collection(db, COLLECTIONS.SERVICES), data); };
  const updateService = async (id: string, data: any) => { await updateDoc(doc(db, COLLECTIONS.SERVICES, id), data); };
  const deleteService = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.SERVICES, id)); };

  // ── PROFESSIONALS ─────────────────────────────────────────────
  const addProfessional = async (data: any) => { await addDoc(collection(db, COLLECTIONS.PROFESSIONALS), { ...data, likes: 0 }); };
  const updateProfessional = async (id: string, data: any) => { await updateDoc(doc(db, COLLECTIONS.PROFESSIONALS, id), data); };
  const deleteProfessional = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.PROFESSIONALS, id)); };
  const likeProfessional = async (id: string) => {
    const p = professionals.find(p => p.id === id);
    if (p) await updateDoc(doc(db, COLLECTIONS.PROFESSIONALS, id), { likes: (p.likes || 0) + 1 });
  };
  const resetAllLikes = async () => {
    await Promise.all(professionals.map(p => updateDoc(doc(db, COLLECTIONS.PROFESSIONALS, p.id), { likes: 0 })));
  };

  // ── APPOINTMENTS ─────────────────────────────────────────────
  const addAppointment = async (data: any, isPublic = false) => {
    // ── Verifica limite de cortes do plano VIP ──────────────────────────────
    if (data.clientId) {
      const clientSub = subscriptions.find((s: any) =>
        s.clientId === data.clientId && s.status === 'ATIVA'
      );
      if (clientSub) {
        const plan = ((config as any).vipPlans || []).find((p: any) => p.id === clientSub.planId);
        if (plan && plan.maxCuts) {
          const cutsUsed = clientSub.cutsThisPeriod || 0;
          if (cutsUsed >= plan.maxCuts) {
            throw new Error(`Limite de ${plan.maxCuts} cortes do plano "${plan.name}" atingido neste período. Próximo corte disponível na renovação.`);
          }
        }
      }
    }
    await addDoc(collection(db, COLLECTIONS.APPOINTMENTS), { ...data, status: 'PENDENTE' });

    if (isPublic) {
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        title: 'Novo Agendamento',
        message: `${data.clientName} agendou ${data.serviceName}`,
        time: new Date().toISOString(),
        read: false,
        type: 'appointment'
      });
    }

    // ── WhatsApp: confirmação de agendamento ──────────────────
    try {
      await wppNovoAgendamento(
        data.clientPhone,
        data.clientName,
        data.serviceName,
        data.date,
        data.startTime,
        data.professionalName
      );
    } catch (e) {
      console.warn('WhatsApp confirmação falhou (não crítico):', e);
    }
  };

  // ── LISTA NEGRA: marca cliente como não compareceu ────────
  const markNoShow = async (appointmentId: string) => {
    const appt = appointments.find(a => a.id === appointmentId);
    if (!appt) return;

    // 1. Marca o agendamento como NAO_COMPARECEU
    await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, appointmentId), {
      status: 'NAO_COMPARECEU',
    });

    // 2. Marca o cliente para exigir pagamento antecipado no próximo agendamento
    const clientDoc = clients.find(c => c.id === appt.clientId || c.phone === appt.clientPhone);
    if (clientDoc) {
      await updateDoc(doc(db, COLLECTIONS.CLIENTS, clientDoc.id), {
        requirePrepayment: true,
        noShowCount: ((clientDoc as any).noShowCount || 0) + 1,
        lastNoShowDate: new Date().toISOString(),
      });
    }
  };

  const updateAppointmentStatus = async (id: string, status: any) => {
    await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, id), { status });

    const appointment = appointments.find(a => a.id === id);

    // ── Voltar para PENDENTE: remove receita + estorna fidelidade ──
    if (status === 'PENDENTE') {
      // Remove entrada financeira vinculada
      const linkedEntry = financialEntries.find(e => e.appointmentId === id);
      if (linkedEntry) await deleteDoc(doc(db, COLLECTIONS.FINANCIAL, linkedEntry.id));

      // Estorna selos e cashback de fidelidade
      if (appointment) {
        const cashbackPct = (config as any).cashbackPercent ?? 5;
        const stampsLimit = (config as any).stampsForFreeCut ?? 10;
        const cashbackValue = parseFloat(((appointment.price * cashbackPct) / 100).toFixed(2));

        const loyaltySnapshot = await getDocs(collection(db, COLLECTIONS.LOYALTY_CARDS));
        const cardDoc = loyaltySnapshot.docs.find(d => d.data().clientId === appointment.clientId);

        if (cardDoc) {
          const card = cardDoc.data();
          const prevTotal = (card.totalStamps || 0) - 1;
          const gaveFreeCut = prevTotal > 0 && prevTotal % stampsLimit === 0;

          await updateDoc(doc(db, COLLECTIONS.LOYALTY_CARDS, cardDoc.id), {
            stamps: Math.max(0, (card.stamps || 0) - 1),
            totalStamps: Math.max(0, (card.totalStamps || 0) - 1),
            credits: Math.max(0, parseFloat(((card.credits || 0) - cashbackValue).toFixed(2))),
            freeCutsPending: gaveFreeCut ? Math.max(0, (card.freeCutsPending || 0) - 1) : (card.freeCutsPending || 0),
            freeCutsEarned: gaveFreeCut ? Math.max(0, (card.freeCutsEarned || 0) - 1) : (card.freeCutsEarned || 0),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // ── NOVO: Estorna benefício gerado (se não foi usado) ──
      if (appointment) {
        const benefitsSnap = await getDocs(collection(db, COLLECTIONS.CLIENT_BENEFITS));
        const benefitDoc = benefitsSnap.docs.find(d =>
          d.data().appointmentId === id &&
          (d.data().status === 'DISPONIVEL' || d.data().status === 'QR_GERADO')
        );
        if (benefitDoc) {
          await deleteDoc(doc(db, COLLECTIONS.CLIENT_BENEFITS, benefitDoc.id));
        }
      }
    }

    // ── Marcar como CONCLUIDO_PAGO: cria receita + aplica fidelidade + gera benefício ──
    if (status === 'CONCLUIDO_PAGO' && appointment) {
      const entryDescription = `Agendamento #${id.substring(0, 8)} - ${appointment.serviceName}`;
      const existingEntry = financialEntries.find(e => e.description === entryDescription);

      if (!existingEntry) {
        // ── Verifica se cliente tem assinatura ativa e calcula comissão ──
        const clientSub = subscriptions.find(
          s => s.clientId === appointment.clientId && s.status === 'ATIVA'
        );
        const activePlan = clientSub
          ? (config as any).vipPlans?.find((p: any) => p.id === clientSub.planId)
          : null;

        // Valor base para receita: se tem plano, usa valor por corte; caso contrário preço normal
        let revenueAmount = appointment.price;
        let commissionAmount: number | null = null;

        if (clientSub && activePlan && activePlan.maxCuts && activePlan.maxCuts > 0) {
          const pricePerCut = clientSub.price / activePlan.maxCuts;
          revenueAmount = pricePerCut;

          // Comissão do barbeiro: % configurada no profissional sobre o valor por corte
          const professional = professionals.find((p: any) => p.id === appointment.professionalId);
          if (professional && professional.commission > 0) {
            commissionAmount = parseFloat(((pricePerCut * professional.commission) / 100).toFixed(2));
          }
        }

        await addDoc(collection(db, COLLECTIONS.FINANCIAL), {
          description: entryDescription,
          amount: revenueAmount,
          type: 'RECEITA',
          category: clientSub ? `Plano VIP - ${clientSub.planName}` : 'Serviços',
          date: new Date().toISOString().split('T')[0],
          appointmentId: id,
          isSubscriptionService: !!clientSub,
          subscriptionId: clientSub?.id || null,
        });

        // Registra comissão do barbeiro separadamente
        if (commissionAmount !== null && commissionAmount > 0 && appointment.professionalId) {
          await addDoc(collection(db, COLLECTIONS.FINANCIAL), {
            description: `Comissão - ${appointment.serviceName} (${appointment.professionalName}) — Plano VIP`,
            amount: commissionAmount,
            type: 'DESPESA',
            category: 'Comissões',
            date: new Date().toISOString().split('T')[0],
            appointmentId: id,
            professionalId: appointment.professionalId,
          });
        }

        // ── Incrementa contador de cortes da assinatura ──────────────────
        if (clientSub && activePlan && activePlan.maxCuts) {
          const newCount = (clientSub.cutsThisPeriod || 0) + 1;
          const blocked = newCount >= activePlan.maxCuts;

          await updateDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, clientSub.id), {
            cutsThisPeriod: newCount,
            // Se atingiu o limite, marca como bloqueada até renovação
            ...(blocked ? { status: 'PAUSADA', blockedReason: 'Limite de cortes atingido' } : {}),
          });

          if (blocked) {
            console.log(`⛔ Assinatura ${clientSub.id} bloqueada: ${newCount}/${activePlan.maxCuts} cortes utilizados.`);
          }
        }
      }

      // Cashback + Selos
      const cashbackPct = (config as any).cashbackPercent ?? 5;
      const stampsLimit = (config as any).stampsForFreeCut ?? 10;
      const cashbackValue = parseFloat(((appointment.price * cashbackPct) / 100).toFixed(2));

      const loyaltySnapshot = await getDocs(collection(db, COLLECTIONS.LOYALTY_CARDS));
      const cardDoc = loyaltySnapshot.docs.find(d => d.data().clientId === appointment.clientId);

      if (cardDoc) {
        const card = cardDoc.data();
        const newStamps = (card.stamps || 0) + 1;
        const cycled = newStamps >= stampsLimit;
        await updateDoc(doc(db, COLLECTIONS.LOYALTY_CARDS, cardDoc.id), {
          stamps: cycled ? newStamps - stampsLimit : newStamps,
          totalStamps: (card.totalStamps || 0) + 1,
          credits: parseFloat(((card.credits || 0) + cashbackValue).toFixed(2)),
          freeCutsPending: cycled ? (card.freeCutsPending || 0) + 1 : (card.freeCutsPending || 0),
          freeCutsEarned: cycled ? (card.freeCutsEarned || 0) + 1 : (card.freeCutsEarned || 0),
          updatedAt: new Date().toISOString(),
        });
      }

      // ── NOVO: Gera 1 benefício parceiro para o cliente ──────
      const benefitsSnap = await getDocs(collection(db, COLLECTIONS.CLIENT_BENEFITS));
      const existingBenefit = benefitsSnap.docs.find(d => d.data().appointmentId === id);

      if (!existingBenefit) {
        const validityDays = (config as any).benefitValidityDays ?? 7;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + validityDays);

        await addDoc(collection(db, COLLECTIONS.CLIENT_BENEFITS), {
          clientId: appointment.clientId,
          clientName: appointment.clientName,
          clientPhone: appointment.clientPhone,
          appointmentId: id,
          status: 'DISPONIVEL',
          expiryDate: expiryDate.toISOString(),
          createdAt: new Date().toISOString(),
        });
      }

      // ── Comissão VIP: detecta assinatura ativa do cliente ──────────────────
      const clientSub = subscriptions.find(s =>
        s.clientId === appointment.clientId &&
        s.status === 'ATIVA'
      );
      if (clientSub) {
        const plan = ((config as any).vipPlans || []).find((p: any) => p.id === clientSub.planId);
        if (plan && plan.maxCuts && plan.vipCommissionPct) {
          const valuePerCut   = plan.price / plan.maxCuts;                    // ex: 80/4 = 20
          const commissionVal = parseFloat(((valuePerCut * plan.vipCommissionPct) / 100).toFixed(2)); // ex: 20 * 50% = 10

          // Registra comissão do barbeiro no financeiro
          const prof = professionals.find((p: any) => p.id === appointment.professionalId);
          if (prof && commissionVal > 0) {
            const commDesc = `Comissão VIP • ${prof.name} • ${appointment.clientName} (${plan.name})`;
            const existsComm = financialEntries.find(e => e.description === commDesc && e.appointmentId === id);
            if (!existsComm) {
              await addDoc(collection(db, COLLECTIONS.FINANCIAL), {
                description: commDesc,
                amount: commissionVal,
                type: 'DESPESA',
                category: 'Comissão',
                date: new Date().toISOString().split('T')[0],
                appointmentId: id,
                professionalId: prof.id,
              });
            }
          }

          // Incrementa cutsThisPeriod na assinatura
          const today   = new Date().toISOString().split('T')[0];
          const subRef  = doc(db, COLLECTIONS.SUBSCRIPTIONS, clientSub.id);
          const newCuts = (clientSub.cutsThisPeriod || 0) + 1;
          await updateDoc(subRef, {
            cutsThisPeriod: newCuts,
            usageCount: (clientSub.usageCount || 0) + 1,
            periodStartDate: clientSub.periodStartDate || clientSub.startDate,
          });

          // Notifica se atingiu o limite
          if (newCuts >= plan.maxCuts) {
            console.log(`⛔ Cliente ${appointment.clientName} atingiu o limite de ${plan.maxCuts} cortes do plano ${plan.name}`);
          }
        }
      // ── Auto-valida indicação se for o primeiro atendimento com referralCode ──
      if (appointment.referralCode && !existingEntry) {
        const pendingRef = referrals.find(
          (r: any) => r.referrerId === appointment.referralCode &&
                      (r.referredPhone === appointment.clientPhone || r.referredClientId === appointment.clientId) &&
                      r.status === 'PENDENTE'
        );
        if (pendingRef) {
          // Valida automaticamente ao concluir o primeiro corte
          await validateReferral(pendingRef.id);
        }
      }
      }
    }
  };


  // ── ASAAS: gera cobrança PIX ou link de pagamento ─────────
  const asaasRequest = async (endpoint: string, method = 'GET', body?: any) => {
    // Lê do state React; se vazio busca direto do Firestore (evita closure desatualizado)
    let key = (config as any).asaasKey || '';
    let env = (config as any).asaasEnv || 'sandbox';
    if (!key) {
      try {
        const snap = await getDoc(doc(db, 'config', 'main'));
        if (snap.exists()) {
          key = (snap.data() as any).asaasKey || '';
          env = (snap.data() as any).asaasEnv || 'sandbox';
        }
      } catch (_) {}
    }
    if (!key) throw new Error('Chave Asaas não configurada. Acesse Ajustes → Integrações.');
    console.log(`[asaas] ${method} ${endpoint} | env=${env} | key=${key.slice(0,12)}...`);
    const res = await fetch('https://us-central1-financeiro-a7116.cloudfunctions.net/asaasProxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, method, body, key, env }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[asaas] proxy ${res.status}:`, errBody);
      throw new Error(`Asaas proxy error: ${res.status} — ${errBody}`);
    }
    return res.json();
  };

  const finalizeAppointment = async (id: string, additionals: any[], paymentMethod: string) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt) return {};

    const addTotal   = additionals.reduce((s: number, a: any) => s + a.price * a.qty, 0);
    const totalPrice = appt.price + addTotal;

    // Salva adicionais + totalPrice no Firestore
    await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, id), {
      additionals,
      totalPrice,
      paymentMethod,
    });

    // ── DINHEIRO: finaliza na hora, sem Asaas ────────────────
    if (paymentMethod === 'DINHEIRO') {
      await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, id), { completedByBarber: true });
      await updateAppointmentStatus(id, 'CONCLUIDO_PAGO');
      return { _method: 'DINHEIRO' };
    }

    // ── LINK: gera cobrança no Asaas mas NÃO finaliza ────────
    // O status só muda para CONCLUIDO_PAGO quando o webhook confirmar o pagamento
    let result: { pixCode?: string; pixQrCode?: string; paymentLink?: string; _method?: string } = { _method: 'LINK' };
    const asaasKey = (config as any).asaasKey || '';

    if (asaasKey) {
      try {
        const phone = appt.clientPhone.replace(/\D/g,'');
        const extRef = `nj_${appt.clientId || appt.clientPhone.replace(/\D/g,'')}`;
        const env = (config as any).asaasEnv || 'sandbox';

        const clientData = clients.find((cl: any) => cl.id === appt.clientId);
        const cpfReal = clientData?.cpfCnpj?.replace(/\D/g,'') || '';
        const cpfCriacao = cpfReal || (env === 'sandbox' ? '00000000191' : undefined);

        const custSearch = await asaasRequest(`/customers?externalReference=${extRef}`);
        let customerId = custSearch?.data?.[0]?.id;

        if (!customerId && phone) {
          const byPhone = await asaasRequest(`/customers?mobilePhone=${phone}`);
          customerId = byPhone?.data?.[0]?.id;
        }

        if (!customerId) {
          const newCust = await asaasRequest('/customers', 'POST', {
            name: appt.clientName || 'Cliente',
            mobilePhone: phone || undefined,
            cpfCnpj: cpfCriacao,
            externalReference: extRef,
            notificationDisabled: true,
          });
          customerId = newCust?.id;
          if (!customerId) {
            console.error('Asaas customer creation failed:', JSON.stringify(newCust));
          }
        }
        // Nunca faz PUT em cliente existente — evita erro CPF invalido

        if (customerId) {
          // Cria cobrança com link (cliente escolhe PIX, Cartão ou Boleto)
          // externalReference usa o ID único do agendamento para evitar duplicatas
          const charge = await asaasRequest('/payments', 'POST', {
            customer: customerId,
            billingType: 'UNDEFINED',
            value: totalPrice,
            dueDate: new Date().toISOString().split('T')[0],
            description: `Barbearia Novo Jeito — ${appt.serviceName}`,
            externalReference: `booking_${id}`,
          });
          if (charge?.id) {
            // Sandbox às vezes não retorna invoiceUrl na criação — busca o pagamento separado
            let paymentLink = charge.invoiceUrl || charge.bankSlipUrl || '';
            if (!paymentLink) {
              try {
                const fetched = await asaasRequest(`/payments/${charge.id}`);
                paymentLink = fetched?.invoiceUrl || fetched?.bankSlipUrl || '';
                console.log('Asaas payment fetched:', JSON.stringify(fetched));
              } catch(fetchErr) { console.warn('Fetch payment err:', fetchErr); }
            }
            console.log('Asaas charge result — id:', charge.id, '| invoiceUrl:', paymentLink);
            result = { paymentLink, _method: 'LINK' };
            await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, id), {
              asaasPaymentId:        charge.id,
              asaasPaymentLink:      paymentLink,
              awaitingOnlinePayment: true,
            });
          } else {
            console.error('Asaas charge creation failed:', JSON.stringify(charge));
          }
        }
      } catch (err) {
        console.error('Asaas error:', err);
      }
    }

    // NÃO chama updateAppointmentStatus aqui — o webhook fará isso ao receber PAYMENT_RECEIVED
    return result;
  };

  const rescheduleAppointment = async (id: string, date: string, startTime: string, endTime: string) => {
    await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, id), { date, startTime, endTime });

    // ── WhatsApp: avisa sobre o reagendamento ─────────────────
    const appointment = appointments.find(a => a.id === id);
    if (appointment) {
      await wppReagendamento(
        appointment.clientPhone,
        appointment.clientName,
        appointment.serviceName,
        date,
        startTime
      );
    }
  };

  const deleteAppointment = async (id: string) => {
    const linkedEntry = financialEntries.find(e => e.appointmentId === id);
    if (linkedEntry) await deleteDoc(doc(db, COLLECTIONS.FINANCIAL, linkedEntry.id));
    await deleteDoc(doc(db, COLLECTIONS.APPOINTMENTS, id));
  };

  // ── FINANCIAL ─────────────────────────────────────────────────
  const addFinancialEntry = async (data: any) => { await addDoc(collection(db, COLLECTIONS.FINANCIAL), data); };
  const deleteFinancialEntry = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.FINANCIAL, id)); };

  // ── SUGGESTIONS ───────────────────────────────────────────────
  const addSuggestion = async (data: any) => {
    await addDoc(collection(db, COLLECTIONS.SUGGESTIONS), { ...data, date: new Date().toLocaleDateString('pt-BR') });
    await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
      title: 'Nova Sugestão',
      message: `${data.clientName} enviou uma sugestão`,
      time: new Date().toISOString(),
      read: false,
      type: 'suggestion',
      clientPhone: data.clientPhone
    });
  };
  const updateSuggestion = async (id: string, data: any) => { await updateDoc(doc(db, COLLECTIONS.SUGGESTIONS, id), data); };
  const deleteSuggestion = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.SUGGESTIONS, id)); };

  // ── NOTIFICATIONS ─────────────────────────────────────────────
  const markNotificationAsRead = async (id: string) => { await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id), { read: true }); };
  const clearNotifications = async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.NOTIFICATIONS));
    snapshot.docs.forEach(async d => await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, d.id)));
  };

  // ── CONFIG ────────────────────────────────────────────────────
  const updateConfig = async (data: Partial<ShopConfig>) => {
    const sanitize = (obj: any): any => JSON.parse(JSON.stringify(obj));
    const merged = sanitize({ ...config, ...data });
    await setDoc(doc(db, COLLECTIONS.CONFIG, 'main'), merged, { merge: true });
  };
  const addShopReview = async (review: Omit<Review, 'id' | 'date'>) => {
    const newReview: Review = { ...review, id: `rev_${Date.now()}`, date: new Date().toLocaleDateString('pt-BR') };
    await updateConfig({ reviews: [newReview, ...(config.reviews || [])] });
  };

  // ── LOYALTY CARDS ─────────────────────────────────────────────
  const addLoyaltyCard = async (data: Omit<LoyaltyCard, 'id'>) => {
    await addDoc(collection(db, COLLECTIONS.LOYALTY_CARDS), data);
  };
  const updateLoyaltyCard = async (clientId: string, data: Partial<LoyaltyCard>) => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.LOYALTY_CARDS));
    const cardDoc = snapshot.docs.find(d => d.data().clientId === clientId);
    if (cardDoc) await updateDoc(doc(db, COLLECTIONS.LOYALTY_CARDS, cardDoc.id), data);
  };

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────
  const addSubscription = async (data: Omit<Subscription, 'id'>): Promise<{ id: string; invoiceUrl: string }> => {
    const docRef = await addDoc(collection(db, COLLECTIONS.SUBSCRIPTIONS), data);
    const client = clients.find(c => c.id === data.clientId);
    // Fallback: tenta buscar pelo nome ou usa clientPhone direto se vier no data
    const phone  = client?.phone || (data as any).clientPhone || '';

    const paymentMethod = (data as any).paymentMethod || '';
    const isPendente    = (data as any).status === 'PENDENTE_PAGAMENTO';
    const isDinheiro    = paymentMethod === 'Dinheiro';
    let resolvedInvoiceUrl = '';

    // ── Asaas: pula se pagamento é dinheiro OU se já tem ID do Asaas ─────
    const asaasKey = (config as any).asaasKey || '';
    const asaasEnv = (config as any).asaasEnv || 'sandbox';
    if (asaasKey && !isDinheiro && !(data as any).asaasSubscriptionId) {
      try {
        const proxy = (endpoint: string, method = 'GET', body?: any) =>
          fetch('https://us-central1-financeiro-a7116.cloudfunctions.net/asaasProxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint, method, key: asaasKey, env: asaasEnv, body })
          }).then(r => r.json());

        // Cria/busca cliente Asaas
        const clientPhone = phone.replace(/\D/g, '');
        const extRef      = `nj_${data.clientId}`;
        const cpfReal2    = (client as any)?.cpfCnpj?.replace(/\D/g, '') || '';
        const cpfCriacao2 = cpfReal2 || (asaasEnv === 'sandbox' ? '00000000191' : undefined);

        let customerId: string | undefined;
        const byRef = await proxy(`/customers?externalReference=${extRef}`);
        customerId  = byRef?.data?.[0]?.id;
        if (!customerId && clientPhone) {
          const byPhone = await proxy(`/customers?mobilePhone=${clientPhone}`);
          customerId    = byPhone?.data?.[0]?.id;
        }
        if (!customerId) {
          const newCust  = await proxy('/customers', 'POST', {
            name: data.clientName, mobilePhone: clientPhone || undefined,
            cpfCnpj: cpfCriacao2, externalReference: extRef, notificationDisabled: true,
          });
          customerId = newCust?.id;
        }

        if (customerId) {
          const plan = (config as any).vipPlans?.find((p: any) => p.id === data.planId);
          const cycle = plan?.period === 'ANUAL' ? 'YEARLY'
                      : plan?.period === 'SEMANAL' ? 'WEEKLY'
                      : 'MONTHLY';

          const sub = await proxy('/subscriptions', 'POST', {
            customer:          customerId,
            billingType:       'UNDEFINED',
            value:             data.price,
            nextDueDate:       new Date().toISOString().split('T')[0],
            cycle,
            description:       `${data.planName} — Barbearia Novo Jeito`,
            externalReference: `sub_${docRef.id}`,
          });

          if (sub?.id) {
            // Busca a primeira cobrança para obter o invoiceUrl real
            const charges = await proxy(`/payments?subscription=${sub.id}&limit=1`);
            resolvedInvoiceUrl = charges?.data?.[0]?.invoiceUrl || '';
            await updateDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, docRef.id), {
              asaasSubscriptionId: sub.id,
              asaasInvoiceUrl:     resolvedInvoiceUrl,
            });
          }
        }
      } catch (err) {
        console.error('Asaas subscription error:', err);
      }
    }

    // ── WhatsApp: só dispara se NÃO for pendente de pagamento online ──
    // Quando PENDENTE_PAGAMENTO, o webhook do Asaas aciona as mensagens após confirmar
    if (!isPendente) {
      try {
        if (phone) {
          await wppAssinaturaAtivada(phone, data.clientName, data.planName, (data.endDate as string).split('T')[0]);
        }
      } catch(e) { console.warn('WPP assinatura cliente failed:', e); }

      try {
        const shopPhone = (config as any).whatsapp?.replace(/\D/g, '');
        const plan = (config as any).vipPlans?.find((p: any) => p.id === data.planId);
        if (shopPhone) {
          await wppNovaAssinaturaBarbearia(
            shopPhone, data.clientName, data.planName, data.price, plan?.period || 'MENSAL'
          );
        }
      } catch(e) { console.warn('WPP assinatura barbearia failed:', e); }
    }

    return { id: docRef.id, invoiceUrl: resolvedInvoiceUrl };
  };
  const updateSubscription = async (id: string, data: Partial<Subscription>) => {
    // Se está reativando assinatura (PAUSADA/VENCIDA → ATIVA), reseta contador de cortes
    if (data.status === 'ATIVA') {
      const subSnap = await getDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, id));
      if (subSnap.exists()) {
        const sub = subSnap.data() as Subscription;
        if (sub.status !== 'ATIVA') {
          data = { ...data, cutsThisPeriod: 0, blockedReason: null as any, periodStartDate: new Date().toISOString().split('T')[0] };
          console.log(`♻️ Assinatura ${id} reativada — contador de cortes zerado`);
        }
      }
    }
    await updateDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, id), data);
  };
  const deleteSubscription = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, id)); };

  // ── PARTNERS ──────────────────────────────────────────────────
  const addPartner = async (data: Omit<Partner, 'id'>) => { await addDoc(collection(db, COLLECTIONS.PARTNERS), data); };
  const updatePartner = async (id: string, data: Partial<Partner>) => { await updateDoc(doc(db, COLLECTIONS.PARTNERS, id), data); };
  const deletePartner = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.PARTNERS, id)); };

  // ── BLOCKED SLOTS ─────────────────────────────────────────────
  const addBlockedSlot = async (data: Omit<BlockedSlot, 'id'>) => { await addDoc(collection(db, COLLECTIONS.BLOCKED_SLOTS), data); };
  const deleteBlockedSlot = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.BLOCKED_SLOTS, id)); };
  const isSlotBlocked = (professionalId: string, date: string, time: string): boolean => {
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    return blockedSlots.some(slot => {
      if (slot.professionalId !== professionalId) return false;
      const timeInRange = time >= slot.startTime && time < slot.endTime;
      if (!timeInRange) return false;
      if (slot.recurring) return slot.recurringDays?.includes(dayOfWeek) ?? false;
      return slot.date === date;
    });
  };

  // ── INACTIVITY CAMPAIGNS ──────────────────────────────────────
  const addCampaign = async (data: Omit<InactivityCampaign, 'id'>) => { await addDoc(collection(db, COLLECTIONS.INACTIVITY_CAMPAIGNS), data); };
  const updateCampaign = async (id: string, data: Partial<InactivityCampaign>) => { await updateDoc(doc(db, COLLECTIONS.INACTIVITY_CAMPAIGNS, id), data); };
  const deleteCampaign = async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.INACTIVITY_CAMPAIGNS, id)); };

  // ── CLUBE DE BENEFÍCIOS ───────────────────────────────────────
  const addClientBenefit = async (data: Omit<ClientBenefit, 'id'>) => {
    await addDoc(collection(db, COLLECTIONS.CLIENT_BENEFITS), data);
  };

  const updateClientBenefit = async (id: string, data: Partial<ClientBenefit>) => {
    await updateDoc(doc(db, COLLECTIONS.CLIENT_BENEFITS, id), data);
  };

  const deleteClientBenefit = async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.CLIENT_BENEFITS, id));
  };

  /**
   * Gera um QR Code único para o cliente usar no parceiro escolhido.
   * Atualiza o benefício com: qrToken, partnerId, partnerName, status=QR_GERADO, qrExpiryDate.
   * Retorna o token gerado.
   */
  const generateBenefitQR = async (benefitId: string, partnerId: string, partnerName: string): Promise<string> => {
    const token = generateBenefitToken();
    const qrExpiry = new Date();
    qrExpiry.setHours(qrExpiry.getHours() + 24); // QR válido por 24h após geração

    await updateDoc(doc(db, COLLECTIONS.CLIENT_BENEFITS, benefitId), {
      qrToken: token,
      partnerId,
      partnerName,
      status: 'QR_GERADO',
      qrExpiryDate: qrExpiry.toISOString(),
    });

    return token;
  };

  /**
   * Valida e consome um QR Code de benefício.
   * Verifica: existência, status, validade do QR, validade do benefício.
   * Se válido, marca como USADO e retorna o benefício.
   * Se inválido, retorna null.
   */
  const validateAndUseBenefit = async (qrToken: string): Promise<ClientBenefit | null> => {
    const snap = await getDocs(collection(db, COLLECTIONS.CLIENT_BENEFITS));
    const benefitDoc = snap.docs.find(d => d.data().qrToken === qrToken);

    if (!benefitDoc) return null;

    const benefit = { id: benefitDoc.id, ...benefitDoc.data() } as ClientBenefit;
    const now = new Date();

    // Verifica se já foi usado
    if (benefit.status === 'USADO') return null;

    // Verifica se o benefício principal expirou
    if (new Date(benefit.expiryDate) < now) {
      await updateDoc(doc(db, COLLECTIONS.CLIENT_BENEFITS, benefitDoc.id), { status: 'EXPIRADO' });
      return null;
    }

    // Verifica se o QR Code expirou
    if (benefit.qrExpiryDate && new Date(benefit.qrExpiryDate) < now) {
      // QR expirou mas benefício ainda válido — volta para DISPONIVEL
      await updateDoc(doc(db, COLLECTIONS.CLIENT_BENEFITS, benefitDoc.id), {
        status: 'DISPONIVEL',
        qrToken: undefined,
        partnerId: undefined,
        partnerName: undefined,
        qrExpiryDate: undefined,
      });
      return null;
    }

    // ✅ Tudo válido: marca como usado e incrementa contador do parceiro
    await updateDoc(doc(db, COLLECTIONS.CLIENT_BENEFITS, benefitDoc.id), {
      status: 'USADO',
      usedAt: new Date().toISOString(),
      usedByPartnerName: benefit.partnerName,
    });

    // Incrementa usedBenefitsCount no parceiro
    if (benefit.partnerId) {
      const partnerDoc = partners.find(p => p.id === benefit.partnerId);
      if (partnerDoc) {
        await updateDoc(doc(db, COLLECTIONS.PARTNERS, benefit.partnerId), {
          usedBenefitsCount: ((partnerDoc as any).usedBenefitsCount || 0) + 1,
          totalReferrals: (partnerDoc.totalReferrals || 0) + 1,
        });
      }
    }

    return { ...benefit, status: 'USADO', usedAt: new Date().toISOString() };
  };

  return React.createElement(BarberContext.Provider, {
    value: {
      user, clients, professionals, services, appointments, financialEntries,
      notifications, suggestions, config, loading, theme,
      loyaltyCards, subscriptions, partners, blockedSlots, inactivityCampaigns, referrals, createReferral, validateReferral, cancelReferral,
      clientBenefits,  // ── NOVO ──
      toggleTheme, login, logout, updateUser, staff, addStaff, updateStaff, deleteStaff,
      products, addProduct, updateProduct, deleteProduct, decreaseProductStock,
      addClient, updateClient, deleteClient,
      addService, updateService, deleteService,
      addProfessional, updateProfessional, deleteProfessional, likeProfessional, resetAllLikes,
      addAppointment, markNoShow, updateAppointmentStatus, finalizeAppointment, rescheduleAppointment, deleteAppointment,
      addFinancialEntry, deleteFinancialEntry,
      addSuggestion, updateSuggestion, deleteSuggestion,
      markNotificationAsRead, clearNotifications,
      updateConfig, addShopReview,
      addLoyaltyCard, updateLoyaltyCard,
      addSubscription, updateSubscription, deleteSubscription,
      addPartner, updatePartner, deletePartner,
      addBlockedSlot, deleteBlockedSlot, isSlotBlocked,
      addCampaign, updateCampaign, deleteCampaign,
      // ── NOVO ──
      addClientBenefit, updateClientBenefit, deleteClientBenefit,
      generateBenefitQR, validateAndUseBenefit,
    }
  }, children);
}

export const useBarberStore = () => {
  const context = useContext(BarberContext);
  if (!context) throw new Error('useBarberStore must be used within BarberProvider');
  return context;
};
