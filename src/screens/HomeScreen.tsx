import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

export default function HomeScreen({ navigation }: any) {
  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      {/* Degradê para dar contraste no conteúdo */}
      <LinearGradient
        colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]}
        style={styles.overlay}
      >
        {/* Logo com animação */}
        <Animated.View entering={FadeInDown.duration(1000).springify()}>
          <Image
            style={styles.logo}
            source={require("../../assets/images/LogoTrack.png")}
          />
        </Animated.View>

        {/* Texto de boas-vindas */}
        <Animated.View entering={FadeInUp.delay(300).duration(900)}>
          <Text style={styles.title}>Bem-vindo ao Track & Trail</Text>
          <Text style={styles.subtitle}>
            Gerencie suas rotas, acompanhe seu progresso e explore novos
            caminhos.
          </Text>
        </Animated.View>

        {/* Botões */}
        <Animated.View
          entering={FadeInUp.delay(600).duration(1000)}
          style={{ width: "100%", alignItems: "center" }}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.primaryButtonText}>Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.secondaryButtonText}>Criar Conta</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width,
    height,
  },
  backgroundImage: {
    resizeMode: "cover",
    alignSelf: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 35,
    paddingBottom: 80,
  },
  logo: {
    width: 240,
    height: 240,
    marginBottom: 10,
    resizeMode: "contain",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24, // diminuído
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  subtitle: {
    color: "#E0E0E0",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 45,
    lineHeight: 22,
    maxWidth: 300,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#1e4db7",
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 5,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    paddingVertical: 15,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
