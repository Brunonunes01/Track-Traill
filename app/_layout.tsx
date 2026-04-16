import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import AppErrorBoundary from "../src/components/AppErrorBoundary";
import { useColorScheme } from "@/hooks/useColorScheme";
import { subscribeCurrentUserRole } from "../services/adminService";
import { auth } from "../services/connectionFirebase";

function CustomDrawerContent(props: any) {
  const { navigation } = props;
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
      { key: "inicio", label: "Início", icon: "home-outline", href: "/(tabs)/" },
      { key: "historico", label: "Meu Histórico", icon: "time-outline", href: "/history" },
      { key: "amigos", label: "Amigos", icon: "people-outline", href: "/friends" },
      { key: "config", label: "Configurações", icon: "settings-outline", href: "/configuracoes" },
      { key: "ajuda", label: "Ajuda & Suporte", icon: "help-circle-outline", href: "/ajuda" },
    ],
    []
  );

  return (
    <View style={[styles.drawerContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Track & Trail</Text>
        <Text style={styles.drawerSubtitle}>Explore novos caminhos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.drawerItems}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.drawerItem}
            onPress={() => {
              navigation.closeDrawer();
              router.push(item.href as any);
            }}
          >
            <Ionicons name={item.icon as any} size={22} color="#94a3b8" />
            <Text style={styles.drawerItemText}>{item.label}</Text>
          </TouchableOpacity>
        ))}

        {isAdmin && (
          <TouchableOpacity
            style={styles.drawerItem}
            onPress={() => {
              navigation.closeDrawer();
              router.push("/admin");
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color="#f97316" />
            <Text style={[styles.drawerItemText, { color: "#f97316" }]}>Painel Admin</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => {
          try {
            await signOut(auth);
            navigation.closeDrawer();
            router.replace("/login");
          } catch (error: any) {
            Alert.alert("Erro ao sair", error?.message || "Tente novamente.");
          }
        }}
      >
        <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    // Esconde o splash imediatamente para boot rápido
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <AppErrorBoundary>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Drawer
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerStyle: {
              backgroundColor: "#0b1220",
              width: 280,
            },
            overlayColor: "rgba(2,6,23,0.7)",
          }}
        >
          <Drawer.Screen 
            name="(tabs)" 
            options={{ 
              drawerLabel: "Principal",
              headerShown: false 
            }} 
          />
          <Drawer.Screen 
            name="history" 
            options={{ 
              drawerLabel: "Histórico",
              headerShown: true,
              title: "Meu Histórico",
              headerStyle: { backgroundColor: "#0b1220" },
              headerTintColor: "#fff"
            }} 
          />
        </Drawer>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: "#0b1220" },
  drawerHeader: { paddingHorizontal: 20, marginBottom: 24 },
  drawerTitle: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  drawerSubtitle: { color: "#94a3b8", fontSize: 13, marginTop: 4 },
  drawerItems: { paddingHorizontal: 12 },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerItemText: { color: "#e2e8f0", fontSize: 16, fontWeight: "600", marginLeft: 12 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "700", marginLeft: 12 },
});
