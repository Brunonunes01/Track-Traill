import { Ionicons } from "@expo/vector-icons";
import { push, ref, set } from "firebase/database";
import React, { useState } from "react";
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, database } from "../../services/connectionFirebase";
import MapTracker from "../components/MapTracker"; // Importamos o componente de GPS

export default function AtividadesScreen({ navigation }: any) {
  const [isTracking, setIsTracking] = useState(false);
  const [rota, setRota] = useState<any[]>([]); // Guarda as coordenadas do mapa

  const [tipo, setTipo] = useState("");
  const [cidade, setCidade] = useState("");
  const [data, setData] = useState(() => {
    // Preenche com a data de hoje por defeito
    const today = new Date();
    return `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth()+1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  });
  const [duracao, setDuracao] = useState("");
  const [distancia, setDistancia] = useState("");

  // Função chamada quando o utilizador finaliza a trilha no MapTracker
  const handleFinishTracking = (trackerData: { coordinates: any[]; distance: number; duration: number }) => {
    setRota(trackerData.coordinates);
    setDistancia(trackerData.distance.toString());
    setDuracao(trackerData.duration.toString());
    setIsTracking(false);
    Alert.alert("Trilha Concluída", "Dados do GPS recolhidos! Preencha o tipo e o local para guardar.");
  };

  const handleSaveActivity = async () => {
    if (!tipo || !cidade || !data || !duracao || !distancia) {
      Alert.alert("Atenção", "Por favor, preencha todos os campos.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Erro", "Utilizador não autenticado.");
      return;
    }

    try {
      const activitiesRef = ref(database, `users/${user.uid}/atividades`);
      const newActivityRef = push(activitiesRef);
      
      // Guarda os dados juntamente com o array da rota do GPS
      await set(newActivityRef, {
        tipo,
        cidade,
        data,
        duracao: Number(duracao),
        distancia: Number(distancia),
        rota: rota.length > 0 ? rota : null, // Guarda as coordenadas
        criadoEm: new Date().toISOString(),
      });

      Alert.alert("Sucesso!", "A sua atividade foi guardada com sucesso.");
      navigation.goBack();
      
    } catch (error: any) {
      Alert.alert("Erro", "Não foi possível guardar a atividade: " + error.message);
    }
  };

  const webInputExtraStyle = Platform.OS === "web" ? { outlineWidth: 0 } : {};

  // Se o modo de rastreamento estiver ativo, mostra apenas o MapTracker
  if (isTracking) {
    return (
      <MapTracker 
        onFinish={handleFinishTracking} 
        onCancel={() => setIsTracking(false)} 
      />
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%", flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title}>Nova Atividade</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* BOTÃO PARA ABRIR O GPS */}
            <TouchableOpacity style={styles.gpsButton} onPress={() => setIsTracking(true)}>
              <Ionicons name="map-outline" size={24} color="#fff" />
              <Text style={styles.gpsButtonText}>
                {rota.length > 0 ? "Refazer Rastreio GPS" : "Iniciar Rastreio GPS"}
              </Text>
            </TouchableOpacity>

            {rota.length > 0 && (
              <Text style={styles.successText}>✓ Rota de {distancia} km gravada!</Text>
            )}

            <View style={styles.formContainer}>
              <Text style={styles.label}>Desporto (Ex: Ciclismo, Corrida)</Text>
              <TextInput
                style={[styles.input, webInputExtraStyle as any]}
                placeholder="Qual foi a atividade?"
                placeholderTextColor="#aaa"
                value={tipo}
                onChangeText={setTipo}
              />

              <Text style={styles.label}>Local / Cidade</Text>
              <TextInput
                style={[styles.input, webInputExtraStyle as any]}
                placeholder="Onde foi?"
                placeholderTextColor="#aaa"
                value={cidade}
                onChangeText={setCidade}
              />

              <Text style={styles.label}>Data (DD/MM/AAAA)</Text>
              <TextInput
                style={[styles.input, webInputExtraStyle as any]}
                placeholder="Quando aconteceu?"
                placeholderTextColor="#aaa"
                value={data}
                onChangeText={setData}
                keyboardType="numbers-and-punctuation"
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Duração (min)</Text>
                  <TextInput
                    style={[styles.input, webInputExtraStyle as any]}
                    placeholder="Ex: 45"
                    placeholderTextColor="#aaa"
                    value={duracao}
                    onChangeText={setDuracao}
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Distância (km)</Text>
                  <TextInput
                    style={[styles.input, webInputExtraStyle as any]}
                    placeholder="Ex: 5.2"
                    placeholderTextColor="#aaa"
                    value={distancia}
                    onChangeText={setDistancia}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveActivity}>
                <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>GUARDAR ATIVIDADE</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: "cover", width: "100%", height: "100%" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)" },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 50, paddingBottom: 30 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  backButton: { padding: 5 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "bold" },
  
  gpsButton: {
    backgroundColor: "#22c55e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    elevation: 4,
  },
  gpsButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16, marginLeft: 10 },
  successText: { color: "#4ade80", textAlign: "center", marginBottom: 20, fontWeight: "bold" },

  formContainer: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  label: { color: "#EEEEEE", fontSize: 14, marginBottom: 8, marginLeft: 4, fontWeight: "600" },
  input: {
    width: "100%", height: 50, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 12, backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 15,
    color: "#FFFFFF", fontSize: 16, marginBottom: 20,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  halfInput: { width: "48%" },
  
  saveButton: {
    width: "100%", backgroundColor: "#1e4db7", flexDirection: "row", borderRadius: 25,
    paddingVertical: 15, alignItems: "center", justifyContent: "center", marginTop: 10,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});