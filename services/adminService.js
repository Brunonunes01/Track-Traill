import { onAuthStateChanged } from "firebase/auth";
import {
  equalTo,
  get,
  onValue,
  orderByChild,
  query,
  ref,
  update,
} from "firebase/database";
import { auth, database } from "./connectionFirebase";

const USERS_PATH = "users";
const LEGACY_ADMIN_EMAILS = ["brunonunes01@gmail.com"];

const normalizeEmail = (email) => (email || "").trim().toLowerCase();

// Mantém compatibilidade com contas antigas sem role explícita.
export const resolveUserRole = (userRecord, email) => {
  const normalized = normalizeEmail(email || userRecord?.email);
  if (userRecord?.role === "admin") return "admin";
  if (LEGACY_ADMIN_EMAILS.includes(normalized)) return "admin";
  return "user";
};

export const ensureUserRole = async (uid, email) => {
  if (!uid) return "user";
  const userRef = ref(database, `${USERS_PATH}/${uid}`);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) return "user";

  const userData = snapshot.val();
  const resolvedRole = resolveUserRole(userData, email);

  if (!userData.role || userData.role !== resolvedRole) {
    await update(userRef, { role: resolvedRole });
  }

  return resolvedRole;
};

export const addAdminByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Informe um e-mail válido.");
  }

  const usersRef = ref(database, USERS_PATH);
  const userByEmailQuery = query(
    usersRef,
    orderByChild("email"),
    equalTo(normalizedEmail)
  );
  const snapshot = await get(userByEmailQuery);

  if (!snapshot.exists()) {
    throw new Error("Usuário não encontrado para este e-mail.");
  }

  const users = snapshot.val();
  const uid = Object.keys(users)[0];
  await update(ref(database, `${USERS_PATH}/${uid}`), { role: "admin" });

  return { uid, ...users[uid], role: "admin" };
};

export const removeAdminRole = async (uid) => {
  if (!uid) throw new Error("Usuário inválido.");
  await update(ref(database, `${USERS_PATH}/${uid}`), { role: "user" });
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

    await ensureUserRole(user.uid, user.email || "");

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
