import { get, onValue, ref, runTransaction, set, update } from "firebase/database";
import { database, normalizeFirebaseErrorMessage } from "../../services/connectionFirebase";

type EnsureProfileInput = {
  uid: string;
  email?: string;
  fullName?: string;
};

type RegisterProfileInput = {
  uid: string;
  fullName: string;
  username: string;
  email: string;
};

type UpdateProfileInput = {
  uid: string;
  fullName: string;
  username: string;
};

export const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");

export const isUsernameValid = (value: string) => /^[a-z0-9_]{3,20}$/.test(value);

const USERNAME_FLOW_PREFIX = "[username-flow]";
const CONNECTION_TIMEOUT_MS = 3000;

const ensureDatabaseConnected = async () => {
  // O Firebase no React Native já gerencia a conectividade internamente.
  // Uma verificação adicional em '.info/connected' garante que estamos online no RTDB.
  const connectedRef = ref(database, ".info/connected");

  await new Promise<void>((resolve, reject) => {
    let finished = false;
    let unsubscribe = () => {};

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      unsubscribe();
      reject(new Error("Não foi possível confirmar conexão com o servidor."));
    }, CONNECTION_TIMEOUT_MS);

    unsubscribe = onValue(
      connectedRef,
      (snapshot) => {
        if (finished) return;
        const connected = snapshot.val() === true;
        if (!connected) return;
        finished = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      },
      (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      }
    );
  });
};

const reserveUsername = async (username: string, uid: string) => {
  const normalized = normalizeUsername(username);
  if (!isUsernameValid(normalized)) {
    throw new Error(
      "Username inválido. Use 3-20 caracteres com letras minúsculas, números ou underscore."
    );
  }
  if (!uid?.trim()) {
    throw new Error("Sessão inválida para reservar username.");
  }

  const txPath = `usernames/${normalized}`;

  try {
    console.info(`${USERNAME_FLOW_PREFIX} transaction:start`, { path: txPath, uid });
    await ensureDatabaseConnected();

    const usernameRef = ref(database, txPath);
    const transactionResult = await runTransaction(usernameRef, (current) => {
      if (current === null || current === uid) {
        return uid;
      }
      return current;
    });

    if (!transactionResult.committed) {
      console.warn(`${USERNAME_FLOW_PREFIX} transaction:abort`, {
        path: txPath,
        uid,
        reason: "username_already_taken",
      });
      throw new Error("Este username já está em uso.");
    }

    console.info(`${USERNAME_FLOW_PREFIX} transaction:success`, { path: txPath, uid });
    return normalized;
  } catch (error: any) {
    const message = normalizeFirebaseErrorMessage(
      error,
      "Falha ao reservar username."
    );

    console.error(`${USERNAME_FLOW_PREFIX} transaction:failure`, {
      path: txPath,
      uid,
      reason: String((error as any)?.code || "").toLowerCase().includes("disconnect")
        ? "disconnect"
        : "error",
      rawMessage: error?.message || String(error),
    });

    throw new Error(message);
  }
};

const releaseUsername = async (username?: string) => {
  const normalized = normalizeUsername(username || "");
  if (!normalized) return;
  try {
    await set(ref(database, `usernames/${normalized}`), null);
  } catch (error: any) {
    console.warn("[username-flow] release failed:", normalizeFirebaseErrorMessage(error));
  }
};

const createCandidateFromSource = (source: string) => {
  const base = normalizeUsername(source).replace(/_+/g, "_");
  if (base.length >= 3) return base.slice(0, 20);
  return `track_${Math.random().toString(36).slice(2, 8)}`;
};

const generateUniqueUsername = async (source: string, uid: string) => {
  const base = createCandidateFromSource(source);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = attempt === 0 ? "" : `_${Math.floor(Math.random() * 9999)}`;
    const candidate = normalizeUsername(`${base}${suffix}`).slice(0, 20);
    if (!isUsernameValid(candidate)) {
      continue;
    }

    try {
      return await reserveUsername(candidate, uid);
    } catch (error: any) {
      if (error?.message !== "Este username já está em uso.") {
        throw error;
      }
      // Tentativa seguinte quando o candidato já está ocupado.
    }
  }

  throw new Error("Não foi possível gerar username único automaticamente.");
};

export const registerUserProfile = async (input: RegisterProfileInput) => {
  const normalized = await reserveUsername(input.username, input.uid);

  await set(ref(database, `users/${input.uid}`), {
    fullName: input.fullName.trim(),
    username: normalized,
    email: input.email,
    role: "user",
    createdAt: new Date().toISOString(),
  });

  return normalized;
};

export const ensureUserProfileCompatibility = async (input: EnsureProfileInput) => {
  const userRef = ref(database, `users/${input.uid}`);
  const snapshot = await get(userRef);

  const baseName = input.fullName || input.email || `user_${input.uid.slice(0, 6)}`;
  const existing = snapshot.exists() ? snapshot.val() : {};

  let username = normalizeUsername(existing.username || "");

  if (!isUsernameValid(username)) {
    username = await generateUniqueUsername(baseName, input.uid);
  } else {
    await reserveUsername(username, input.uid);
  }

  const payload = {
    fullName: existing.fullName || input.fullName || "Usuário",
    username,
    email: existing.email || input.email || "",
    role: existing.role || "user",
    updatedAt: new Date().toISOString(),
  };

  if (!snapshot.exists()) {
    await set(userRef, { ...payload, createdAt: new Date().toISOString() });
  } else {
    await update(userRef, payload);
  }

  return payload;
};

export const updatePublicProfile = async (input: UpdateProfileInput) => {
  const userRef = ref(database, `users/${input.uid}`);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) {
    throw new Error("Perfil não encontrado.");
  }

  const current = snapshot.val();
  const currentUsername = normalizeUsername(current.username || "");
  const newUsername = normalizeUsername(input.username);

  if (!isUsernameValid(newUsername)) {
    throw new Error(
      "Username inválido. Use 3-20 caracteres com letras minúsculas, números ou underscore."
    );
  }

  if (newUsername !== currentUsername) {
    await reserveUsername(newUsername, input.uid);
    await releaseUsername(currentUsername);
  }

  await update(userRef, {
    fullName: input.fullName.trim(),
    username: newUsername,
    updatedAt: new Date().toISOString(),
  });

  return {
    fullName: input.fullName.trim(),
    username: newUsername,
  };
};
