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

export default function AtividadesScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { atividade }: any = route.params || {};

  const [activityType, setActivityType] = useState("caminhada");
  const [showOptions, setShowOptions] = useState(false);
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);

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
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(
        2,
        4
      )}/${cleaned.slice(4, 8)}`;
    }

    setDate(formatted);
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

      if (atividade && atividade.id) {
        const activityRef = ref(
          database,
          `users/${user.uid}/atividades/${atividade.id}`
        );

        await update(activityRef, {
          tipo: activityType,
          data: date,
          cidade: city,
          estado: state,
          duracao: duration,
        });

        Alert.alert("Sucesso", "Atividade atualizada com sucesso!");
      } else {
        await push(activitiesRef, {
          tipo: activityType,
          data: date,
          cidade: city,
          estado: state,
          duracao: duration,
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

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      resizeMode="cover"
      style={{ flex: 1 }}
    >
      {/* ✅ ÚNICA ALTERAÇÃO ESTÁ AQUI */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.8)",
          "rgba(0,0,0,0.3)",
          "rgba(0,0,0,0.8)",
        ]}
        style={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>
            {atividade ? "Editar Atividade" : "Registrar Atividade"}
          </Text>

          <Text style={styles.label}>Tipo de Atividade</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowOptions(!showOptions)}
          >
            <Text style={styles.inputText}>
              {activityType.charAt(0).toUpperCase() +
                activityType.slice(1)}
            </Text>
          </TouchableOpacity>

          {showOptions && (
            <View style={styles.optionContainer}>
              {[
                "caminhada",
                "ciclismo",
                "corrida",
                "surf",
                "trilha",
                "academia",
              ].map((tipo) => (
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

          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a cidade"
            placeholderTextColor="#aaa"
            value={city}
            onChangeText={setCity}
          />

          <Text style={styles.label}>Estado</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: SP"
            placeholderTextColor="#aaa"
            value={state}
            onChangeText={setState}
            maxLength={2}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Duração (minutos)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 45"
            placeholderTextColor="#aaa"
            keyboardType="numeric"
            value={duration}
            onChangeText={setDuration}
          />

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading
                ? "Salvando..."
                : atividade
                ? "Atualizar"
                : "Concluir"}
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
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: "#ccc",
    marginBottom: 6,
    marginTop: 10,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
  },
  inputText: {
    fontSize: 16,
    color: "#fff",
  },
  optionContainer: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    marginBottom: 10,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  optionText: {
    color: "#fff",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
