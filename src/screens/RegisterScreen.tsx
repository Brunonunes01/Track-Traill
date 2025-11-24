import { Ionicons } from "@expo/vector-icons";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import React, { useState } from "react";
import {
  Image,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, database } from "../../services/connectionFirebase";

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !username || !email || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await set(ref(database, "users/" + user.uid), {
        fullName,
        username,
        email,
      });

      setFullName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setError("");

      navigation.navigate("Login");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use")
        setError("Este e-mail já está em uso.");
      else if (err.code === "auth/invalid-email")
        setError("E-mail inválido.");
      else setError("Erro ao criar conta.");
    }
  };

  // helper para aplicar style extra no web (remove outline no web)
  const webInputExtraStyle = Platform.OS === "web" ? { outlineWidth: 0 } : {};

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Image
            style={styles.logo}
            source={require("../../assets/images/LogoTrack.png")}
          />

          <Text style={styles.title}>Crie sua conta</Text>
          <Text style={styles.subtitle}>
            Cadastre-se para começar a registrar suas atividades
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TextInput
            style={[styles.input, webInputExtraStyle]}
            placeholder="Nome completo"
            placeholderTextColor="#CCCCCC"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (error) setError("");
            }}
            underlineColorAndroid="transparent"
            autoCorrect={false}
          />

          <TextInput
            style={[styles.input, webInputExtraStyle]}
            placeholder="Nome de usuário"
            placeholderTextColor="#CCCCCC"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              if (error) setError("");
            }}
            underlineColorAndroid="transparent"
            autoCorrect={false}
          />

          <TextInput
            style={[styles.input, webInputExtraStyle]}
            placeholder="E-mail"
            placeholderTextColor="#CCCCCC"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError("");
            }}
            underlineColorAndroid="transparent"
            autoCorrect={false}
          />

          {/* Campo de senha com olhinho */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, webInputExtraStyle]}
              placeholder="Senha"
              placeholderTextColor="#CCCCCC"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError("");
              }}
              underlineColorAndroid="transparent"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>CRIAR CONTA</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.switchText}>
              Já tem uma conta? <Text style={styles.switchLink}>Entrar</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: "cover" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: { width: "85%", alignItems: "center" },
  logo: { width: 300, height: 300, marginBottom: 10, resizeMode: "contain" },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  subtitle: {
    color: "#DDDDDD",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: "#FFFFFF",
    borderWidth: 1,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 20,
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 15,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
  },
  eyeButton: {
    padding: 5,
  },
  button: {
    width: "100%",
    backgroundColor: "#1e4db7",
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  switchText: {
    color: "#CCCCCC",
    fontSize: 13,
    marginTop: 20,
    textAlign: "center",
  },
  switchLink: { color: "#1e4db7", fontWeight: "bold" },
  errorText: {
    color: "#ff4d4d",
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
});
