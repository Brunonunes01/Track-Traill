import { get, onValue, push, ref, set } from "firebase/database";
import { database } from "./connectionFirebase";

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

export const subscribeCommunityPosts = (onChange) => {
  return onValue(ref(database, COMMUNITY_POSTS_PATH), (snapshot) => {
    onChange(mapPostsSnapshot(snapshot));
  });
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

  const commentRef = push(ref(database, `${COMMUNITY_POSTS_PATH}/${postId}/comments`));

  await set(commentRef, {
    authorId,
    authorName: authorName || "Usuário",
    text: text.trim(),
    createdAt: new Date().toISOString(),
  });

  return commentRef.key;
};

export const getLatestUserActivity = async (uid) => {
  if (!uid) return null;

  const snapshot = await get(ref(database, `users/${uid}/atividades`));

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
