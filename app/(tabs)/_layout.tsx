import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeCurrentUserRole } from "../../services/adminService";
import { auth } from "../../services/connectionFirebase";
import { signOut } from "firebase/auth";

function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeCurrentUserRole(({ isAdmin: adminAllowed }: any) => {
      setIsAdmin(adminAllowed);
    });

    return unsubscribe;
  }, []);

  const menuItems = useMemo(
    () => [
      { key: "perfil", label: "Perfil", icon: "person-circle-outline", href: "/(tabs)/perfil" },
      { key: "rotas", label: "Minhas rotas", icon: "trail-sign-outline", href: "/(tabs)/proximas" },
      { key: "alertas", label: "Alertas", icon: "warning-outline", href: "/alert-form" },
      { key: "config", label: "Configurações", icon: "settings-outline", href: "/configuracoes" },
      { key: "ajuda", label: "Ajuda", icon: "help-circle-outline", href: "/ajuda" },
    ],
    []
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sidePanel, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Track & Trail</Text>
            <Text style={styles.panelSubtitle}>Navegação secundária</Text>
          </View>

          <ScrollView contentContainerStyle={styles.panelItems} showsVerticalScrollIndicator={false}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  router.push(item.href as any);
                }}
              >
                <Ionicons name={item.icon as any} size={20} color="#cbd5e1" />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            {isAdmin ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  router.push("/admin");
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={20} color="#cbd5e1" />
                <Text style={styles.menuItemText}>Admin</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={styles.logoutItem}
            onPress={async () => {
              onClose();
              await signOut(auth);
              router.replace("/login");
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: true,
          headerStyle: { backgroundColor: "#0b1220" },
          headerTitleStyle: { color: "#f8fafc", fontWeight: "700" },
          headerTintColor: "#f8fafc",
          headerLeft: () => (
            <TouchableOpacity style={styles.headerMenuBtn} onPress={() => setMenuVisible(true)}>
              <Ionicons name="menu" size={22} color="#f8fafc" />
            </TouchableOpacity>
          ),
          tabBarActiveTintColor: "#1e4db7",
          tabBarInactiveTintColor: "#6b7280",
          tabBarStyle: {
            backgroundColor: "#0b1220",
            borderTopColor: "#1f2937",
            height: 58 + Math.max(insets.bottom, 8),
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          tabBarIcon: ({ color, size }) => {
            const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
              index: "home-outline",
              mapa: "map-outline",
              proximas: "trail-sign-outline",
              atividades: "walk-outline",
              perfil: "person-circle-outline",
            };
            return <Ionicons name={iconMap[route.name]} size={size} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: "Início" }} />
        <Tabs.Screen name="mapa" options={{ title: "Mapa", headerShown: false }} />
        <Tabs.Screen name="proximas" options={{ title: "Próximas" }} />
        <Tabs.Screen name="atividades" options={{ title: "Atividade", headerShown: false }} />
        <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
      </Tabs>

      <SideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  headerMenuBtn: {
    marginLeft: 14,
    padding: 4,
  },
  modalRoot: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.35)",
  },
  sidePanel: {
    width: 288,
    backgroundColor: "#111827",
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
    justifyContent: "space-between",
  },
  panelHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  panelTitle: {
    color: "#f8fafc",
    fontSize: 21,
    fontWeight: "700",
  },
  panelSubtitle: {
    color: "#94a3b8",
    marginTop: 2,
    fontSize: 13,
  },
  panelItems: {
    paddingHorizontal: 8,
    paddingBottom: 14,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  menuItemText: {
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: 15,
  },
  logoutItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.28)",
    backgroundColor: "rgba(127,29,29,0.15)",
  },
  logoutText: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 15,
  },
});
