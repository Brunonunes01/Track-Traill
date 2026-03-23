import {
  equalTo,
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  update,
} from "firebase/database";
import { User } from "firebase/auth";
import { database, normalizeFirebaseErrorMessage } from "../../services/connectionFirebase";
import { AlertStatus, AlertType, TrailAlert } from "../models/alerts";
import { calculateDistanceKm } from "./routeService";

type CreateAlertInput = {
  type: AlertType;
  description: string;
  latitude: number;
  longitude: number;
  routeId?: string | null;
  routeName?: string | null;
  status?: AlertStatus;
  photoUrl?: string | null;
};

const alertsRef = ref(database, "alerts");

const normalizeAlert = (id: string, raw: any): TrailAlert | null => {
  const latitude = Number(raw?.latitude);
  const longitude = Number(raw?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const createdAt =
    typeof raw?.createdAt === "string" ? raw.createdAt : new Date().toISOString();
  const createdAtMs =
    typeof raw?.createdAtMs === "number"
      ? raw.createdAtMs
      : new Date(createdAt).getTime() || Date.now();

  return {
    id,
    type: (raw?.type || "outro") as AlertType,
    description: String(raw?.description || "Sem descrição."),
    latitude,
    longitude,
    routeId: raw?.routeId || null,
    routeName: raw?.routeName || null,
    createdAt,
    createdAtMs,
    userId: String(raw?.userId || "unknown"),
    userDisplayName: raw?.userDisplayName || null,
    userEmail: raw?.userEmail || null,
    status: raw?.status === "resolvido" ? "resolvido" : "ativo",
    photoUrl: raw?.photoUrl || null,
    confirmations: Number(raw?.confirmations || 0),
  };
};

const normalizeDescription = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const hasRecentDuplicate = async (
  userId: string,
  input: CreateAlertInput
): Promise<boolean> => {
  const userAlertsQuery = query(
    alertsRef,
    orderByChild("userId"),
    equalTo(userId),
    limitToLast(12)
  );

  const snapshot = await get(userAlertsQuery);
  if (!snapshot.exists()) {
    return false;
  }

  const normalizedDescription = normalizeDescription(input.description);
  const now = Date.now();

  const duplicate = Object.values(snapshot.val()).find((raw: any) => {
    const rawCreatedAtMs =
      typeof raw?.createdAtMs === "number"
        ? raw.createdAtMs
        : new Date(raw?.createdAt || 0).getTime();

    const isRecent = now - rawCreatedAtMs <= 15 * 60 * 1000;
    if (!isRecent) return false;

    const sameType = raw?.type === input.type;
    const sameStatus = (raw?.status || "ativo") === (input.status || "ativo");
    const sameRoute = (raw?.routeId || null) === (input.routeId || null);
    const sameDescription =
      normalizeDescription(String(raw?.description || "")) === normalizedDescription;

    const lat = Number(raw?.latitude);
    const lon = Number(raw?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return false;
    }

    const distanceMeters =
      calculateDistanceKm(input.latitude, input.longitude, lat, lon) * 1000;

    return sameType && sameStatus && sameRoute && sameDescription && distanceMeters < 25;
  });

  return Boolean(duplicate);
};

export const subscribeAlerts = (
  onChange: (alerts: TrailAlert[]) => void,
  onError?: (message: string) => void
) =>
  onValue(
    alertsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange([]);
        return;
      }

      const data = snapshot.val();
      const alerts = Object.keys(data)
        .map((id) => normalizeAlert(id, data[id]))
        .filter((item): item is TrailAlert => Boolean(item))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);

      onChange(alerts);
    },
    (error) => {
      onError?.(normalizeFirebaseErrorMessage(error, "Falha ao carregar alertas."));
    }
  );

export const subscribeRouteAlerts = (
  routeId: string,
  onChange: (alerts: TrailAlert[]) => void,
  onError?: (message: string) => void
) =>
  subscribeAlerts(
    (alerts) => {
      onChange(alerts.filter((alert) => alert.routeId === routeId));
    },
    onError
  );

export const createAlert = async (input: CreateAlertInput, user: User | null) => {
  if (!user) {
    throw new Error("Você precisa estar logado para registrar um alerta.");
  }

  if (!input.description?.trim()) {
    throw new Error("Descrição obrigatória.");
  }

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error("Latitude e longitude são obrigatórias.");
  }

  try {
    const duplicate = await hasRecentDuplicate(user.uid, input);
    if (duplicate) {
      throw new Error(
        "Já existe um alerta muito parecido criado recentemente. Aguarde alguns minutos."
      );
    }

    const createdAt = new Date().toISOString();
    const createdAtMs = Date.now();

    const alertPayload = {
      type: input.type,
      description: input.description.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      routeId: input.routeId || null,
      routeName: input.routeName || null,
      createdAt,
      createdAtMs,
      userId: user.uid,
      userDisplayName: user.displayName || null,
      userEmail: user.email || null,
      status: input.status || "ativo",
      photoUrl: input.photoUrl || null,
      confirmations: 0,
    };

    const newAlertRef = push(alertsRef);
    await set(newAlertRef, alertPayload);

    return {
      id: newAlertRef.key,
      ...alertPayload,
    };
  } catch (error: any) {
    const message = normalizeFirebaseErrorMessage(error, "Não foi possível registrar o alerta.");
    console.warn("[alerts] createAlert failed:", message);
    throw new Error(message);
  }
};

export const confirmAlert = async (alertId: string) => {
  const confirmationsRef = ref(database, `alerts/${alertId}/confirmations`);

  try {
    await runTransaction(confirmationsRef, (current) => {
      const value = typeof current === "number" ? current : 0;
      return value + 1;
    });
  } catch (error) {
    throw new Error(normalizeFirebaseErrorMessage(error, "Não foi possível confirmar o alerta."));
  }
};

export const markAlertAsResolved = async (alertId: string) => {
  const alertRef = ref(database, `alerts/${alertId}`);
  try {
    await update(alertRef, { status: "resolvido" });
  } catch (error) {
    throw new Error(
      normalizeFirebaseErrorMessage(error, "Não foi possível atualizar o status do alerta.")
    );
  }
};

export const updateAlertStatus = async (alertId: string, status: AlertStatus) => {
  const alertRef = ref(database, `alerts/${alertId}`);
  try {
    await update(alertRef, { status });
  } catch (error) {
    throw new Error(
      normalizeFirebaseErrorMessage(error, "Não foi possível atualizar o status do alerta.")
    );
  }
};
