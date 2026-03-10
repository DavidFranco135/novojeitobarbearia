export type UserRole = 'ADMIN' | 'PROFISSIONAL' | 'CLIENTE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  description?: string;
  status: 'ATIVO' | 'INATIVO';
  image?: string;
  category: string;
}

export interface Professional {
  id: string;
  name: string;
  specialties: string[];
  avatar: string;
  commission: number;
  likes: number;
  specialty?: string;
  isMaster?: boolean;
  masterSurcharge?: number;
  description?: string;
  workingHours: {
    start: string;
    end: string;
  };
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  password?: string;
  avatar?: string;
  totalSpent: number;
  lastVisit?: string;
  createdAt: string;
  likedProfessionals?: string[];
  cpfCnpj?: string;
}

export interface Review {
  id: string;
  userName: string;
  clientPhone?: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Suggestion {
  id: string;
  clientName: string;
  clientPhone: string;
  text: string;
  date: string;
  response?: string;
  responseDate?: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'AGENDADO' | 'CONCLUIDO_PAGO' | 'PENDENTE_PAGAMENTO' | 'REAGENDADO' | 'CANCELADO' | 'PENDENTE';
  price: number;
  // ── Adicionais e Asaas ─────────────────────────────────
  additionals?: AppointmentAdditional[];
  totalPrice?: number;
  paymentMethod?: 'PIX' | 'CARTAO' | 'DINHEIRO' | 'LINK';
  asaasPaymentId?: string;
  asaasPaymentLink?: string;
  asaasPixCode?: string;
  asaasPixQrCode?: string;
}

export interface AppointmentAdditional {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface FinancialEntry {
  id: string;
  appointmentId?: string;
  description: string;
  amount: number;
  type: 'RECEITA' | 'DESPESA';
  date: string;
  category: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  targetId?: string;
  type?: 'appointment' | 'suggestion' | 'general';
  clientPhone?: string;
}

export interface VipPlan {
  id: string;
  name: string;
  price: number;
  period: 'MENSAL' | 'ANUAL' | 'SEMANAL' | 'DIAS';
  customDays?: number;
  benefits: string[];
  discount?: number;
  status: 'ATIVO' | 'INATIVO';
}

export interface ShopConfig {
  name: string;
  description: string;
  aboutTitle: string;
  aboutText: string;
  address: string;
  city: string;
  state: string;
  whatsapp: string;
  instagram: string;
  logo: string;
  coverImage: string;
  loginBackground: string;
  heroBackground?: string;
  aboutImage?: string;
  locationImage?: string;
  locationUrl: string;
  openingTime: string;
  closingTime: string;
  email: string;
  phone?: string;
  cnpj: string;
  gallery: string[];
  reviews: Review[];
  vipPlans?: VipPlan[];
  adminName?: string;
  cashbackPercent?: number;
  stampsForFreeCut?: number;
  masterBarberSurcharge?: number;
  // ── NOVO: Clube de Benefícios ──────────────────────────────
  benefitValidityDays?: number; // padrão: 7 dias
  // ── Integração Asaas ──────────────────────────────────────
  asaasKey?: string;
  asaasEnv?: 'sandbox' | 'producao';
}

// ── FIDELIDADE ───────────────────────────────────────────────
export interface LoyaltyCard {
  id: string;
  clientId: string;
  stamps: number;
  totalStamps: number;
  credits: number;
  freeCutsEarned: number;
  freeCutsPending: number;
  createdAt: string;
  updatedAt: string;
}

// ── ASSINATURAS ──────────────────────────────────────────────
export interface SubscriptionPayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  status: 'PAGO' | 'PENDENTE' | 'FALHOU';
}

export interface Subscription {
  id: string;
  clientId: string;
  clientName: string;
  planId: string;
  planName: string;
  price: number;
  startDate: string;
  endDate: string;
  status: 'ATIVA' | 'VENCIDA' | 'CANCELADA' | 'PAUSADA';
  usageCount: number;
  usageLimit?: number;
  paymentHistory: SubscriptionPayment[];
  createdAt: string;
}

// ── BLOQUEIO DE HORÁRIOS ─────────────────────────────────────
export interface BlockedSlot {
  id: string;
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  recurring: boolean;
  recurringDays?: number[];
}

// ── PARCEIROS / QR CODE ──────────────────────────────────────
export interface Partner {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  discount: number;
  cashbackPercent: number;
  qrCodeToken: string;
  qrCodeExpiry: string;
  totalReferrals: number;
  status: 'ATIVO' | 'INATIVO' | 'EXPIRADO';
  createdAt: string;
  // ── NOVO: campos para Clube de Benefícios ──────────────────
  description?: string;       // descrição curta do parceiro
  logo?: string;              // URL do logo
  image?: string;             // URL de foto/banner
  category?: string;          // ex: "Açaí", "Hamburgueria", "Academia"
  monthlyFee?: number;        // valor mensal cobrado da empresa
  benefitValidityDays?: number; // validade do benefício (padrão herdado do config)
  usedBenefitsCount?: number;   // contador de benefícios usados (atualizado automaticamente)
}

// ── CAMPANHAS DE INATIVIDADE ─────────────────────────────────
export interface InactivityCampaign {
  id: string;
  name: string;
  daysInactive: number;
  message: string;
  discount?: number;
  lastRun: string;
  clientsSent: string[];
  status: 'ATIVA' | 'PAUSADA';
}

// ── CLUBE DE BENEFÍCIOS ──────────────────────────────────────
/**
 * Gerado automaticamente quando um atendimento é marcado como CONCLUIDO_PAGO.
 * O cliente ganha 1 benefício disponível para usar em qualquer parceiro ativo.
 * O QR Code é gerado no momento do uso (anti-fraude: único, temporário, uso único).
 */
export interface ClientBenefit {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  appointmentId: string;          // agendamento que gerou o benefício
  partnerId?: string;             // preenchido quando o cliente gera o QR para um parceiro
  partnerName?: string;           // nome do parceiro escolhido
  qrToken?: string;               // token único gerado no momento do uso
  expiryDate: string;             // ISO — validade do benefício (padrão 7 dias da conclusão)
  qrExpiryDate?: string;          // ISO — validade do QR Code depois de gerado (padrão 24h)
  status: 'DISPONIVEL' | 'QR_GERADO' | 'USADO' | 'EXPIRADO';
  usedAt?: string;                // data/hora do uso confirmado
  usedByPartnerName?: string;     // parceiro que confirmou o uso
  createdAt: string;
}