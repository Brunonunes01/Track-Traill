import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import AppErrorBoundary from "../src/components/AppErrorBoundary";

import { useColorScheme } from "@/hooks/useColorScheme";

const FONT_BOOT_TIMEOUT_MS = 8000;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, fontError] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [fontTimeoutReached, setFontTimeoutReached] = useState(false);

  const readyToRender = useMemo(
    () => loaded || Boolean(fontError) || fontTimeoutReached,
    [loaded, fontError, fontTimeoutReached]
  );

  useEffect(() => {
    console.log("[boot] RootLayout mounted");

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error("[boot] Unhandled promise rejection:", event?.reason);
    };
    globalThis.addEventListener?.("unhandledrejection", rejectionHandler as EventListener);

    SplashScreen.preventAutoHideAsync().catch((error) => {
      console.warn("[boot] preventAutoHideAsync failed:", error);
    });

    return () => {
      globalThis.removeEventListener?.("unhandledrejection", rejectionHandler as EventListener);
    };
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFontTimeoutReached(true);
      console.warn("[boot] Font loading timeout reached. Continuing without blocking app.");
    }, FONT_BOOT_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!readyToRender) return;

    if (fontError) {
      console.error("[boot] Font loading error:", fontError);
    }

    SplashScreen.hideAsync()
      .then(() => {
        console.log("[boot] Splash hidden and app ready");
      })
      .catch((error) => {
        console.warn("[boot] hideAsync failed:", error);
      });
  }, [fontError, readyToRender]);

  if (!readyToRender) {
    return (
      <View style={{ flex: 1, backgroundColor: "#020617", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1e4db7" />
        <Text style={{ marginTop: 10, color: "#cbd5e1" }}>Inicializando app...</Text>
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ title: "Oops!" }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
