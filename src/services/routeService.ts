import { onValue, ref } from "firebase/database";
import { database } from "../../services/connectionFirebase";
import { TrackTrailRoute } from "../models/alerts";

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toCoordinate = (value: any): { latitude: number; longitude: number } | undefined => {
  const latitude = toNumber(value?.latitude);
  const longitude = toNumber(value?.longitude);

  if (latitude === null || longitude === null) {
    return undefined;
  }

  return { latitude, longitude };
};

const toCoordinates = (value: any): { latitude: number; longitude: number }[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toCoordinate(item))
    .filter((item): item is { latitude: number; longitude: number } => Boolean(item));
};

const normalizeRoute = (id: string, raw: any): TrackTrailRoute => ({
  id,
  titulo: String(raw?.titulo || raw?.nome || "Rota sem nome"),
  tipo: String(raw?.tipo || "Trilha"),
  descricao: raw?.descricao ? String(raw.descricao) : "Sem descrição disponível.",
  dificuldade: raw?.dificuldade ? String(raw.dificuldade) : "Não informada",
  distancia: raw?.distancia ? String(raw.distancia) : undefined,
  startPoint: toCoordinate(raw?.startPoint),
  endPoint: toCoordinate(raw?.endPoint),
  rotaCompleta: toCoordinates(raw?.rotaCompleta),
});

export const subscribeOfficialRoutes = (
  onChange: (routes: TrackTrailRoute[]) => void,
  onError?: (message: string) => void
) => {
  const routesRef = ref(database, "rotas_oficiais");

  return onValue(
    routesRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange([]);
        return;
      }

      const raw = snapshot.val();
      const routes = Object.keys(raw)
        .map((key) => normalizeRoute(key, raw[key]))
        .filter((route) => route.startPoint);

      onChange(routes);
    },
    (error) => {
      onError?.(error.message || "Falha ao carregar rotas.");
    }
  );
};

export const calculateDistanceKm = (
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number => {
  const R = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
