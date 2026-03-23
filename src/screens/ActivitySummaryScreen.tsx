import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityType,
  ActiveActivitySession,
  saveFinishedSessionAsActivity,
  discardActiveSession,
  formatDuration,
  getActiveSession,
  getAverageSpeedKmh,
  getSessionDurationSeconds,
  saveFinishedSessionAsRoute,
} from "../services/activityTrackingService";
import { createActivitySharePost } from "../../services/communityService";
import { FALLBACK_REGION, getRegionWithFallback, toCoordinateArray } from "../utils/geo";

const ACTIVITY_OPTIONS: { label: string; value: ActivityType }[] = [
  { label: "Bike", value: "bike" },
  { label: "Corrida", value: "corrida" },
  { label: "Caminhada", value: "caminhada" },
  { label: "Trilha", value: "trilha" },
];

const getActivityLabel = (value: ActivityType) =>
  ACTIVITY_OPTIONS.find((item) => item.value === value)?.label || value;

type ActivitySummaryScreenProps = {
  navigation?: any;
  route?: any;
};

export default function ActivitySummaryScreen(props: ActivitySummaryScreenProps) {
  const hookNavigation = useNavigation<any>();
  const hookRoute = useRoute<any>();
  const navigation = props.navigation || hookNavigation;
  const route = props.route || hookRoute;
  const insets = useSafeAreaInsets();
  const sessionFromParams = route.params?.session as ActiveActivitySession | undefined;

  const [session, setSession] = useState<ActiveActivitySession | null>(sessionFromParams || null);
  const [loading, setLoading] = useState(!sessionFromParams);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [description, setDescription] = useState("");
  const [caption, setCaption] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>(
    sessionFromParams?.activityType || "trilha"
  );

  useEffect(() => {
    if (sessionFromParams) {
      setActivityType(sessionFromParams.activityType);
      return;
    }

    let mounted = true;
    const loadSession = async () => {
      try {
        const active = await getActiveSession();
        if (!mounted) return;

        setSession(active);
        if (active) {
          setActivityType(active.activityType);
        }
      } catch (error: any) {
        console.warn("[activity-summary] loadSession failed:", error?.message || String(error));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, [sessionFromParams]);

  const durationSeconds = useMemo(() => getSessionDurationSeconds(session), [session]);
  const averageSpeed = useMemo(() => getAverageSpeedKmh(session), [session]);

  const mapPoints = useMemo(
    () => toCoordinateArray(session?.points || []),
    [session]
  );

  const initialRegion = useMemo(() => {
    const firstPoint = mapPoints[0];
    return getRegionWithFallback(firstPoint, FALLBACK_REGION, {
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }, [mapPoints]);

  const handleDiscard = async () => {
    try {
      await discardActiveSession();
      navigation.navigate("MainTabs", { screen: "Home" });
    } catch (error: any) {
      console.warn("[activity-summary] handleDiscard failed:", error?.message || String(error));
      Alert.alert("Erro", "Não foi possível descartar a atividade agora.");
    }
  };

  const handleSaveRoute = async () => {
    if (!session) {
      Alert.alert("Erro", "Nenhuma atividade finalizada encontrada.");
      return;
    }

    try {
      setSaving(true);

      const response = await saveFinishedSessionAsRoute(session, {
        routeName,
        description,
        activityType,
      });

      Alert.alert(
        "Rota salva com sucesso",
        `Atividade: ${response.activityId}\nRota: ${response.routeId}\nA rota foi enviada para análise.`
      );

      navigation.navigate("MainTabs", { screen: "Home" });
    } catch (error: any) {
      Alert.alert("Não foi possível salvar", error?.message || "Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleShareOnly = async () => {
    if (!session) {
      Alert.alert("Erro", "Nenhuma atividade finalizada encontrada.");
      return;
    }

    try {
      setSharing(true);

      const savedActivity = await saveFinishedSessionAsActivity(session, activityType);
      await createActivitySharePost({
        userId: session.userId,
        session,
        activityId: savedActivity.activityId,
        routeId: null,
        routeName: routeName.trim() || null,
        caption,
        activityType,
      });

      await discardActiveSession();
      Alert.alert("Compartilhado", "Sua atividade foi compartilhada com seus amigos.");
      navigation.navigate("Ajuda");
    } catch (error: any) {
      Alert.alert("Não foi possível compartilhar", error?.message || "Tente novamente.");
    } finally {
      setSharing(false);
    }
  };

  const handleSaveAndShare = async () => {
    if (!session) {
      Alert.alert("Erro", "Nenhuma atividade finalizada encontrada.");
      return;
    }

    if (!routeName.trim()) {
      Alert.alert("Nome da rota obrigatório", "Informe um nome para salvar e compartilhar.");
      return;
    }

    try {
      setSaving(true);
      setSharing(true);

      const savedRoute = await saveFinishedSessionAsRoute(session, {
        routeName,
        description,
        activityType,
      });

      await createActivitySharePost({
        userId: session.userId,
        session,
        activityId: savedRoute.activityId,
        routeId: savedRoute.routeId,
        routeName: routeName.trim(),
        caption,
        activityType,
      });

      Alert.alert(
        "Rota salva e compartilhada",
        "Sua atividade já está no feed dos amigos com acesso à rota."
      );
      navigation.navigate("Ajuda");
    } catch (error: any) {
      Alert.alert("Não foi possível concluir", error?.message || "Tente novamente.");
    } finally {
      setSaving(false);
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ffd700" />
        <Text style={styles.centeredText}>Carregando resumo da atividade...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredText}>Nenhuma atividade finalizada disponível.</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
        >
          {mapPoints.length > 0 ? (
            <Marker coordinate={mapPoints[0]} title="Início">
              <Ionicons name="location" size={36} color="#22c55e" />
            </Marker>
          ) : null}

          {mapPoints.length > 1 ? (
            <Marker coordinate={mapPoints[mapPoints.length - 1]} title="Fim">
              <Ionicons name="flag" size={36} color="#ef4444" />
            </Marker>
          ) : null}

          {mapPoints.length > 1 ? (
            <Polyline coordinates={mapPoints} strokeColor="#ffd700" strokeWidth={5} />
          ) : null}
        </MapView>

        <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Resumo da atividade</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Duração</Text>
            <Text style={styles.metricValue}>{formatDuration(durationSeconds)}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Distância</Text>
            <Text style={styles.metricValue}>{session.distanceKm.toFixed(2)} km</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Velocidade média</Text>
            <Text style={styles.metricValue}>{averageSpeed.toFixed(1)} km/h</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Salvar como rota</Text>

        <Text style={styles.label}>Nome da rota</Text>
        <TextInput
          style={styles.input}
          value={routeName}
          onChangeText={setRouteName}
          placeholder="Ex: Trilha da Serra Norte"
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Tipo da atividade</Text>
        <View style={styles.chipsRow}>
          {ACTIVITY_OPTIONS.map((option) => {
            const selected = activityType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.chip, selected ? styles.chipActive : null]}
                onPress={() => setActivityType(option.value)}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Descrição (opcional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          placeholder="Conte um pouco sobre terreno, pontos de referência e dicas da rota."
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Legenda para compartilhar (opcional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={caption}
          onChangeText={setCaption}
          multiline
          textAlignVertical="top"
          placeholder="Ex: Trilha incrível hoje cedo, trecho final com subida forte."
          placeholderTextColor="#6b7280"
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Tipo original: {getActivityLabel(session.activityType)}</Text>
          <Text style={styles.infoText}>Pontos GPS: {session.points.length}</Text>
          <Text style={styles.infoText}>Status: {session.status}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveRoute} disabled={saving || sharing}>
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#000" />
              <Text style={styles.primaryBtnText}>Salvar rota</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoBtn} onPress={handleShareOnly} disabled={saving || sharing}>
          {sharing && !saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.infoBtnText}>Compartilhar com amigos</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.successBtn} onPress={handleSaveAndShare} disabled={saving || sharing}>
          {saving && sharing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark-done-outline" size={18} color="#000" />
              <Text style={styles.successBtnText}>Salvar e compartilhar</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleDiscard} disabled={saving || sharing}>
          <Ionicons name="trash-outline" size={18} color="#d1d5db" />
          <Text style={styles.secondaryBtnText}>Descartar atividade</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  mapContainer: {
    height: "38%",
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    top: 46,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.65)",
    padding: 10,
    borderRadius: 50,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 10,
  },
  metricLabel: {
    color: "#9ca3af",
    fontSize: 11,
    marginBottom: 6,
  },
  metricValue: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  label: {
    color: "#e5e7eb",
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMultiline: {
    minHeight: 90,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#111827",
  },
  chipActive: {
    backgroundColor: "#ffd700",
    borderColor: "#ffd700",
  },
  chipText: {
    color: "#d1d5db",
    fontWeight: "700",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#000",
  },
  infoBox: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 10,
    marginTop: 12,
    gap: 4,
  },
  infoText: {
    color: "#d1d5db",
    fontSize: 12,
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#ffd700",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: {
    color: "#000",
    fontWeight: "800",
  },
  infoBtn: {
    marginTop: 10,
    backgroundColor: "#1e4db7",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  infoBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  successBtn: {
    marginTop: 10,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  successBtnText: {
    color: "#000",
    fontWeight: "800",
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: {
    color: "#d1d5db",
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    padding: 24,
  },
  centeredText: {
    color: "#fff",
    marginTop: 10,
    textAlign: "center",
  },
});
