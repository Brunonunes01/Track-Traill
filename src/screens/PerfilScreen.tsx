import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { updatePassword, User } from "firebase/auth";
import { get, ref, set } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import MaskInput from "react-native-mask-input";
import { auth, database } from "../../services/connectionFirebase";

export default function PerfilScreen() {
  const user = auth.currentUser;

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const carregarDados = async () => {
      if (!user) return;
      try {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setFullName(data.fullName || "");
          setUsername(data.username || "");
          setEmail(data.email || user.email || "");
          setPhone(data.phone || "");
          setCity(data.city || "");
          setDateOfBirth(data.dateOfBirth || "");
          setGender(data.gender || "");
          setPhoto(data.photo || null);
        }
      } catch {
        Alert.alert("Erro", "Não foi possível carregar seus dados.");
      }
    };
    carregarDados();
  }, [user]);

  const escolherImagem = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Precisamos de acesso às suas fotos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  };

  const salvarDados = async () => {
    if (!user) return;

    if (!fullName || !username || !dateOfBirth || !gender || !city) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const userRef = ref(database, `users/${user.uid}`);
      await set(userRef, {
        fullName,
        username,
        email,
        phone,
        city,
        dateOfBirth,
        gender,
        photo,
      });

      if (newPassword) {
        await updatePassword(user as User, newPassword);
        setNewPassword("");
      }

      Alert.alert("Sucesso", "Dados atualizados com sucesso!");
    } catch {
      Alert.alert("Erro", "Não foi possível salvar os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      resizeMode="cover"
      style={{ flex: 1 }}
    >
      {/* ✅ MESMA TONALIDADE DO HOME */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.8)",
          "rgba(0,0,0,0.3)",
          "rgba(0,0,0,0.8)",
        ]}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <View style={styles.header}>
              <TouchableOpacity onPress={escolherImagem}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera-outline" size={40} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.title}>Meu Perfil</Text>
              <Text style={styles.subtitle}>
                Gerencie suas informações pessoais
              </Text>
            </View>

            {/* FORM */}
            <Field
              label="Nome Completo"
              value={fullName}
              onChangeText={setFullName}
              focused={focusedField === "fullName"}
              onFocus={() => setFocusedField("fullName")}
              onBlur={() => setFocusedField(null)}
            />

            <Field
              label="Nome de Usuário"
              value={username}
              onChangeText={setUsername}
              focused={focusedField === "username"}
              onFocus={() => setFocusedField("username")}
              onBlur={() => setFocusedField(null)}
            />

            <Field label="Email" value={email} editable={false} style={{ opacity: 0.6 }} />

            <Text style={styles.label}>Telefone</Text>
            <MaskInput
              value={phone}
              onChangeText={setPhone}
              mask={[
                "(",
                /\d/,
                /\d/,
                ")",
                " ",
                /\d/,
                /\d/,
                /\d/,
                /\d/,
                /\d/,
                "-",
                /\d/,
                /\d/,
                /\d/,
                /\d/,
              ]}
              keyboardType="phone-pad"
              style={[
                styles.input,
                focusedField === "phone" && styles.inputFocused,
              ]}
              placeholder="(00) 00000-0000"
              placeholderTextColor="#aaa"
              onFocus={() => setFocusedField("phone")}
              onBlur={() => setFocusedField(null)}
            />

            <Field
              label="Cidade"
              value={city}
              onChangeText={setCity}
              focused={focusedField === "city"}
              onFocus={() => setFocusedField("city")}
              onBlur={() => setFocusedField(null)}
            />

            <Text style={styles.label}>Data de Nascimento</Text>
            <MaskInput
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              mask={[/\d/, /\d/, "/", /\d/, /\d/, "/", /\d/, /\d/, /\d/, /\d/]}
              keyboardType="numeric"
              style={[
                styles.input,
                focusedField === "date" && styles.inputFocused,
              ]}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#aaa"
              onFocus={() => setFocusedField("date")}
              onBlur={() => setFocusedField(null)}
            />

            <Field
              label="Sexo"
              value={gender}
              onChangeText={setGender}
              focused={focusedField === "gender"}
              onFocus={() => setFocusedField("gender")}
              onBlur={() => setFocusedField(null)}
            />

            <Field
              label="Nova Senha"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              focused={focusedField === "password"}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
            />

            {/* BOTÃO */}
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={salvarDados}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Salvar Alterações</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
}

function Field({ label, focused, style, ...props }: any) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, focused && styles.inputFocused, style]}
        placeholderTextColor="#aaa"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 50,
  },
  header: {
    alignItems: "center",
    marginBottom: 25,
    marginTop: 10,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#2563eb",
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ccc",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
  },
  inputFocused: {
    borderColor: "#1e4db7",
  },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 30,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 6,
  },
});
