import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/connectionFirebase";
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

export default function AtividadesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
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
    () =>
      (session?.points || []).map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [session]
  );

  const durationSeconds = useMemo(() => getSessionDurationSeconds(session), [session]);
  const averageSpeed = useMemo(() => getAverageSpeedKmh(session), [session]);
  const isRecording = session?.status === "recording";

  const stopForegroundWatch = () => {
    if (foregroundSubscription.current) {
      foregroundSubscription.current.remove();
      foregroundSubscription.current = null;
    }
  };

  const startForegroundWatch = useCallback(async () => {
    stopForegroundWatch();

    foregroundSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 4000,
        distanceInterval: 10,
      },
      async (location) => {
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
      }
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const foregroundPermission = await Location.requestForegroundPermissionsAsync();
        if (foregroundPermission.status !== "granted") {
          setStatusMessage("Permissão de localização necessária para gravar atividade.");
          setLoadingSession(false);
          return;
        }

        const current = await Location.getCurrentPositionAsync({});
        if (!mounted) return;

        const startFocus = rotaGuia?.startPoint || current.coords;
        mapRef.current?.animateCamera({ center: startFocus, zoom: 16 });

        const active = await getActiveSession();
        if (!mounted) return;

        if (active && active.status !== "finished") {
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
      } catch {
        setStatusMessage("Falha ao obter GPS inicial.");
      } finally {
        if (mounted) {
          setLoadingSession(false);
        }
      }
    };

    bootstrap();

    syncInterval.current = setInterval(async () => {
      const active = await getActiveSession();
      if (active && active.status !== "finished") {
        setSession(active);
      }
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
      const startPoint = trackedPath[trackedPath.length - 1] || {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      const response = await startActivityTracking({
        userId: user.uid,
        activityType,
        initialPoint: startPoint,
      });

      setSession(response.session);

      if (response.mode === "foreground") {
        await startForegroundWatch();
        setStatusMessage("Rastreando em foreground. Mantenha o app aberto para melhor precisão.");
      } else {
        stopForegroundWatch();
        setStatusMessage("Rastreando em background. Você pode bloquear a tela.");
      }
    } catch (error: any) {
      Alert.alert("Não foi possível iniciar", error?.message || "Verifique permissões de localização.");
    }
  };

  const handlePause = async () => {
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
  };

  const handleResume = async () => {
    try {
      const response = await resumeActivityTracking();
      if (!response) return;

      setSession(response.session);
      if (response.mode === "foreground") {
        await startForegroundWatch();
        setStatusMessage("Retomado em foreground.");
      } else {
        stopForegroundWatch();
        setStatusMessage("Retomado em background.");
      }
    } catch (error: any) {
      Alert.alert("Erro ao retomar", error?.message || "Não foi possível retomar a atividade.");
    }
  };

  const handleFinish = async () => {
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
                await discardActiveSession();
                setSession(null);
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

      mapRef.current?.animateCamera(
        {
          center: {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          },
          zoom: 17,
        },
        { duration: 500 }
      );
    } catch {
      Alert.alert("Localização indisponível", "Não foi possível centralizar no local atual.");
    }
  };

  if (loadingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
        <Text style={styles.loadingText}>Preparando rastreamento GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {rotaGuia?.rotaCompleta ? (
          <Polyline
            coordinates={rotaGuia.rotaCompleta}
            strokeColor="rgba(255, 215, 0, 0.35)"
            strokeWidth={7}
          />
        ) : null}

        {trackedPath.length > 1 ? (
          <Polyline coordinates={trackedPath} strokeColor="#ef4444" strokeWidth={5} />
        ) : null}
      </MapView>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={handleExit}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.titleBadge}>
          <Text style={styles.titleText}>
            {rotaGuia ? `Guiando: ${rotaGuia.titulo}` : "Rastreamento GPS"}
          </Text>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.currentLocationButton, { top: insets.top + 86 }]}
        onPress={handleCenterOnCurrentLocation}
      >
        <Ionicons name="locate" size={22} color="#fff" />
      </TouchableOpacity>

      {!session || session.status === "finished" ? (
        <View style={styles.activityTypeBar}>
          {ACTIVITY_OPTIONS.map((option) => {
            const selected = activityType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.activityChip, selected ? styles.activityChipSelected : null]}
                onPress={() => setActivityType(option.value)}
              >
                <Text style={[styles.activityChipText, selected ? styles.activityChipTextSelected : null]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={styles.bottomPanel}>
        <ImageBackground
          source={require("../../assets/images/Azulao.png")}
          style={{ flex: 1 }}
          imageStyle={{ borderTopLeftRadius: 30, borderTopRightRadius: 30 }}
        >
          <LinearGradient colors={["rgba(0,0,0,0.88)", "rgba(0,0,0,0.98)"]} style={styles.panelOverlay}>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>TEMPO</Text>
                <Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>DISTÂNCIA</Text>
                <Text style={styles.statValue}>
                  {session?.distanceKm.toFixed(2) || "0.00"} <Text style={{ fontSize: 16 }}>km</Text>
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>MÉDIA</Text>
                <Text style={styles.statValue}>
                  {averageSpeed.toFixed(1)} <Text style={{ fontSize: 16 }}>km/h</Text>
                </Text>
              </View>
            </View>

            <View style={styles.controlsRow}>
              {!session || session.status === "finished" ? (
                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: "#22c55e", flex: 1 }]}
                  onPress={handleStart}
                >
                  <Ionicons name="play" size={26} color="#fff" />
                  <Text style={styles.controlBtnText}>INICIAR</Text>
                </TouchableOpacity>
              ) : isRecording ? (
                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: "#f59e0b", flex: 1 }]}
                  onPress={handlePause}
                >
                  <Ionicons name="pause" size={26} color="#fff" />
                  <Text style={styles.controlBtnText}>PAUSAR</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: "#22c55e", flex: 1 }]}
                  onPress={handleResume}
                >
                  <Ionicons name="play" size={26} color="#fff" />
                  <Text style={styles.controlBtnText}>RETOMAR</Text>
                </TouchableOpacity>
              )}

              {session ? (
                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: "#ef4444", marginLeft: 10 }]}
                  onPress={handleFinish}
                >
                  <Ionicons name="stop" size={26} color="#fff" />
                </TouchableOpacity>
              ) : null}
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  map: { ...StyleSheet.absoluteFillObject },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
  },
  topBar: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#333",
  },
  titleBadge: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    marginLeft: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  titleText: {
    color: "#ffd700",
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  statusText: {
    color: "#d1d5db",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  activityTypeBar: {
    position: "absolute",
    top: 130,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  activityChip: {
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activityChipSelected: {
    backgroundColor: "#ffd700",
    borderColor: "#ffd700",
  },
  activityChipText: {
    color: "#d1d5db",
    fontWeight: "700",
    fontSize: 12,
  },
  activityChipTextSelected: {
    color: "#000",
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 240,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 20,
  },
  panelOverlay: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    justifyContent: "space-between",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  statBox: { flex: 1, alignItems: "center" },
  statLabel: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  statValue: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  divider: { width: 1, height: 48, backgroundColor: "#333", marginHorizontal: 10 },
  controlsRow: { flexDirection: "row", justifyContent: "space-between" },
  controlBtn: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    paddingHorizontal: 18,
  },
  controlBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold", marginLeft: 8 },
  currentLocationButton: {
    position: "absolute",
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    elevation: 7,
  },
});
