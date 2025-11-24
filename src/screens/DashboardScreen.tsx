// src/screens/DashboardScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { onValue, ref, remove } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, database } from "../../services/connectionFirebase";

// Tipagem das telas do Drawer
type DrawerParamList = {
  Dashboard: undefined;
  Perfil: undefined;
  Atividades: { atividade?: any } | undefined;
  Configuracoes: undefined;
  Planos: undefined; // ← ADICIONADO
  Sair: undefined;
};

type NavigationProps = DrawerNavigationProp<DrawerParamList>;

export default function DashboardScreen() {
  const [atividades, setAtividades] = useState<any[]>([]);
  const navigation = useNavigation<NavigationProps>();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const activitiesRef = ref(database, `users/${user.uid}/atividades`);

    const unsubscribe = onValue(activitiesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));

        const sorted = parsed.sort(
          (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
        );

        setAtividades(sorted);
      } else {
        setAtividades([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleEditar = (item: any) => {
    navigation.navigate("Atividades", { atividade: item });
  };

  const handleExcluir = (id: string) => {
    Alert.alert("Confirmar", "Deseja realmente excluir esta atividade?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          if (!user) return;
          try {
            const activityRef = ref(
              database,
              `users/${user.uid}/atividades/${id}`
            );
            await remove(activityRef);
            Alert.alert("Sucesso", "Atividade excluída com sucesso!");
          } catch (error) {
            console.log("Erro ao remover atividade:", error);
            Alert.alert("Erro", "Não foi possível excluir a atividade.");
          }
        },
      },
    ]);
  };

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      resizeMode="cover"
      style={{ flex: 1, width: "100%", height: "100%" }}
    >
      <LinearGradient
        colors={[
          "rgba(15,12,41,0.85)",
          "rgba(48,43,99,0.85)",
          "rgba(36,36,62,0.85)"
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <Text style={styles.title}>Minhas Atividades</Text>
        <Text style={styles.subtitle}>Atividades recentes</Text>

        <FlatList
          data={atividades}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View>
                <Text style={styles.itemTitle}>{item.tipo}</Text>
                <Text style={styles.itemInfo}>📍 {item.cidade}</Text>
                <Text style={styles.itemInfo}>📅 {item.data}</Text>
                <Text style={styles.itemInfo}>⏱ {item.duracao ?? 0} min</Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleEditar(item)}>
                  <Ionicons name="create-outline" size={22} color="#74b9ff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleExcluir(item.id)}>
                  <Ionicons name="trash-outline" size={22} color="#ff7675" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        {/* MENU INFERIOR */}
        <View style={styles.bottomBar}>
          
          {/* ✔ ALTERAÇÃO QUE VOCÊ PEDIU */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Planos")}
          >
            <Ionicons name="cart-outline" size={28} color="#6c6c6c" />
          </TouchableOpacity>

          <LinearGradient
            colors={["rgba(47,102,246,0.3)", "rgba(47,102,246,0.05)"]}
            style={styles.addButtonWrapper}
          >
            <View style={styles.whiteBorder}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate("Atividades")}
              >
                <Ionicons name="add" size={34} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Perfil")}
          >
            <Ionicons name="person-outline" size={28} color="#6c6c6c" />
          </TouchableOpacity>
        </View>

      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 16,
    color: "#aaa",
    textAlign: "center",
    marginBottom: 20,
  },

  item: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    borderWidth: 2,
    borderColor: "#fff",

    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  itemTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  itemInfo: { color: "#eee", fontSize: 14, marginTop: 2 },

  actions: { flexDirection: "row", gap: 12 },

  bottomBar: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: "#fff",
    borderRadius: 35,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },

  iconButton: {
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonWrapper: {
    position: "absolute",
    left: "50%",
    marginLeft: -47.5,
    bottom: 22,
    width: 95,
    height: 95,
    borderRadius: 47.5,
    justifyContent: "center",
    alignItems: "center",
  },

  whiteBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },

  addButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#2F66F6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2F66F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
  },
});
