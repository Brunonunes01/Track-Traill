import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { onValue, ref, remove, update } from "firebase/database";
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  FlatList,
  ImageBackground,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, database } from "../../services/connectionFirebase";
import WeatherCard from "../components/WeatherCard";

type WeatherCoordinates = {
  latitude: number;
  longitude: number;
};

export default function DashboardScreen() {
  const [atividades, setAtividades] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const [tipo, setTipo] = useState("");
  const [cidade, setCidade] = useState("");
  const [data, setData] = useState("");
  const [duracao, setDuracao] = useState("");
  const [distancia, setDistancia] = useState("");

  const [weatherCoordinates, setWeatherCoordinates] = useState<WeatherCoordinates | null>(null);
  const [weatherSource, setWeatherSource] = useState<"route" | "gps" | "none">("none");
  const [resolvingWeatherCoordinates, setResolvingWeatherCoordinates] = useState(true);

  const navigation = useNavigation<any>();
  const user = auth.currentUser;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: "#0b1220" },
      headerTintColor: "#fff",
      headerTitle: "Histórico de Atividades",
    });
  }, [navigation]);

  useEffect(() => {
    if (!user) return;

    const activitiesRef = ref(database, `users/${user.uid}/atividades`);
    const unsubscribe = onValue(activitiesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setAtividades([]);
        return;
      }

      const parsed = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
      const sorted = parsed.sort(
        (a, b) => new Date(b.criadoEm || b.data).getTime() - new Date(a.criadoEm || a.data).getTime()
      );
      setAtividades(sorted);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const routeAnchor = atividades.find((item) => {
      const firstPoint = item?.rota?.[0];
      return (
        Array.isArray(item?.rota) &&
        item.rota.length > 0 &&
        typeof firstPoint?.latitude === "number" &&
        typeof firstPoint?.longitude === "number"
      );
    })?.rota?.[0];

    if (routeAnchor) {
      setWeatherCoordinates({ latitude: routeAnchor.latitude, longitude: routeAnchor.longitude });
      setWeatherSource("route");
      setResolvingWeatherCoordinates(false);
      return;
    }

    const resolveCurrentLocation = async () => {
      try {
        setResolvingWeatherCoordinates(true);
        const currentPermission = await Location.getForegroundPermissionsAsync();
        const permission =
          currentPermission.status === "granted"
            ? currentPermission
            : await Location.requestForegroundPermissionsAsync();

        if (permission.status !== "granted") {
          if (!cancelled) {
            setWeatherCoordinates(null);
            setWeatherSource("none");
          }
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setWeatherCoordinates({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
          setWeatherSource("gps");
        }
      } catch {
        if (!cancelled) {
          setWeatherCoordinates(null);
          setWeatherSource("none");
        }
      } finally {
        if (!cancelled) {
          setResolvingWeatherCoordinates(false);
        }
      }
    };

    resolveCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, [atividades]);

  const capitalize = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "Atividade";

  const formatarDuracao = (totalSegundos: number) => {
    if (!totalSegundos) return "00:00";
    const min = Math.floor(totalSegundos / 60);
    const seg = Math.floor(totalSegundos % 60);
    return `${min < 10 ? "0" : ""}${min}:${seg < 10 ? "0" : ""}${seg}`;
  };

  const openEditModal = (item: any) => {
    setEditItem(item);
    setTipo(String(item.tipo || ""));
    setCidade(String(item.cidade || ""));
    setData(String(item.data || ""));
    setDuracao(String(item.duracao ? Math.floor(item.duracao / 60) : 0));
    setDistancia(String(item.distancia ?? 0));
    setModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editItem) return;

    const activityRef = ref(database, `users/${user?.uid}/atividades/${editItem.id}`);
    update(activityRef, {
      tipo,
      cidade,
      data,
      duracao: Number(duracao || 0) * 60,
      distancia: Number(distancia || 0),
    })
      .then(() => {
        setModalVisible(false);
        setEditItem(null);
      })
      .catch((err) => Alert.alert("Erro", err.message));
  };

  const handleDelete = (item: any) => {
    Alert.alert("Excluir atividade", "Tem certeza? Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          const activityRef = ref(database, `users/${user?.uid}/atividades/${item.id}`);
          remove(activityRef);
        },
      },
    ]);
  };

  const renderActivityCard = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.cardTouchable}
        onPress={() => navigation.navigate("ActivityView", { atividade: item })}
      >
        <ImageBackground
          source={require("../../assets/images/Corrida.jpg")}
          style={styles.cardBg}
          imageStyle={styles.cardImage}
        >
          <LinearGradient colors={["rgba(2,6,23,0.1)", "rgba(2,6,23,0.82)"]} style={styles.cardOverlay}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.itemTitle}>{capitalize(item.tipo)}</Text>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{String(item.data || "Sem data")}</Text>
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color="#cbd5e1" />
                <Text style={styles.statValue}>{formatarDuracao(Number(item.duracao || 0))}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="resize-outline" size={16} color="#cbd5e1" />
                <Text style={styles.statValue}>{Number(item.distancia || 0).toFixed(2)} km</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="location-outline" size={16} color="#cbd5e1" />
                <Text numberOfLines={1} style={styles.statValue}>{String(item.cidade || "Não informado")}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity onPress={() => openEditModal(item)} style={styles.miniBtn}>
                <Ionicons name="create-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.miniBtn, styles.deleteBtn]}>
                <Ionicons name="trash-outline" size={18} color="#fecaca" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Minhas Aventuras</Text>
          <Text style={styles.countText}>{atividades.length} registro(s)</Text>
        </View>
      </View>

      <View style={styles.weatherSection}>
        <Text style={styles.weatherTitle}>Condição do tempo</Text>

        {weatherCoordinates ? (
          <WeatherCard latitude={weatherCoordinates.latitude} longitude={weatherCoordinates.longitude} />
        ) : (
          <View style={styles.weatherFallback}>
            <Text style={styles.weatherFallbackText}>
              {resolvingWeatherCoordinates
                ? "Localizando coordenadas para carregar o clima..."
                : "Clima indisponível no momento. Permita localização ou registre uma rota para ver o clima aqui."}
            </Text>
          </View>
        )}

        {weatherSource !== "none" && (
          <Text style={styles.weatherSourceText}>
            Fonte: {weatherSource === "route" ? "última rota registrada" : "localização atual"}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={require("../../assets/images/Azulao.png")} resizeMode="cover" style={styles.background}>
        <LinearGradient colors={["rgba(2,6,23,0.78)", "rgba(2,6,23,0.92)"]} style={styles.overlay}>
          <FlatList
            data={atividades}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={listHeader}
            renderItem={renderActivityCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="trail-sign-outline" size={34} color="#7dd3fc" />
                <Text style={styles.emptyTitle}>Nenhuma atividade registrada</Text>
                <Text style={styles.emptyText}>
                  Inicie uma atividade para começar a construir seu histórico.
                </Text>
              </View>
            }
          />

          <Modal visible={modalVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Editar registro</Text>

                <Text style={styles.label}>Tipo</Text>
                <TextInput style={styles.input} value={tipo} onChangeText={setTipo} placeholderTextColor="#94a3b8" />

                <Text style={styles.label}>Cidade</Text>
                <TextInput style={styles.input} value={cidade} onChangeText={setCidade} placeholderTextColor="#94a3b8" />

                <View style={styles.inputRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.label}>Data</Text>
                    <TextInput style={styles.input} value={data} onChangeText={setData} placeholderTextColor="#94a3b8" />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.label}>Duração (min)</Text>
                    <TextInput
                      style={styles.input}
                      value={duracao}
                      keyboardType="numeric"
                      onChangeText={setDuracao}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Distância (km)</Text>
                <TextInput
                  style={styles.input}
                  value={distancia}
                  keyboardType="numeric"
                  onChangeText={setDistancia}
                  placeholderTextColor="#94a3b8"
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                    <Text style={styles.btnTextConfig}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                    <Text style={[styles.btnTextConfig, { color: "#fff" }]}>Salvar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </LinearGradient>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020617" },
  background: { flex: 1 },
  overlay: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
  headerRow: { marginBottom: 14 },
  title: { fontSize: 26, fontWeight: "800", color: "#f8fafc" },
  countText: { color: "#94a3b8", fontSize: 13, marginTop: 4 },

  weatherSection: { marginBottom: 12 },
  weatherTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  weatherFallback: {
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  weatherFallbackText: { color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
  weatherSourceText: { color: "#94a3b8", fontSize: 12, marginBottom: 4 },

  cardTouchable: { marginBottom: 14 },
  cardBg: { height: 178, justifyContent: "flex-end" },
  cardImage: { borderRadius: 16 },
  cardOverlay: {
    borderRadius: 16,
    padding: 14,
    height: "100%",
    justifyContent: "space-between",
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textTransform: "capitalize",
    textShadowColor: "rgba(2,6,23,0.9)",
    textShadowRadius: 8,
  },
  dateBadge: {
    backgroundColor: "rgba(15,23,42,0.7)",
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dateText: { color: "#e0f2fe", fontSize: 11, fontWeight: "700" },

  statsContainer: {
    backgroundColor: "rgba(2,6,23,0.58)",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statValue: { color: "#f1f5f9", fontWeight: "700", fontSize: 13, flex: 1 },

  actionRow: { position: "absolute", top: 10, right: 10, flexDirection: "row", gap: 8 },
  miniBtn: {
    backgroundColor: "rgba(2,6,23,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    padding: 7,
    borderRadius: 999,
  },
  deleteBtn: {
    backgroundColor: "rgba(127, 29, 29, 0.45)",
    borderColor: "rgba(248,113,113,0.45)",
  },

  emptyState: {
    marginTop: 48,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 10,
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 6,
    color: "#94a3b8",
    textAlign: "center",
    fontSize: 13,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  label: { color: "#cbd5e1", marginBottom: 6, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: "rgba(30,41,59,0.72)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.32)",
    color: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  inputRow: { flexDirection: "row", gap: 10 },
  inputCol: { flex: 1 },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 6 },
  saveButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "rgba(148,163,184,0.2)",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  btnTextConfig: { fontWeight: "800", color: "#cbd5e1" },
});
