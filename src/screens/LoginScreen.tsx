import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../services/connectionFirebase";

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 🔹 Controle da animação de foco
  const emailFocus = new Animated.Value(0);
  const passwordFocus = new Animated.Value(0);

  const handleFocus = (anim: Animated.Value) => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = (anim: Animated.Value) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Digite o e-mail e a senha.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setError("");
      setEmail("");
      setPassword("");
      navigation.navigate("DashboardScreen");
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("Usuário não encontrado.");
        setEmail("");
        setPassword("");
      } else if (err.code === "auth/wrong-password") {
        setError("Senha incorreta.");
        setPassword("");
      } else if (err.code === "auth/invalid-email") {
        setError("E-mail inválido.");
        setEmail("");
      } else {
        setError("Erro ao fazer login.");
      }
    }
  };

  // 🔹 Estilo adicional apenas para Web (remove outline)
  const webInputStyle = Platform.OS === "web" ? { outlineWidth: 0 } : {};

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%" }}
        >
          <View style={styles.container}>
            <Image
              style={styles.logo}
              source={require("../../assets/images/LogoTrack.png")}
            />

            <Text style={styles.title}>Bem-vindo</Text>
            <Text style={styles.subtitle}>Acesse sua conta para continuar</Text>

            {/* Campo de E-mail */}
            <Animated.View
              style={[
                styles.inputContainer,
                {
                  borderColor: emailFocus.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["#FFFFFF", "#1e4db7"],
                  }),
                  shadowOpacity: emailFocus.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.3],
                  }),
                },
              ]}
            >
              <TextInput
                style={[styles.input, webInputStyle]}
                placeholder="E-mail"
                placeholderTextColor="#CCCCCC"
                keyboardType="email-address"
                autoCapitalize="none"
                underlineColorAndroid="transparent"
                value={email}
                onFocus={() => handleFocus(emailFocus)}
                onBlur={() => handleBlur(emailFocus)}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError("");
                }}
              />
            </Animated.View>
            {(error === "Usuário não encontrado." ||
              error === "E-mail inválido.") && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {/* Campo de Senha */}
            <Animated.View
              style={[
                styles.passwordContainer,
                {
                  borderColor: passwordFocus.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["#FFFFFF", "#1e4db7"],
                  }),
                  shadowOpacity: passwordFocus.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.3],
                  }),
                },
              ]}
            >
              <TextInput
                style={[styles.passwordInput, webInputStyle]}
                placeholder="Senha"
                placeholderTextColor="#CCCCCC"
                secureTextEntry={!showPassword}
                underlineColorAndroid="transparent"
                value={password}
                onFocus={() => handleFocus(passwordFocus)}
                onBlur={() => handleBlur(passwordFocus)}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError("");
                }}
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
            </Animated.View>
            {error === "Senha incorreta." && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {(error === "Digite o e-mail e a senha." ||
              error === "Erro ao fazer login.") && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>ENTRAR</Text>
            </TouchableOpacity>

            <TouchableOpacity
  style={{ marginTop: 20 }}   // aumenta a distância do botão de entrar
  onPress={() => navigation.navigate("Register")}
>
  <Text style={styles.switchText}>
    Não tem uma conta?{" "}
    <Text style={styles.switchLink}>Cadastre-se</Text>
  </Text>
</TouchableOpacity>


          </View>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

// 🔹 Estilos — sem propriedades inválidas (tudo 100% compatível com React Native)
const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: "cover",
    width: "100%",
    height: "100%",
  },
  linkText: {
    color: "blue",
    textDecorationLine: "underline" // opcional
  },  
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  container: { width: "100%", alignItems: "center" },
  logo: { width: 260, height: 260, marginBottom: 10, resizeMode: "contain" },
  title: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  subtitle: {
    color: "#DDDDDD",
    fontSize: 14,
    marginBottom: 25,
    textAlign: "center",
  },

  inputContainer: {
    width: "100%",
    height: 50,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 12,
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: "#1e4db7",
  },

  input: {
    color: "#FFFFFF",
    fontSize: 16,
    padding: 0,
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 50,
    borderWidth: 1.5,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 15,
    shadowColor: "#1e4db7",
    marginBottom: 10,
  },

  passwordInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    padding: 0,
  },
  eyeButton: { padding: 5 },

  errorText: {
    color: "#ff4444",
    fontSize: 13,
    marginBottom: 10,
    alignSelf: "flex-start",
  },

  switchText: {
    color: "#fff",        // branco
    fontSize: 14,
    textAlign: "center",
  },
  
  switchLink: {
    color: "#1e4db7",     // azul igual ao que você já usa
    fontWeight: "bold",
  },
  

  primaryButton: {
    width: "100%",
    backgroundColor: "#1e4db7",
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: { marginTop: 20 },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
});
