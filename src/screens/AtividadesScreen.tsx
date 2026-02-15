import { Ionicons } from "@expo/vector-icons"; // Ícones bonitos
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { push, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, database } from "../../services/connectionFirebase";

// Importamos nosso novo componente
import MapTracker from "../components/MapTracker";

export default function AtividadesScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { atividade }: any = route.params || {};

  // Estados do Formulário
  const [activityType, setActivityType] = useState("caminhada");
  const [showOptions, setShowOptions] = useState(false);
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [duration, setDuration] = useState("");
  const [coordinates, setCoordinates] = useState<any[]>([]); // Para salvar a rota
  const [distance, setDistance] = useState(0); // Para salvar distancia
  const [loading, setLoading] = useState(false);

  // Estado para controlar o Modo GPS
  const [isTracking, setIsTracking] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (atividade) {
      setActivityType(atividade.tipo || "caminhada");
      setDate(atividade.data || "");
      setCity(atividade.cidade || "");
      setState(atividade.estado || "");
      setDuration(atividade.duracao || "");
    }
  }, [atividade]);

  const handleDateChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    setDate(formatted);
  };

  // Função chamada quando o GPS termina
  const handleFinishTracking = (data: { coordinates: any[]; distance: number; duration: number }) => {
    setIsTracking(false);
    setCoordinates(data.coordinates);
    setDistance(data.distance);
    setDuration(data.duration.toString());
    
    // Pega a data de hoje automaticamente
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    setDate(formattedDate);

    Alert.alert("Trilha Concluída!", `Você percorreu ${data.distance} km em ${data.duration} min.`);
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert("Erro", "Usuário não autenticado!");
      return;
    }

    if (!activityType || !date || !city || !state) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios!");
      return;
    }

    setLoading(true);
    try {
      const activitiesRef = ref(database, `users/${user.uid}/atividades`);
      
      const payload = {
        tipo: activityType,
        data: date,
        cidade: city,
        estado: state,
        duracao: duration,
        distancia: distance, // Novo campo
        rota: coordinates, // Salva o array de coordenadas do GPS
        atualizadoEm: new Date().toISOString(),
      };

      if (atividade && atividade.id) {
        const activityRef = ref(database, `users/${user.uid}/atividades/${atividade.id}`);
        await update(activityRef, payload);
        Alert.alert("Sucesso", "Atividade atualizada com sucesso!");
      } else {
        await push(activitiesRef, {
          ...payload,
          criadoEm: new Date().toISOString(),
        });
        Alert.alert("Sucesso", "Atividade salva com sucesso!");
      }
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível salvar a atividade.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectType = (type: string) => {
    setActivityType(type);
    setShowOptions(false);
  };

  // SE O MODO RASTREAMENTO ESTIVER ATIVO, MOSTRA O MAPA EM TELA CHEIA
  if (isTracking) {
    return (
        <MapTracker 
            onFinish={handleFinishTracking} 
            onCancel={() => setIsTracking(false)} 
        />
    );
  }

  // SE NÃO, MOSTRA O FORMULÁRIO NORMAL
  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      resizeMode="cover"
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
        style={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>
            {atividade ? "Editar Atividade" : "Nova Aventura"}
          </Text>

          {/* Botão GRANDE para iniciar GPS */}
          {!atividade && (
            <TouchableOpacity 
                style={styles.gpsButton} 
                onPress={() => setIsTracking(true)}
            >
                <Ionicons name="location-outline" size={24} color="#fff" style={{marginRight: 10}} />
                <Text style={styles.gpsButtonText}>INICIAR RASTREAMENTO GPS</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Ou registre manualmente:</Text>

          <Text style={styles.label}>Tipo de Atividade</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowOptions(!showOptions)}
          >
            <Text style={styles.inputText}>
              {activityType.charAt(0).toUpperCase() + activityType.slice(1)}
            </Text>
          </TouchableOpacity>

          {showOptions && (
            <View style={styles.optionContainer}>
              {["caminhada", "ciclismo", "corrida", "surf", "trilha", "academia"].map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={styles.optionItem}
                  onPress={() => handleSelectType(tipo)}
                >
                  <Text style={styles.optionText}>
                    {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Data</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#aaa"
            value={date}
            onChangeText={handleDateChange}
            keyboardType="numeric"
            maxLength={10}
          />

          <View style={{flexDirection: 'row', gap: 10}}>
            <View style={{flex: 1}}>
                <Text style={styles.label}>Cidade</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Cidade"
                    placeholderTextColor="#aaa"
                    value={city}
                    onChangeText={setCity}
                />
            </View>
            <View style={{width: 80}}>
                <Text style={styles.label}>UF</Text>
                <TextInput
                    style={styles.input}
                    placeholder="SP"
                    placeholderTextColor="#aaa"
                    value={state}
                    onChangeText={setState}
                    maxLength={2}
                    autoCapitalize="characters"
                />
            </View>
          </View>

          <Text style={styles.label}>Duração (minutos)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 45"
            placeholderTextColor="#aaa"
            keyboardType="numeric"
            value={duration}
            onChangeText={setDuration}
          />

          {distance > 0 && (
            <View style={styles.infoBox}>
                <Text style={styles.infoText}>📍 Distância Rastreada: {distance} km</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Salvando..." : "Salvar Atividade"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#aaa',
    textAlign: 'center',
    marginVertical: 15,
    fontSize: 14
  },
  gpsButton: {
    backgroundColor: '#16a34a', // Verde
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  gpsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  label: {
    fontSize: 15,
    color: "#ddd",
    marginBottom: 6,
    marginTop: 10,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
  },
  inputText: {
    fontSize: 16,
    color: "#fff",
  },
  optionContainer: {
    backgroundColor: "rgba(30,30,30,0.9)",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  optionText: {
    color: "#fff",
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.5)'
  },
  infoText: {
    color: '#60a5fa',
    fontWeight: 'bold',
    fontSize: 16
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 30,
    marginBottom: 40
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});