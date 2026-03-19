import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  setPersistence,
} from "firebase/auth";
import { getDatabase } from "firebase/database";
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
    const authModule = require("firebase/auth");
    return authModule.getReactNativePersistence;
  } catch {
    return null;
  }
};

const createAuth = () => {
  if (Platform.OS === "web") {
    const webAuth = getAuth(app);
    setPersistence(webAuth, browserLocalPersistence).catch(() => {
      // Em alguns ambientes web essa chamada pode falhar silenciosamente.
    });
    return webAuth;
  }

  try {
    const persistenceFactory = getReactNativePersistenceSafe();
    if (!persistenceFactory) {
      return getAuth(app);
    }

    return initializeAuth(app, {
      persistence: persistenceFactory(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
};

export const auth = createAuth();
export const database = getDatabase(app);

export default app;
