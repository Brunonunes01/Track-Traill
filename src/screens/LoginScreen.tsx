import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { ensureUserProfileCompatibility } from "../services/userService";

const LOGIN_ATTEMPT_TIMEOUT_MS = 15000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasNavigatedRef = useRef(false);

  // 🔹 Controle da animação de foco
  const emailFocus = new Animated.Value(0);
  const passwordFocus = new Animated.Value(0);

  const navigateToMain = useCallback(
    (source: string) => {
      if (hasNavigatedRef.current) {
        console.log(`[auth] Skipping navigation from ${source} (already navigating/navigated)`);
        return;
      }
      
      hasNavigatedRef.current = true;
      console.log(`[auth] Initiating navigation to MainTabs from source: ${source}`);
      
      const performNavigation = () => {
        try {
          if (typeof navigation?.replace === "function") {
            console.log("[auth] Using navigation.replace('MainTabs')");
            navigation.replace("MainTabs");
            return;
          }
          if (typeof navigation?.navigate === "function") {
            console.log("[auth] Using navigation.navigate('MainTabs')");
            navigation.navigate("MainTabs");
            return;
          }
          throw new Error("Navigation API indisponível no login.");
        } catch (navError: any) {
          hasNavigatedRef.current = false;
          console.error("[auth] Navigation error captured in performNavigation:", navError);
          setError("Falha ao abrir o painel principal. Tente novamente.");
          Alert.alert("Erro de Navegação", "Não foi possível abrir a tela principal após o login.");
        }
      };

      // Pequeno delay para garantir que o estado do Firebase está estável no Android
      if (Platform.OS === "android") {
        setTimeout(performNavigation, 300);
      } else {
        performNavigation();
      }
    },
    [navigation]
  );

  useEffect(() => {
    console.log("[auth] LoginScreen mounted");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[auth] Auth state observed on login screen:", user ? "authenticated" : "guest");
      if (user) {
        navigateToMain("auth-state-listener");
      }
    });
    return unsubscribe;
  }, [navigateToMain]);

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

    if (isSubmitting) return;

    console.log("[auth] Login started");
    setIsSubmitting(true);
    setError("");

    try {
      const userCredential = await withTimeout(
        signInWithEmailAndPassword(auth, email.trim(), password),
        LOGIN_ATTEMPT_TIMEOUT_MS,
        "Tempo de login excedido. Verifique sua conexão e tente novamente."
      );
      console.log("[auth] Login completed");
      console.log("[auth] Authenticated user:", userCredential.user.uid);

      console.log("[auth] Profile loading started");
      try {
        await ensureUserProfileCompatibility({
          uid: userCredential.user.uid,
          email: userCredential.user.email || "",
        });
        console.log("[auth] Profile loading finished");
      } catch (profileError: any) {
        console.error("[auth] Profile loading failed:", profileError);
        Alert.alert(
          "Perfil parcialmente indisponível",
          "O login foi concluído, mas houve falha ao carregar seu perfil. Você ainda pode entrar no app."
        );
      }

      setError("");
      setEmail("");
      setPassword("");
      navigateToMain("login-success");
    } catch (err: any) {
      console.error("[auth] Login error captured:", err);
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
      } else if (err?.message === "Tempo de login excedido. Verifique sua conexão e tente novamente.") {
        setError(err.message);
      } else {
        setError("Erro ao fazer login.");
      }
    } finally {
      setIsSubmitting(false);
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
            {error &&
              error !== "Usuário não encontrado." &&
              error !== "E-mail inválido." &&
              error !== "Senha incorreta." &&
              error !== "Digite o e-mail e a senha." &&
              error !== "Erro ao fazer login." && (
                <Text style={styles.errorText}>{error}</Text>
              )}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && { opacity: 0.75 }]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>{isSubmitting ? "ENTRANDO..." : "ENTRAR"}</Text>
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
