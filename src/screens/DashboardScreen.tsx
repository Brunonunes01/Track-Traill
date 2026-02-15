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

  // Estados de Edição
  const [tipo, setTipo] = useState("");
  const [cidade, setCidade] = useState("");
  const [data, setData] = useState("");
  const [duracao, setDuracao] = useState("");
  const [distancia, setDistancia] = useState(""); // Novo campo

  const navigation = useNavigation<any>();
  const user = auth.currentUser;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: "#111" },
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
        // Ordena pela data (mais recente primeiro)
        const sorted = parsed.sort(
          (a, b) => new Date(b.criadoEm || b.data).getTime() - new Date(a.criadoEm || a.data).getTime()
        );
        setAtividades(sorted);
      } else {
        setAtividades([]);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const capitalize = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "Atividade";

  const openEditModal = (item: any) => {
    setEditItem(item);
    setTipo(item.tipo);
    setCidade(item.cidade);
    setData(item.data);
    setDuracao(String(item.duracao ?? 0));
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
      duracao: Number(duracao),
      distancia: Number(distancia), // Salva a edição da distância
    })
      .then(() => {
        setModalVisible(false);
        setEditItem(null);
      })
      .catch((err) => Alert.alert("Erro", err.message));
  };

  const handleDelete = (item: any) => {
    Alert.alert(
      "Excluir atividade",
      "Tem certeza? Essa ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            const activityRef = ref(database, `users/${user?.uid}/atividades/${item.id}`);
            remove(activityRef);
          },
        },
      ]
    );
  };

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      resizeMode="cover"
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.9)"]}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
            
          <View style={styles.headerRow}>
             <Text style={styles.title}>Minhas Aventuras</Text>
             <Text style={styles.countText}>{atividades.length} registro(s)</Text>
          </View>

          <FlatList
            data={atividades}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 130 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate("ActivityView", {
                    atividade: item, // Passa o objeto inteiro (com rota)
                  })
                }
              >
                <View style={styles.card}>
                    {/* Imagem de Fundo do Card */}
                    <ImageBackground
                        source={require("../../assets/images/Corrida.jpg")}
                        style={styles.cardBg}
                        imageStyle={{ borderRadius: 16 }}
                    >
                        <LinearGradient 
                            colors={['transparent', 'rgba(0,0,0,0.8)']} 
                            style={styles.cardOverlay}
                        >
                            <View style={styles.cardHeader}>
                                <Text style={styles.itemTitle}>{capitalize(item.tipo)}</Text>
                                <View style={styles.dateBadge}>
                                    <Text style={styles.dateText}>{item.data}</Text>
                                </View>
                            </View>

                            <View style={styles.statsContainer}>
                                <View style={styles.statItem}>
                                    <Ionicons name="time-outline" size={18} color="#aaa" />
                                    <Text style={styles.statValue}>{item.duracao} min</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Ionicons name="resize-outline" size={18} color="#aaa" />
                                    <Text style={styles.statValue}>{item.distancia ?? 0} km</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Ionicons name="location-outline" size={18} color="#aaa" />
                                    <Text style={styles.statValue} numberOfLines={1}>{item.cidade}</Text>
                                </View>
                            </View>

                            {/* Botões de Ação Rápidos */}
                            <View style={styles.actionRow}>
                                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.miniBtn}>
                                    <Ionicons name="create-outline" size={20} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.miniBtn, {backgroundColor: 'rgba(239, 68, 68, 0.3)'}]}>
                                    <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                                </TouchableOpacity>
                            </View>

                        </LinearGradient>
                    </ImageBackground>
                </View>
              </TouchableOpacity>
            )}
          />

          {/* MODAL DE EDIÇÃO */}
          <Modal visible={modalVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Editar Registro</Text>
                
                <Text style={styles.label}>Tipo</Text>
                <TextInput style={styles.input} value={tipo} onChangeText={setTipo} />
                
                <Text style={styles.label}>Cidade</Text>
                <TextInput style={styles.input} value={cidade} onChangeText={setCidade} />
                
                <View style={{flexDirection: 'row', gap: 10}}>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Data</Text>
                        <TextInput style={styles.input} value={data} onChangeText={setData} />
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Duração (min)</Text>
                        <TextInput style={styles.input} value={duracao} keyboardType="numeric" onChangeText={setDuracao} />
                    </View>
                </View>

                 <Text style={styles.label}>Distância (km)</Text>
                 <TextInput style={styles.input} value={distancia} keyboardType="numeric" onChangeText={setDistancia} />

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                    <Text style={styles.btnTextConfig}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                    <Text style={[styles.btnTextConfig, {color: '#fff'}]}>Salvar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* BARRA INFERIOR FLUTUANTE */}
          <View style={styles.bottomBar}>
            <TouchableOpacity onPress={() => navigation.navigate("Planos")}>
              <Ionicons name="trophy-outline" size={28} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.addBtnCircle} onPress={() => navigation.navigate("Atividades")}>
                <Ionicons name="add" size={36} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Perfil")}>
              <Ionicons name="person-outline" size={28} color="#666" />
            </TouchableOpacity>
          </View>

        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  countText: { color: '#aaa', fontSize: 14 },
  
  card: { marginBottom: 20, borderRadius: 16, overflow: 'hidden', elevation: 5 },
  cardBg: { height: 180, justifyContent: 'flex-end' },
  cardOverlay: { padding: 15, height: '100%', justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  itemTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 5 },
  dateBadge: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  dateText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { color: '#fff', fontWeight: '600', fontSize: 14, maxWidth: 80 },

  actionRow: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
  miniBtn: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 20 },

  bottomBar: { position: "absolute", bottom: 30, left: 20, right: 20, height: 70, backgroundColor: "#fff", borderRadius: 35, flexDirection: "row", justifyContent: "space-around", alignItems: "center", elevation: 10 },
  addBtnCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#2563eb", justifyContent: 'center', alignItems: 'center', top: -20, borderWidth: 4, borderColor: '#121212' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", backgroundColor: "#1e1e1e", borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: '#bbb', marginBottom: 5, fontSize: 14 },
  input: { backgroundColor: '#333', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 15 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveButton: { flex: 1, backgroundColor: '#2563eb', padding: 15, borderRadius: 10, alignItems: 'center' },
  cancelButton: { flex: 1, backgroundColor: '#444', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnTextConfig: { fontWeight: 'bold', color: '#ccc' }
});