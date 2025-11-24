  // src/screens/PerfilScreen.tsx
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
        } catch (error) {
          console.log("Erro ao carregar dados:", error);
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
        Alert.alert("Atenção", "Preencha todos os campos obrigatórios antes de salvar.");
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
          try {
            await updatePassword(user as User, newPassword);
            Alert.alert("Senha atualizada com sucesso!");
          } catch (error: any) {
            console.log("Erro ao atualizar senha:", error);
            if (error.code === "auth/requires-recent-login") {
              Alert.alert("Sessão expirada", "Faça login novamente para atualizar a senha.");
            } else {
              Alert.alert("Erro", "Não foi possível atualizar a senha.");
            }
          }
        }

        Alert.alert("Sucesso", "Dados atualizados com sucesso!");
        setNewPassword("");
      } catch (error) {
        console.log("Erro ao salvar dados:", error);
        Alert.alert("Erro", "Não foi possível salvar os dados.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <ImageBackground
        source={require("../../assets/images/Azulao.png")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(15,12,41,0.85)", "rgba(48,43,99,0.85)", "rgba(36,36,62,0.85)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.wrapper}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
              {/* Cabeçalho */}
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
                <Text style={styles.subtitle}>Gerencie suas informações pessoais</Text>
              </View>

              {/* Formulário */}
              <View style={styles.form}>
                <Field label="Nome Completo" value={fullName} onChangeText={setFullName} placeholder="Digite seu nome completo"
                  onFocus={() => setFocusedField("fullName")} onBlur={() => setFocusedField(null)} focused={focusedField === "fullName"} />
                <Field label="Nome de Usuário" value={username} onChangeText={setUsername} placeholder="Digite seu nome de usuário"
                  onFocus={() => setFocusedField("username")} onBlur={() => setFocusedField(null)} focused={focusedField === "username"} />
                <Field label="Email" value={email} editable={false} style={{ opacity: 0.7 }} />

                <Text style={styles.label}>Telefone</Text>
                <MaskInput
                  value={phone}
                  onChangeText={(masked) => setPhone(masked)}
                  mask={['(', /\d/, /\d/, ')', ' ', /\d/, /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/]}
                  keyboardType="phone-pad"
                  style={[styles.input, focusedField === "phone" && styles.inputFocused]}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor="#aaa"
                  onFocus={() => setFocusedField("phone")}
                  onBlur={() => setFocusedField(null)}
                />

                <Field label="Cidade" value={city} onChangeText={setCity} placeholder="Digite sua cidade"
                  onFocus={() => setFocusedField("city")} onBlur={() => setFocusedField(null)} focused={focusedField === "city"} />

                <Text style={styles.label}>Data de Nascimento</Text>
                <MaskInput
                  value={dateOfBirth}
                  onChangeText={(masked) => setDateOfBirth(masked)}
                  mask={[/\d/, /\d/, '/', /\d/, /\d/, '/', /\d/, /\d/, /\d/, /\d/]}
                  keyboardType="numeric"
                  style={[styles.input, focusedField === "date" && styles.inputFocused]}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#aaa"
                  onFocus={() => setFocusedField("date")}
                  onBlur={() => setFocusedField(null)}
                />

                <Field label="Sexo" value={gender} onChangeText={setGender} placeholder="Masculino / Feminino / Outro"
                  onFocus={() => setFocusedField("gender")} onBlur={() => setFocusedField(null)} focused={focusedField === "gender"} />
                <Field label="Nova Senha" value={newPassword} onChangeText={setNewPassword} placeholder="Digite nova senha"
                  secureTextEntry onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)} focused={focusedField === "password"} />
              </View>

              {/* Botão */}
              <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={salvarDados} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
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
          style={[styles.input, focused && styles.inputFocused, style]}
          placeholderTextColor="#aaa"
          {...props}
        />
      </View>
    );
  }

  const styles = StyleSheet.create({
    wrapper: { flex: 1 },
    container: { flexGrow: 1, padding: 20, paddingBottom: 50 },
    header: { alignItems: "center", marginBottom: 25, marginTop: 10 },

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

    title: { fontSize: 26, fontWeight: "700", color: "#fff", marginTop: 12 },
    subtitle: { fontSize: 14, color: "#ccc", marginTop: 4 },
    form: { marginTop: 10 },
    label: { fontSize: 15, fontWeight: "600", color: "#ccc", marginBottom: 6 },

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
      shadowColor: "#1e4db7",
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 3,
    },

    button: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#2563eb",
      paddingVertical: 14,
      borderRadius: 30,
      marginTop: 30,
      shadowColor: "#2563eb",
      shadowOpacity: 0.5,
      shadowRadius: 5,
      elevation: 4,
    },
    buttonText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  });
