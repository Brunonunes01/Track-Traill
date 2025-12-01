import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

/* -------- STACK PARAMS -------- */
type RootStackParamList = {
  ActivityView: {
    atividade: any;
  };
};

type ActivityViewRouteProp = RouteProp<
  RootStackParamList,
  "ActivityView"
>;

export default function ActivityViewScreen() {
  const navigation = useNavigation();
  const route = useRoute<ActivityViewRouteProp>();

  const { atividade } = route.params;

  return (
    <LinearGradient
      colors={[
        "#0f0c29",
        "#302b63",
        "#24243e",
      ]}
      style={styles.container}
    >
      {/* ✅ HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Detalhes da Atividade</Text>

        <View style={{ width: 28 }} />
      </View>

      {/* ✅ CONTEÚDO */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.card}>
          <Text style={styles.tipo}>{atividade.tipo}</Text>

          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={18} color="#2F66F6" />
            <Text style={styles.text}>{atividade.data}</Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="time-outline" size={18} color="#2F66F6" />
            <Text style={styles.text}>
              {atividade.duracao ?? 0} minutos
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="location-outline" size={18} color="#2F66F6" />
            <Text style={styles.text}>{atividade.cidade}</Text>
          </View>

          {!!atividade.distancia && (
            <View style={styles.row}>
              <Ionicons name="speedometer-outline" size={18} color="#2F66F6" />
              <Text style={styles.text}>
                {atividade.distancia} km
              </Text>
            </View>
          )}

          {!!atividade.descricao && (
            <>
              <Text style={styles.sectionTitle}>Observações</Text>
              <Text style={styles.description}>
                {atividade.descricao}
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 55,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    justifyContent: "space-between",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    elevation: 8,
  },

  tipo: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2F66F6",
    marginBottom: 16,
    textAlign: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },

  text: {
    fontSize: 16,
    color: "#333",
  },

  sectionTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "700",
    color: "#2F66F6",
  },

  description: {
    marginTop: 8,
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
  },
});
