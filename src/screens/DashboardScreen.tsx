import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { onValue, ref, remove, update } from "firebase/database";
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  FlatList,
  ImageBackground,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, database } from "../../services/connectionFirebase";

export default function DashboardScreen() {
  const [atividades, setAtividades] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const [tipo, setTipo] = useState("");
  const [cidade, setCidade] = useState("");
  const [data, setData] = useState("");
  const [duracao, setDuracao] = useState("");

  const navigation = useNavigation<any>();
  const user = auth.currentUser;

  /* Header Preto */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: "#111",
      },
      headerTintColor: "#fff",
      headerTitle: "Painel Principal",
    });
  }, [navigation]);

  useEffect(() => {
    if (!user) return;
    const activitiesRef = ref(database, `users/${user.uid}/atividades`);
    const unsubscribe = onValue(activitiesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        const sorted = parsed.sort(
          (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
        );
        setAtividades(sorted);
      } else {
        setAtividades([]);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const capitalize = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

  const getHoraLogin = () => {
    const raw = auth.currentUser?.metadata?.lastSignInTime;
    if (!raw) return "--:--";
    const date = new Date(raw);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getDataHoje = () => new Date().toLocaleDateString("pt-BR");

  const openEditModal = (item: any) => {
    setEditItem(item);
    setTipo(item.tipo);
    setCidade(item.cidade);
    setData(item.data);
    setDuracao(String(item.duracao ?? 0));
    setModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editItem) return;
    const activityRef = ref(database, `users/${user?.uid}/atividades/${editItem.id}`);
    update(activityRef, {
      tipo,
      cidade,
      data,
      duracao: Number(duracao),
    })
      .then(() => {
        setModalVisible(false);
        setEditItem(null);
      })
      .catch((err) => Alert.alert("Erro", err.message));
  };

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      resizeMode="cover"
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>⏱ Último login — {getHoraLogin()}</Text>
            <Text style={styles.summaryText}>📅 Hoje — {getDataHoje()}</Text>
          </View>

          <Text style={styles.title}>Minhas Atividades</Text>
          <Text style={styles.subtitle}>Agendamentos</Text>

          <FlatList
            data={atividades}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 130 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("ActivityView", {
                    atividade: { ...item, tipo: capitalize(item.tipo) },
                  })
                }
              >
                <ImageBackground
                  source={require("../../assets/images/Corrida.jpg")}
                  resizeMode="cover"
                  style={styles.card}
                  imageStyle={styles.cardImage}
                >
                  <View style={styles.cardOverlay}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{capitalize(item.tipo)}</Text>
                      <View style={styles.infoRow}>
                        <Ionicons name="location-outline" size={16} color="#fff" />
                        <Text style={styles.itemInfo}>{item.cidade}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={16} color="#fff" />
                        <Text style={styles.itemInfo}>{item.data}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={16} color="#fff" />
                        <Text style={styles.itemInfo}>{item.duracao ?? 0} min</Text>
                      </View>

                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => openEditModal(item)}
                        >
                          <Ionicons name="create-outline" size={20} color="#fff" />
                          <Text style={styles.actionText}>Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: "#FF4D4F" }]}
                          onPress={() => {
                            Alert.alert(
                              "Excluir atividade",
                              "Deseja realmente excluir esta atividade?",
                              [
                                { text: "Cancelar", style: "cancel" },
                                {
                                  text: "Excluir",
                                  style: "destructive",
                                  onPress: () => {
                                    const activityRef = ref(
                                      database,
                                      `users/${user?.uid}/atividades/${item.id}`
                                    );
                                    remove(activityRef);
                                  },
                                },
                              ]
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={20} color="#fff" />
                          <Text style={styles.actionText}>Excluir</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color="rgba(255,255,255,0.8)"
                    />
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            )}
          />

          {/* MODAL DE EDIÇÃO */}
          <Modal visible={modalVisible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 10 }}>
                  Editar Atividade
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tipo"
                  value={tipo}
                  onChangeText={setTipo}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Cidade"
                  value={cidade}
                  onChangeText={setCidade}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Data"
                  value={data}
                  onChangeText={setData}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Duração (min)"
                  value={duracao}
                  keyboardType="numeric"
                  onChangeText={setDuracao}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Salvar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                    <Text style={{ color: "#000", fontWeight: "700" }}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate("Planos")}
            >
              <Ionicons name="document-text-outline" size={26} color="#6c6c6c" />
            </TouchableOpacity>

            <View style={styles.addButtonWrapper}>
              <View style={styles.whiteBorder}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => navigation.navigate("Atividades")}
                >
                  <Ionicons name="add" size={32} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate("Perfil")}
            >
              <Ionicons name="person-outline" size={26} color="#6c6c6c" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  summary: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, marginTop: -40 },
  summaryText: { color: "#dcdcff", fontSize: 14, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 16, color: "#b2b2c9", textAlign: "center", marginBottom: 20 },
  card: { height: 170, borderRadius: 22, marginBottom: 16, overflow: "hidden" },
  cardImage: { borderRadius: 22, opacity: 0.7 },
  cardOverlay: { flex: 1, padding: 20, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  itemTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  itemInfo: { color: "#fff", fontSize: 14 },
  actionRow: { flexDirection: "row", marginTop: 12, gap: 10 },
  actionButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#2F66F6", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, gap: 4 },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  bottomBar: { position: "absolute", bottom: 20, left: 20, right: 20, height: 70, backgroundColor: "#fff", borderRadius: 35, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 40, elevation: 8 },
  iconButton: { alignItems: "center", justifyContent: "center" },
  addButtonWrapper: { position: "absolute", left: "50%", marginLeft: -47.5, bottom: 22, width: 95, height: 95, borderRadius: 47.5, justifyContent: "center", alignItems: "center" },
  whiteBorder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  addButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#2F66F6", alignItems: "center", justifyContent: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "85%", backgroundColor: "#fff", borderRadius: 20, padding: 20 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 10 },
  saveButton: { flex: 1, backgroundColor: "#2F66F6", padding: 10, borderRadius: 8, alignItems: "center", marginRight: 5 },
  cancelButton: { flex: 1, backgroundColor: "#ddd", padding: 10, borderRadius: 8, alignItems: "center", marginLeft: 5 },
});
