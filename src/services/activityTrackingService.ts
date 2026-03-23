import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { push, ref, set } from "firebase/database";
import { auth, database, normalizeFirebaseErrorMessage } from "../../services/connectionFirebase";
import { toCoordinate } from "../utils/geo";

export type ActivityType = "bike" | "corrida" | "caminhada" | "trilha";
export type TrackingMode = "background" | "foreground";
export type ActivityStatus = "recording" | "paused" | "finished";

export type ActivityPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export type ActiveActivitySession = {
  id: string;
  userId: string;
  activityType: ActivityType;
  status: ActivityStatus;
  trackingMode: TrackingMode;
  startedAt: number;
  endedAt?: number;
  pausedAt?: number;
  pausedDurationMs: number;
  distanceKm: number;
  points: ActivityPoint[];
  createdAt: string;
};

type StartTrackingInput = {
  userId: string;
  activityType: ActivityType;
  initialPoint?: { latitude: number; longitude: number };
};

type SaveRouteInput = {
  routeName: string;
  description?: string;
  activityType?: ActivityType;
};

const TRACKING_TASK_NAME = "tracktrail-background-location";
const ACTIVE_SESSION_KEY = "@tracktrail/active-session";
const MIN_POINT_DISTANCE_METERS = 4;

const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const earthRadius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const appendPoint = (session: ActiveActivitySession, point: ActivityPoint) => {
  const previous = session.points[session.points.length - 1];

  if (previous) {
    const addedKm = calculateDistanceKm(
      previous.latitude,
      previous.longitude,
      point.latitude,
      point.longitude
    );

    if (addedKm * 1000 < MIN_POINT_DISTANCE_METERS) {
      return session;
    }

    session.distanceKm += addedKm;
  }

  session.points.push(point);
  return session;
};

const toActivityPoint = (
  value: any,
  fallbackTimestamp = Date.now()
): ActivityPoint | null => {
  const coordinate = toCoordinate(value);
  if (!coordinate) {
    return null;
  }

  const timestamp =
    typeof value?.timestamp === "number" && Number.isFinite(value.timestamp)
      ? value.timestamp
      : fallbackTimestamp;

  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    timestamp,
  };
};

const saveSession = async (session: ActiveActivitySession | null) => {
  if (!session) {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    return;
  }

  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
};

export const getActiveSession = async (): Promise<ActiveActivitySession | null> => {
  const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ActiveActivitySession;
  } catch {
    return null;
  }
};

const stopBackgroundTrackingIfRunning = async () => {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
  }
};

const ensurePermissions = async () => {
  try {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== "granted") {
      throw new Error("Permissão de localização negada.");
    }

    const background = await Location.requestBackgroundPermissionsAsync();

    return {
      hasBackground: background.status === "granted",
    };
  } catch (error: any) {
    throw new Error(error?.message || "Não foi possível validar as permissões de localização.");
  }
};

const startBackgroundTracking = async () => {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
  if (alreadyStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 10,
    timeInterval: 5000,
    deferredUpdatesDistance: 25,
    deferredUpdatesInterval: 20000,
    pausesUpdatesAutomatically: true,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Track & Trail em atividade",
      notificationBody: "Gravando seu trajeto por GPS.",
      notificationColor: "#1e4db7",
    },
  });
};

if (!TaskManager.isTaskDefined(TRACKING_TASK_NAME)) {
  TaskManager.defineTask(TRACKING_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody<any>) => {
    if (error) {
      console.warn("[activity] background task received error:", error?.message || String(error));
      return;
    }

    try {
      const locations = (data as any)?.locations as Location.LocationObject[] | undefined;
      if (!locations || locations.length === 0) {
        return;
      }

      const activeSession = await getActiveSession();
      if (!activeSession || activeSession.status !== "recording") {
        return;
      }

      const updatedSession = { ...activeSession };

      for (const location of locations) {
        const safePoint = toActivityPoint(location.coords, location.timestamp || Date.now());
        if (!safePoint) continue;
        appendPoint(updatedSession, safePoint);
      }

      await saveSession(updatedSession);
    } catch (taskError: any) {
      console.warn("[activity] background task failed:", taskError?.message || String(taskError));
    }
  });
}

export const appendForegroundPoint = async (coords: {
  latitude: number;
  longitude: number;
  timestamp?: number;
}) => {
  const activeSession = await getActiveSession();
  if (!activeSession || activeSession.status !== "recording") {
    return null;
  }

  const safePoint = toActivityPoint(coords, coords.timestamp || Date.now());
  if (!safePoint) {
    return activeSession;
  }

  const updatedSession = { ...activeSession };
  appendPoint(updatedSession, safePoint);

  await saveSession(updatedSession);
  return updatedSession;
};

export const startActivityTracking = async (
  input: StartTrackingInput
): Promise<{ session: ActiveActivitySession; mode: TrackingMode }> => {
  const permissions = await ensurePermissions();
  const mode: TrackingMode = permissions.hasBackground ? "background" : "foreground";

  const existing = await getActiveSession();
  if (existing && existing.status !== "finished") {
    const resumed = { ...existing, status: "recording" as const, trackingMode: mode };
    if (resumed.pausedAt) {
      resumed.pausedDurationMs += Date.now() - resumed.pausedAt;
      delete resumed.pausedAt;
    }
    await saveSession(resumed);

    if (mode === "background") {
      await startBackgroundTracking();
    }

    return { session: resumed, mode };
  }

  const now = Date.now();
  const session: ActiveActivitySession = {
    id: `${input.userId}-${now}`,
    userId: input.userId,
    activityType: input.activityType,
    status: "recording",
    trackingMode: mode,
    startedAt: now,
    pausedDurationMs: 0,
    distanceKm: 0,
    points: [],
    createdAt: new Date(now).toISOString(),
  };

  if (input.initialPoint) {
    appendPoint(session, {
      latitude: input.initialPoint.latitude,
      longitude: input.initialPoint.longitude,
      timestamp: now,
    });
  }

  await saveSession(session);

  if (mode === "background") {
    await startBackgroundTracking();
  }

  return { session, mode };
};

export const pauseActivityTracking = async () => {
  const activeSession = await getActiveSession();
  if (!activeSession || activeSession.status !== "recording") {
    return activeSession;
  }

  const pausedSession: ActiveActivitySession = {
    ...activeSession,
    status: "paused",
    pausedAt: Date.now(),
  };

  await saveSession(pausedSession);
  await stopBackgroundTrackingIfRunning();

  return pausedSession;
};

export const resumeActivityTracking = async () => {
  const activeSession = await getActiveSession();
  if (!activeSession || activeSession.status !== "paused") {
    return null;
  }

  const permissions = await ensurePermissions();
  const mode: TrackingMode = permissions.hasBackground ? "background" : "foreground";

  const resumedSession: ActiveActivitySession = {
    ...activeSession,
    status: "recording",
    trackingMode: mode,
    pausedDurationMs:
      activeSession.pausedDurationMs +
      (activeSession.pausedAt ? Date.now() - activeSession.pausedAt : 0),
  };

  delete resumedSession.pausedAt;
  await saveSession(resumedSession);

  if (mode === "background") {
    await startBackgroundTracking();
  }

  return {
    session: resumedSession,
    mode,
  };
};

export const finishActivityTracking = async () => {
  const activeSession = await getActiveSession();
  if (!activeSession) {
    throw new Error("Nenhuma atividade em andamento.");
  }

  await stopBackgroundTrackingIfRunning();

  const finishedAt = Date.now();
  const finishedSession: ActiveActivitySession = {
    ...activeSession,
    status: "finished",
    endedAt: finishedAt,
    pausedDurationMs:
      activeSession.pausedDurationMs +
      (activeSession.status === "paused" && activeSession.pausedAt
        ? finishedAt - activeSession.pausedAt
        : 0),
  };

  delete finishedSession.pausedAt;
  await saveSession(finishedSession);

  return finishedSession;
};

export const discardActiveSession = async () => {
  await stopBackgroundTrackingIfRunning();
  await saveSession(null);
};

export const getSessionDurationSeconds = (session: ActiveActivitySession | null): number => {
  if (!session) return 0;

  const finishTimestamp =
    session.status === "finished"
      ? session.endedAt || Date.now()
      : session.status === "paused"
        ? session.pausedAt || Date.now()
        : Date.now();

  const elapsedMs = Math.max(0, finishTimestamp - session.startedAt - session.pausedDurationMs);
  return Math.floor(elapsedMs / 1000);
};

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }

  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const getAverageSpeedKmh = (session: ActiveActivitySession | null): number => {
  if (!session) return 0;
  const durationSeconds = getSessionDurationSeconds(session);
  if (durationSeconds <= 0) return 0;

  return session.distanceKm / (durationSeconds / 3600);
};

export const saveFinishedSessionAsRoute = async (
  session: ActiveActivitySession,
  input: SaveRouteInput
) => {
  if (session.status !== "finished") {
    throw new Error("Finalize a atividade antes de salvar como rota.");
  }

  if (session.points.length < 2) {
    throw new Error("Trajeto muito curto. Grave mais pontos antes de salvar.");
  }

  const routeName = input.routeName?.trim();
  if (!routeName) {
    throw new Error("Informe um nome para a rota.");
  }

  const path = session.points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));

  const firstPoint = path[0];
  const lastPoint = path[path.length - 1];
  const activityType = input.activityType || session.activityType;
  const activitySaved = await saveFinishedSessionAsActivity(session, activityType);

  const userEmail = auth.currentUser?.email || "usuario@tracktrail";

  const rotaRef = push(ref(database, "rotas_pendentes"));
  try {
    await set(rotaRef, {
      nome: routeName,
      tipo: activityType,
      dificuldade: "Média",
      distancia: `${session.distanceKm.toFixed(2)} km`,
      descricao: input.description?.trim() || "Rota gerada automaticamente por atividade GPS.",
      startPoint: firstPoint,
      endPoint: lastPoint,
      rotaCompleta: path,
      sugeridoPor: session.userId,
      emailAutor: userEmail,
      status: "pendente",
      criadoEm: new Date().toISOString(),
      origem: "activity_tracking",
      activityId: activitySaved.activityId,
    });
  } catch (error) {
    throw new Error(normalizeFirebaseErrorMessage(error, "Não foi possível salvar a rota."));
  }

  await saveSession(null);

  return {
    activityId: activitySaved.activityId,
    routeId: rotaRef.key,
  };
};

export const saveFinishedSessionAsActivity = async (
  session: ActiveActivitySession,
  activityTypeOverride?: ActivityType
) => {
  if (session.status !== "finished") {
    throw new Error("Finalize a atividade antes de salvar.");
  }

  if (session.points.length < 2) {
    throw new Error("Trajeto muito curto. Grave mais pontos antes de salvar.");
  }

  const duration = getSessionDurationSeconds(session);
  const activityType = activityTypeOverride || session.activityType;
  const path = session.points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));

  const atividadeRef = push(ref(database, `users/${session.userId}/atividades`));
  try {
    await set(atividadeRef, {
      tipo: activityType,
      cidade: "Rota registrada via GPS",
      data: new Date().toLocaleDateString("pt-BR"),
      duracao: duration,
      distancia: session.distanceKm.toFixed(2),
      rota: path,
      criadoEm: new Date().toISOString(),
      origem: "activity_tracking",
      sessionId: session.id,
    });
  } catch (error) {
    throw new Error(
      normalizeFirebaseErrorMessage(error, "Não foi possível salvar a atividade.")
    );
  }

  return {
    activityId: atividadeRef.key,
    durationSeconds: duration,
    path,
  };
};
