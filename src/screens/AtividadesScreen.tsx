import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/connectionFirebase";
import { FALLBACK_REGION, getRegionWithFallback, toCoordinate, toCoordinateArray } from "../utils/geo";
import {
  ActivityType,
  ActiveActivitySession,
  appendForegroundPoint,
  discardActiveSession,
  finishActivityTracking,
  formatDuration,
  getActiveSession,
  getAverageSpeedKmh,
  getSessionDurationSeconds,
  pauseActivityTracking,
  resumeActivityTracking,
  startActivityTracking,
} from "../services/activityTrackingService";

type Coordinate = {
  latitude: number;
  longitude: number;
};

const ACTIVITY_OPTIONS: { label: string; value: ActivityType }[] = [
  { label: "Bike", value: "bike" },
  { label: "Corrida", value: "corrida" },
  { label: "Caminhada", value: "caminhada" },
  { label: "Trilha", value: "trilha" },
];

const inferActivityType = (value?: string): ActivityType => {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("bike") || normalized.includes("cicl")) return "bike";
  if (normalized.includes("corr")) return "corrida";
  if (normalized.includes("camin")) return "caminhada";
  return "trilha";
};

type AtividadesScreenProps = {
  navigation?: any;
  route?: any;
};

export default function AtividadesScreen(props: AtividadesScreenProps) {
  const hookNavigation = useNavigation<any>();
  const hookRoute = useRoute<any>();
  const navigation = props.navigation || hookNavigation;
  const route = props.route || hookRoute;
  const insets = useSafeAreaInsets();
  const rotaGuia = route.params?.rotaSugerida;

  const mapRef = useRef<MapView>(null);
  const foregroundSubscription = useRef<Location.LocationSubscription | null>(null);
  const syncInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activityType, setActivityType] = useState<ActivityType>(
    inferActivityType(rotaGuia?.tipo)
  );
  const [session, setSession] = useState<ActiveActivitySession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>("Pronto para iniciar.");

  const trackedPath: Coordinate[] = useMemo(
    () => toCoordinateArray(session?.points || []),
    [session]
  );

  const durationSeconds = useMemo(() => getSessionDurationSeconds(session), [session]);
  const averageSpeed = useMemo(() => getAverageSpeedKmh(session), [session]);
  const isRecording = session?.status === "recording";
  const hasActiveSession = !!session && session.status !== "finished";
  const safeSuggestedPath = useMemo(() => toCoordinateArray(rotaGuia?.rotaCompleta), [rotaGuia?.rotaCompleta]);
  const mapInitialRegion = useMemo(
    () =>
      getRegionWithFallback(
        toCoordinate(rotaGuia?.startPoint) || trackedPath[0] || null,
        FALLBACK_REGION,
        { latitudeDelta: 0.05, longitudeDelta: 0.05 }
      ),
    [rotaGuia?.startPoint, trackedPath]
  );

  const stopForegroundWatch = () => {
    if (foregroundSubscription.current) {
      foregroundSubscription.current.remove();
      foregroundSubscription.current = null;
    }
  };

  const startForegroundWatch = useCallback(async () => {
    stopForegroundWatch();

    try {
      foregroundSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 4000,
          distanceInterval: 10,
        },
        async (location) => {
          try {
            const updated = await appendForegroundPoint({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: location.timestamp || Date.now(),
            });

            if (updated) {
              setSession(updated);
              mapRef.current?.animateCamera({
                center: {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                },
              });
            }
          } catch (error: any) {
            console.warn("[activity] appendForegroundPoint failed:", error?.message || String(error));
          }
        }
      );
    } catch (error: any) {
      console.warn("[activity] startForegroundWatch failed:", error?.message || String(error));
      setStatusMessage("Falha ao iniciar rastreamento em primeiro plano.");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    console.log("[activity] Bootstrap starting");

    const bootstrap = async () => {
      // Safety timer
      const bootstrapTimeout = setTimeout(() => {
        if (loadingSession && mounted) {
          console.warn("[activity] Bootstrap taking too long, releasing loader");
          setLoadingSession(false);
          setStatusMessage("Sincronização lenta, tente novamente se os dados não aparecerem.");
        }
      }, 10000);

      try {
        console.log("[activity] Requesting foreground permissions");
        const foregroundPermission = await Location.requestForegroundPermissionsAsync();
        if (foregroundPermission.status !== "granted") {
          console.warn("[activity] GPS permission denied");
          setStatusMessage("Permissão de localização necessária para gravar atividade.");
          setLoadingSession(false);
          clearTimeout(bootstrapTimeout);
          return;
        }

        console.log("[activity] Getting initial position");
        const current = await Location.getCurrentPositionAsync({});
        if (!mounted) {
          clearTimeout(bootstrapTimeout);
          return;
        }
        
        const startFocus = toCoordinate(rotaGuia?.startPoint) || toCoordinate(current.coords);
        if (startFocus) {
          console.log("[activity] Focusing map at:", startFocus);
          mapRef.current?.animateCamera({ center: startFocus, zoom: 16 });
        }

        console.log("[activity] Restoring active session if any");
        const active = await getActiveSession();
        if (!mounted) {
          clearTimeout(bootstrapTimeout);
          return;
        }

        if (active && active.status !== "finished") {
          console.log("[activity] Session restored:", active.id);
          setSession(active);
          setActivityType(active.activityType);
          setStatusMessage(
            active.status === "recording"
              ? "Atividade em andamento recuperada."
              : "Atividade pausada recuperada."
          );

          if (active.trackingMode === "foreground" && active.status === "recording") {
            await startForegroundWatch();
          }
        }
      } catch (error: any) {
        console.error("[activity] Bootstrap failed:", error?.message || String(error));
        setStatusMessage("Falha ao obter GPS inicial.");
      } finally {
        if (mounted) {
          setLoadingSession(false);
          clearTimeout(bootstrapTimeout);
        }
      }
    };

    bootstrap();

    syncInterval.current = setInterval(() => {
      getActiveSession()
        .then((active) => {
          if (!mounted) return;
          if (active && active.status !== "finished") {
            setSession(active);
          }
        })
        .catch((error: any) => {
          if (!mounted) return;
          console.warn("[activity] session sync failed:", error?.message || String(error));
        });
    }, 1500);

    return () => {
      mounted = false;
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
      }
      stopForegroundWatch();
    };
  }, [rotaGuia?.startPoint, startForegroundWatch]);

  const handleStart = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Erro", "Você precisa estar logado.");
      return;
    }

    try {
      const current = await Location.getCurrentPositionAsync({});
      const safeCurrent = toCoordinate(current.coords);
      if (!safeCurrent && trackedPath.length === 0) {
        throw new Error("Coordenadas iniciais inválidas.");
      }

      const startPoint = trackedPath[trackedPath.length - 1] || (safeCurrent as Coordinate);

      const response = await startActivityTracking({
        userId: user.uid,
        activityType,
        initialPoint: startPoint,
      });

      setSession(response.session);

      if (response.mode === "foreground") {
        await startForegroundWatch();
        setStatusMessage("Atividade iniciada. Rastreamento em tempo real ativo.");
      } else {
        stopForegroundWatch();
        setStatusMessage("Atividade iniciada em background.");
      }
    } catch (error: any) {
      Alert.alert("Não foi possível iniciar", error?.message || "Verifique permissões de localização.");
    }
  };

  const handlePauseOrResume = async () => {
    if (!hasActiveSession) return;

    if (isRecording) {
      try {
        const paused = await pauseActivityTracking();
        stopForegroundWatch();
        if (paused) {
          setSession(paused);
        }
        setStatusMessage("Atividade pausada.");
      } catch {
        Alert.alert("Erro", "Não foi possível pausar.");
      }
      return;
    }

    try {
      const response = await resumeActivityTracking();
      if (!response) return;

      setSession(response.session);
      if (response.mode === "foreground") {
        await startForegroundWatch();
      } else {
        stopForegroundWatch();
      }
      setStatusMessage("Atividade retomada.");
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Não foi possível retomar a atividade.");
    }
  };

  const handleMainAction = async () => {
    if (!hasActiveSession) {
      await handleStart();
      return;
    }

    try {
      stopForegroundWatch();
      const finished = await finishActivityTracking();

      if (finished.points.length < 2 || getSessionDurationSeconds(finished) < 10) {
        Alert.alert(
          "Atividade muito curta",
          "Não há dados suficientes para gerar uma rota. Deseja descartar?",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Descartar",
              style: "destructive",
              onPress: async () => {
                try {
                  await discardActiveSession();
                  setSession(null);
                } catch (error: any) {
                  Alert.alert("Erro", error?.message || "Não foi possível descartar a atividade.");
                }
              },
            },
          ]
        );
        return;
      }

      navigation.navigate("ActivitySummary", { session: finished });
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Não foi possível finalizar.");
    }
  };

  const handleExit = () => {
    if (isRecording) {
      Alert.alert(
        "Atividade em andamento",
        "Deseja sair e continuar gravando em background?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sair", onPress: () => navigation.goBack() },
        ]
      );
      return;
    }

    navigation.navigate("Mapa");
  };

  const handleCenterOnCurrentLocation = async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        const requested = await Location.requestForegroundPermissionsAsync();
        if (requested.status !== "granted") {
          Alert.alert("Permissão necessária", "Permita localização para centralizar o mapa.");
          return;
        }
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const safeCurrent = toCoordinate(current.coords);
      if (!safeCurrent) {
        Alert.alert("Localização indisponível", "Coordenadas inválidas retornadas pelo GPS.");
        return;
      }

      mapRef.current?.animateCamera(
        {
          center: safeCurrent,
          zoom: 17,
        },
        { duration: 450 }
      );
    } catch {
      Alert.alert("Localização indisponível", "Não foi possível centralizar no local atual.");
    }
  };

  if (loadingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Preparando atividade...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={mapInitialRegion}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {safeSuggestedPath.length > 1 ? (
            <Polyline coordinates={safeSuggestedPath} strokeColor="rgba(249,115,22,0.45)" strokeWidth={6} />
          ) : null}

          {trackedPath.length > 1 ? (
            <Polyline coordinates={trackedPath} strokeColor="#fb7185" strokeWidth={5} />
          ) : null}
        </MapView>

        <View style={[styles.mapTopRow, { top: insets.top + 8 }]}> 
          <Pressable style={styles.topIconButton} onPress={handleExit}>
            <Ionicons name="arrow-back" size={20} color="#f8fafc" />
          </Pressable>

          <View style={styles.statusWrap}>
            <Text style={styles.statusTitle}>{isRecording ? "Atividade em andamento" : "Painel de atividade"}</Text>
            <Text style={styles.statusDescription} numberOfLines={1}>{statusMessage}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.locateButton, { bottom: 14 + Math.max(insets.bottom, 0) }]}
          onPress={handleCenterOnCurrentLocation}
        >
          <Ionicons name="locate" size={22} color="#f8fafc" />
        </Pressable>
      </View>

      <View style={[styles.metricsSection, { paddingBottom: insets.bottom + 12 }]}> 
        {!hasActiveSession ? (
          <View style={styles.activityTypeRow}>
            {ACTIVITY_OPTIONS.map((option) => {
              const selected = activityType === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.typeChip, selected ? styles.typeChipActive : null]}
                  onPress={() => setActivityType(option.value)}
                >
                  <Text style={[styles.typeChipText, selected ? styles.typeChipTextActive : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.metricsRow}>
          <View style={styles.metricCardLarge}>
            <Text style={styles.metricLabel}>Tempo</Text>
            <Text style={styles.metricValueLarge}>{formatDuration(durationSeconds)}</Text>
          </View>

          <View style={styles.metricCardLarge}>
            <Text style={styles.metricLabel}>Distância</Text>
            <Text style={styles.metricValueLarge}>{session?.distanceKm.toFixed(2) || "0.00"} km</Text>
          </View>
        </View>

        <View style={styles.metricCardSmall}>
          <Text style={styles.metricLabel}>Velocidade média</Text>
          <Text style={styles.metricValueSmall}>{averageSpeed.toFixed(1)} km/h</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.mainActionButton,
            hasActiveSession ? styles.finishAction : styles.startAction,
            pressed ? styles.buttonPressed : null,
          ]}
          onPress={handleMainAction}
        >
          <Ionicons name={hasActiveSession ? "stop" : "play"} size={22} color="#fff" />
          <Text style={styles.mainActionText}>
            {hasActiveSession ? "Finalizar atividade" : "Iniciar atividade"}
          </Text>
        </Pressable>

        {hasActiveSession ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryActionButton, pressed ? styles.buttonPressed : null]}
            onPress={handlePauseOrResume}
          >
            <Ionicons name={isRecording ? "pause" : "play"} size={18} color="#e2e8f0" />
            <Text style={styles.secondaryActionText}>
              {isRecording ? "Pausar" : "Retomar"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  loadingText: {
    marginTop: 10,
    color: "#cbd5e1",
    fontSize: 14,
  },
  mapSection: {
    flex: 1.15,
    position: "relative",
    overflow: "hidden",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapTopRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    backgroundColor: "rgba(2,6,23,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusWrap: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.82)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.42)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  statusDescription: {
    marginTop: 2,
    color: "#cbd5e1",
    fontSize: 12,
  },
  locateButton: {
    position: "absolute",
    right: 14,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.42)",
    backgroundColor: "rgba(2,6,23,0.9)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  metricsSection: {
    flex: 0.95,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  activityTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 18,
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typeChipActive: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.18)",
  },
  typeChipText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  typeChipTextActive: {
    color: "#f97316",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCardLarge: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    backgroundColor: "#111c31",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  metricCardSmall: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    backgroundColor: "#111c31",
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
    marginBottom: 6,
  },
  metricValueLarge: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
  },
  metricValueSmall: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
  },
  mainActionButton: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  startAction: {
    backgroundColor: "#16a34a",
  },
  finishAction: {
    backgroundColor: "#dc2626",
  },
  mainActionText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryActionButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
