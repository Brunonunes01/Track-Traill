import { get, onValue, push, ref, set } from "firebase/database";
import { database, normalizeFirebaseErrorMessage } from "./connectionFirebase";

const COMMUNITY_POSTS_PATH = "communityPosts";

const mapPostsSnapshot = (snapshot) => {
  if (!snapshot.exists()) return [];

  const data = snapshot.val();

  return Object.keys(data)
    .map((id) => {
      const post = data[id] || {};
      const commentsObj = post.comments || {};
      const comments = Object.keys(commentsObj)
        .map((commentId) => ({ id: commentId, ...commentsObj[commentId] }))
        .sort(
          (a, b) =>
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );

      return {
        id,
        ...post,
        comments,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
};

export const subscribeCommunityPosts = (onChange, onError) => {
  return onValue(
    ref(database, COMMUNITY_POSTS_PATH),
    (snapshot) => {
      onChange(mapPostsSnapshot(snapshot));
    },
    (error) => {
      const message = normalizeFirebaseErrorMessage(error, "Falha ao carregar a comunidade.");
      console.warn("[community] subscribeCommunityPosts failed:", message);
      if (typeof onError === "function") {
        onError(new Error(message));
      }
    }
  );
};

export const createCommunityPost = async ({
  authorId,
  authorName,
  text,
  imageUri,
  route,
}) => {
  if (!authorId) throw new Error("Usuário inválido para publicação.");
  if (!text?.trim()) throw new Error("Digite um texto para o post.");

  try {
    const postRef = push(ref(database, COMMUNITY_POSTS_PATH));

    await set(postRef, {
      authorId,
      authorName: authorName || "Usuário",
      text: text.trim(),
      imageUri: imageUri || null,
      route: route || null,
      createdAt: new Date().toISOString(),
      comments: {},
    });

    return postRef.key;
  } catch (error) {
    throw new Error(normalizeFirebaseErrorMessage(error, "Não foi possível criar o post."));
  }
};

export const addCommunityComment = async ({
  postId,
  authorId,
  authorName,
  text,
}) => {
  if (!postId) throw new Error("Post inválido.");
  if (!authorId) throw new Error("Usuário inválido.");
  if (!text?.trim()) throw new Error("Digite um comentário.");

  try {
    const commentRef = push(ref(database, `${COMMUNITY_POSTS_PATH}/${postId}/comments`));

    await set(commentRef, {
      authorId,
      authorName: authorName || "Usuário",
      text: text.trim(),
      createdAt: new Date().toISOString(),
    });

    return commentRef.key;
  } catch (error) {
    throw new Error(
      normalizeFirebaseErrorMessage(error, "Não foi possível adicionar o comentário.")
    );
  }
};

export const getLatestUserActivity = async (uid) => {
  if (!uid) return null;

  let snapshot;
  try {
    snapshot = await get(ref(database, `users/${uid}/atividades`));
  } catch (error) {
    throw new Error(
      normalizeFirebaseErrorMessage(error, "Não foi possível carregar a última atividade.")
    );
  }

  if (!snapshot.exists()) return null;

  const activities = Object.keys(snapshot.val()).map((id) => ({
    id,
    ...snapshot.val()[id],
  }));

  if (!activities.length) return null;

  const latest = activities.sort(
    (a, b) =>
      new Date(b.criadoEm || b.data || 0).getTime() -
      new Date(a.criadoEm || a.data || 0).getTime()
  )[0];

  return {
    id: latest.id,
    tipo: latest.tipo || "Atividade",
    distancia: latest.distancia || 0,
    data: latest.data || "",
    cidade: latest.cidade || "",
    coordenadas:
      Array.isArray(latest.rota) && latest.rota[0]
        ? {
            latitude: latest.rota[0].latitude,
            longitude: latest.rota[0].longitude,
          }
        : null,
  };
};

const calculateSessionDurationSeconds = (session) => {
  if (!session) return 0;

  const finishTimestamp =
    session.status === "finished"
      ? session.endedAt || Date.now()
      : session.status === "paused"
        ? session.pausedAt || Date.now()
        : Date.now();

  const elapsedMs = Math.max(
    0,
    finishTimestamp - (session.startedAt || Date.now()) - (session.pausedDurationMs || 0)
  );

  return Math.floor(elapsedMs / 1000);
};

const getAuthorProfile = async (uid) => {
  if (!uid) {
    return { authorName: "Usuário", authorPhotoUrl: null };
  }

  let snapshot;
  try {
    snapshot = await get(ref(database, `users/${uid}`));
  } catch (error) {
    throw new Error(
      normalizeFirebaseErrorMessage(error, "Não foi possível carregar o perfil do autor.")
    );
  }
  const data = snapshot.exists() ? snapshot.val() : {};

  return {
    authorName: data.fullName || data.username || data.email || "Usuário",
    authorPhotoUrl: data.photoUrl || data.avatarUrl || null,
  };
};

export const createActivitySharePost = async ({
  userId,
  session,
  activityId,
  routeId,
  routeName,
  caption,
  activityType,
}) => {
  if (!userId) throw new Error("Usuário inválido para compartilhar atividade.");
  if (!session?.points?.length || session.points.length < 2) {
    throw new Error("Trajeto insuficiente para compartilhar.");
  }

  const { authorName, authorPhotoUrl } = await getAuthorProfile(userId);
  const durationSec = calculateSessionDurationSeconds(session);
  const path = session.points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));

  try {
    const postRef = push(ref(database, COMMUNITY_POSTS_PATH));
    await set(postRef, {
      postType: "activity_share",
      visibility: "friends",
      authorId: userId,
      authorName,
      authorPhotoUrl,
      activityId: activityId || session.id,
      routeId: routeId || null,
      routeName: routeName || null,
      activityType: activityType || session.activityType || "trilha",
      distanceKm: Number(session.distanceKm || 0),
      durationSec,
      caption: (caption || "").trim(),
      activityDate: new Date(session.endedAt || Date.now()).toISOString(),
      routeSnapshot: {
        points: path,
        startPoint: path[0] || null,
        endPoint: path[path.length - 1] || null,
      },
      createdAt: new Date().toISOString(),
      comments: {},
    });

    return postRef.key;
  } catch (error) {
    throw new Error(
      normalizeFirebaseErrorMessage(error, "Não foi possível compartilhar a atividade.")
    );
  }
};
