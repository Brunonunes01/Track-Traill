export type AlertStatus = "ativo" | "resolvido";

export type AlertType =
  | "acidente"
  | "trilha_bloqueada"
  | "lama"
  | "animal_perigoso"
  | "assalto_risco"
  | "queda_arvore"
  | "enchente"
  | "pista_escorregadia"
  | "outro";

export type TrackTrailRoute = {
  id: string;
  titulo: string;
  tipo: string;
  descricao?: string;
  dificuldade?: string;
  distancia?: string;
  startPoint?: { latitude: number; longitude: number };
  endPoint?: { latitude: number; longitude: number };
  rotaCompleta?: { latitude: number; longitude: number }[];
};

export type TrailAlert = {
  id: string;
  type: AlertType;
  description: string;
  latitude: number;
  longitude: number;
  routeId?: string | null;
  routeName?: string | null;
  createdAt: string;
  createdAtMs: number;
  userId: string;
  userDisplayName?: string | null;
  userEmail?: string | null;
  status: AlertStatus;
  photoUrl?: string | null;
  confirmations: number;
};

export const ALERT_TYPE_META: Record<
  AlertType,
  {
    label: string;
    icon: string;
    color: string;
  }
> = {
  acidente: { label: "Acidente", icon: "warning", color: "#ef4444" },
  trilha_bloqueada: {
    label: "Trilha bloqueada",
    icon: "close-circle",
    color: "#f97316",
  },
  lama: { label: "Lama excessiva", icon: "rainy", color: "#a16207" },
  animal_perigoso: {
    label: "Animal perigoso",
    icon: "paw",
    color: "#dc2626",
  },
  assalto_risco: {
    label: "Assalto / Risco",
    icon: "shield", color: "#b91c1c",
  },
  queda_arvore: {
    label: "Queda de árvore",
    icon: "leaf",
    color: "#166534",
  },
  enchente: { label: "Enchente", icon: "water", color: "#1d4ed8" },
  pista_escorregadia: {
    label: "Pista escorregadia",
    icon: "snow",
    color: "#0f766e",
  },
  outro: { label: "Outro", icon: "alert-circle", color: "#6b7280" },
};

export const ALERT_TYPES: AlertType[] = [
  "acidente",
  "trilha_bloqueada",
  "lama",
  "animal_perigoso",
  "assalto_risco",
  "queda_arvore",
  "enchente",
  "pista_escorregadia",
  "outro",
];
