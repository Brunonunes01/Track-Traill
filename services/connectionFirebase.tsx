import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  setPersistence,
} from "firebase/auth";
import { getDatabase, onValue, ref } from "firebase/database";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyBlvFgxQhqUQYyE3LIchPnWvz5cNuYPj1k",
  authDomain: "tracktrail-app.firebaseapp.com",
  databaseURL: "https://tracktrail-app-default-rtdb.firebaseio.com",
  projectId: "tracktrail-app",
  storageBucket: "tracktrail-app.firebasestorage.app",
  messagingSenderId: "248567456065",
  appId: "1:248567456065:web:838f4da3defc88c8dd01c0",
};

const app = initializeApp(firebaseConfig);

const getReactNativePersistenceSafe = () => {
  try {
    // Tenta obter a persistência do módulo auth
    const authModule = require("firebase/auth");
    return authModule.getReactNativePersistence || null;
  } catch (err) {
    console.warn("[firebase] getReactNativePersistence fallback error:", err);
    return null;
  }
};

const createAuth = () => {
  if (Platform.OS === "web") {
    const webAuth = getAuth(app);
    setPersistence(webAuth, browserLocalPersistence).catch((err) => {
      console.warn("[firebase] web persistence failed:", err);
    });
    return webAuth;
  }

  try {
    const persistenceFactory = getReactNativePersistenceSafe();
    if (persistenceFactory && AsyncStorage) {
      console.log("[firebase] Initializing Auth with AsyncStorage persistence");
      return initializeAuth(app, {
        persistence: persistenceFactory(AsyncStorage),
      });
    }
    console.log("[firebase] Falling back to default getAuth");
    return getAuth(app);
  } catch (error) {
    console.warn("[firebase] Auth initialization error, using getAuth:", error);
    return getAuth(app);
  }
};

export const auth = createAuth();
export const database = getDatabase(app);
export const storage = getStorage(app);

const isDisconnectLikeError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  const code = String((error as any)?.code || "").toLowerCase();
  return (
    message.includes("disconnect") ||
    message.includes("network") ||
    message.includes("timeout") ||
    code.includes("disconnect") ||
    code.includes("network")
  );
};

export const normalizeFirebaseErrorMessage = (
  error: unknown,
  fallback = "Erro de comunicação com o servidor."
) => {
  if (isDisconnectLikeError(error)) {
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  }

  const message = String((error as any)?.message || "").trim();
  return message || fallback;
};

if (Platform.OS !== "web") {
  try {
    onValue(
      ref(database, ".info/connected"),
      (snapshot) => {
        const connected = snapshot.val() === true;
        console.log(`[firebase] realtime connection: ${connected ? "online" : "offline"}`);
      },
      (error) => {
        console.warn(
          "[firebase] .info/connected listener failed:",
          normalizeFirebaseErrorMessage(error)
        );
      }
    );
  } catch (error) {
    console.warn("[firebase] failed to register connection listener:", String(error));
  }
}

export default app;
