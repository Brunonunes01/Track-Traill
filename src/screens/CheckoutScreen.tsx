import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
    Alert,
    ImageBackground,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useCart } from "../context/CartContext";

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { cartItems, getTotal, clearCart } = useCart();

  const handleConfirm = () => {
    Alert.alert("Sucesso ✅", "Comprado com sucesso!", [
      {
        text: "OK",
        onPress: () => {
          clearCart();
          navigation.navigate("Dashboard");
        },
      },
    ]);
  };

  return (
    <ImageBackground
      source={require("../../assets/images/Azulao.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>Resumo da Compra</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {cartItems.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.nome}</Text>

              {item.descricao && (
                <Text style={styles.desc}>{item.descricao}</Text>
              )}

              <Text style={styles.calc}>
                {item.quantity} × R${" "}
                {item.preco.toFixed(2).replace(".", ",")}
              </Text>

              <Text style={styles.subtotal}>
                Subtotal: R${" "}
                {(item.preco * item.quantity)
                  .toFixed(2)
                  .replace(".", ",")}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.total}>
            Total: R${" "}
            {getTotal().toFixed(2).replace(".", ",")}
          </Text>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmText}>
              CONFIRMAR COMPRA
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)", // 🔥 MESMO overlay da Home
    padding: 20,
  },
  title: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#2A2A2A",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  name: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  desc: {
    color: "#bbb",
    marginTop: 4,
  },
  calc: {
    color: "#aaa",
    marginTop: 6,
  },
  subtotal: {
    color: "#ffd700",
    fontWeight: "bold",
    marginTop: 4,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: "#444",
    paddingTop: 15,
    marginTop: 10,
  },
  total: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  confirmBtn: {
    backgroundColor: "#ffd700",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
});
