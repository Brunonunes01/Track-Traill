import { onAuthStateChanged } from "firebase/auth";
import Constants from "expo-constants";
import {
  equalTo,
  get,
  onValue,
  orderByChild,
  query,
  ref,
} from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, database } from "./connectionFirebase";

const USERS_PATH = "users";

const normalizeEmail = (email) => (email || "").trim().toLowerCase();

export const resolveUserRole = (userRecord, email) => {
  if (userRecord?.role === "admin") return "admin";
  void normalizeEmail(email || userRecord?.email);
  return "user";
};

export const ensureUserRole = async (uid, email) => {
  if (!uid) return "user";
  const userRef = ref(database, `${USERS_PATH}/${uid}`);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) return "user";

  const userData = snapshot.val();
  const resolvedRole = resolveUserRole(userData, email);
  return resolvedRole;
};

const getFunctionsRegion = () => {
  const envRegion = process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION;
  if (envRegion?.trim()) return envRegion.trim();
  const extraRegion = (Constants.expoConfig?.extra || {}).firebaseFunctionsRegion;
  if (typeof extraRegion === "string" && extraRegion.trim()) return extraRegion.trim();
  return "us-central1";
};

const callAdminFunction = async (name, payload) => {
  if (!auth.currentUser?.uid) {
    throw new Error("Você precisa estar autenticado para esta operação.");
  }

  try {
    const functions = getFunctions(undefined, getFunctionsRegion());
    const callable = httpsCallable(functions, name);
    const result = await callable(payload);
    return result?.data || null;
  } catch (error) {
    const message = String(error?.message || "").trim();
    throw new Error(message || "Falha ao executar ação administrativa.");
  }
};

export const addAdminByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Informe um e-mail válido.");
  }

  const response = await callAdminFunction("setUserAdminClaim", { email: normalizedEmail });
  return response;
};

export const removeAdminRole = async (uid) => {
  if (!uid?.trim()) {
    throw new Error("Usuário inválido.");
  }

  const response = await callAdminFunction("clearUserAdminClaim", { uid: uid.trim() });
  return response;
};

const mapSnapshotToUsers = (snapshot) => {
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.keys(data).map((uid) => ({ uid, ...data[uid] }));
};

export const subscribeAdmins = (onChange) => {
  const adminsQuery = query(
    ref(database, USERS_PATH),
    orderByChild("role"),
    equalTo("admin")
  );

  return onValue(adminsQuery, (snapshot) => {
    onChange(mapSnapshotToUsers(snapshot));
  });
};

export const subscribeUsers = (onChange) => {
  return onValue(ref(database, USERS_PATH), (snapshot) => {
    onChange(mapSnapshotToUsers(snapshot));
  });
};

export const subscribeCurrentUserRole = (onChange) => {
  let detachRoleListener = null;

  const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (detachRoleListener) {
      detachRoleListener();
      detachRoleListener = null;
    }

    if (!user) {
      onChange({ isAdmin: false, role: "user", user: null });
      return;
    }

    const userRef = ref(database, `${USERS_PATH}/${user.uid}`);
    detachRoleListener = onValue(userRef, (snapshot) => {
      const data = snapshot.val() || {};
      const role = resolveUserRole(data, user.email || "");
      onChange({ isAdmin: role === "admin", role, user });
    });
  });

  return () => {
    if (detachRoleListener) detachRoleListener();
    unsubscribeAuth();
  };
};
