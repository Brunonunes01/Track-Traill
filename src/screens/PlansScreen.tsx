import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function PlansScreen() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const BIN_ID = "69243bb5ae596e708f6d84af"; 
  const API_KEY = "$2a$10$T8eHLAmpCAXtEm3.F/R3fuGBuhNM7z31uRVjUzktvlXGs96VTjX2q";

  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
          headers: { "X-Master-Key": API_KEY },
        });

        const json = await response.json();
        setPlans(json.record.plans); // ← lista de planos do JSONBIN
      } catch (error) {
        console.log("Erro ao buscar planos:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
  }, []);

  if (loading) {
    return (
      <ImageBackground
        source={require("../../assets/images/Azulao.png")}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={[
            "rgba(15,12,41,0.85)",
            "rgba(48,43,99,0.85)",
            "rgba(36,36,62,0.85)",
          ]}
          style={styles.center}
        >
          <ActivityIndicator size="large" color="#ffd700" />
        </LinearGradient>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      resizeMode="cover"
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={[
          "rgba(15,12,41,0.85)",
          "rgba(48,43,99,0.85)",
          "rgba(36,36,62,0.85)",
        ]}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Planos</Text>

          {plans.map((item) => (
            <View
  key={item.id}
  style={[
    styles.card,
    item.highlight ? { backgroundColor: "rgba(108,59,255,0.35)" } : null,
  ]}
>

              <Text style={styles.planTitle}>{item.name.toUpperCase()}</Text>
              <Text style={styles.planSub}>{item.type}</Text>

              <Text style={styles.price}>{item.price}</Text>

              {item.total ? (
                <>
                  <Text style={styles.per}>{item.per}</Text>
                  <Text style={styles.total}>TOTAL: {item.total}</Text>
                </>
              ) : (
                <Text style={styles.per}>{item.per}</Text>
              )}

              {item.features &&
                item.features.map((f: string, i: number) => (
                  <Text key={i} style={styles.feature}>
                    • {f}
                  </Text>
                ))}

              <TouchableOpacity
                style={item.highlight ? styles.btn : styles.btnOutline}
              >
                <Text
                  style={
                    item.highlight ? styles.btnText : styles.btnTextOutline
                  }
                >
                  ASSINAR
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
  },

  /* --- CARTÕES DE PLANO (mantido igual ao seu design original) --- */

  card: {
    width: "90%",
    padding: 25,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  planTitle: {
    fontSize: 14,
    color: "#bbb",
    letterSpacing: 2,
  },
  planSub: {
    fontSize: 22,
    color: "#fff",
    marginBottom: 10,
  },
  price: {
    fontSize: 36,
    color: "#fff",
    fontWeight: "bold",
  },

  per: {
    color: "#ddd",
    marginTop: 5,
    textAlign: "center",
  },
  total: {
    color: "#ddd",
    marginTop: 10,
    marginBottom: 10,
    textAlign: "center",
  },

  feature: {
    color: "#eee",
    fontSize: 14,
    marginTop: 4,
  },

  btn: {
    backgroundColor: "#ffd700",
    width: "80%",
    padding: 12,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 15,
  },
  btnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },

  btnOutline: {
    borderColor: "#fff",
    borderWidth: 2,
    width: "80%",
    padding: 12,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 15,
  },
  btnTextOutline: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
