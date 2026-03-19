import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, database } from "../../services/connectionFirebase";
import {
  addCommunityComment,
  createCommunityPost,
  getLatestUserActivity,
  subscribeCommunityPosts,
} from "../../services/communityService";

type CommunityComment = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt?: string;
};

type CommunityPost = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  imageUri?: string | null;
  createdAt?: string;
  comments?: CommunityComment[];
  route?: {
    id: string;
    tipo?: string;
    distancia?: string | number;
    data?: string;
    cidade?: string;
  } | null;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("pt-BR");
};

export default function CommunityScreen() {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [uid, setUid] = useState("");
  const [authorName, setAuthorName] = useState("Usuário");
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const [postText, setPostText] = useState("");
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [attachedRoute, setAttachedRoute] = useState<any>(null);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || "");
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    const unsubscribePosts = subscribeCommunityPosts((list: CommunityPost[]) => {
      setPosts(list);
      setLoading(false);
    });

    return unsubscribePosts;
  }, []);

  useEffect(() => {
    if (!uid) {
      setAuthorName("Usuário");
      return;
    }

    const unsubscribeUser = onValue(ref(database, `users/${uid}`), (snapshot) => {
      const data = snapshot.val() || {};
      setAuthorName(data.fullName || data.username || auth.currentUser?.email || "Usuário");
    });

    return unsubscribeUser;
  }, [uid]);

  const canPublish = useMemo(() => {
    return postText.trim().length > 0 && !publishing;
  }, [postText, publishing]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permissão necessária", "Permita acesso à galeria para anexar foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      setSelectedImageUri(result.assets[0].uri);
    }
  };

  const handleAttachLatestRoute = async () => {
    if (!uid) {
      Alert.alert("Erro", "Você precisa estar logado.");
      return;
    }

    try {
      const latestActivity = await getLatestUserActivity(uid);
      if (!latestActivity) {
        Alert.alert("Sem rota", "Nenhuma atividade encontrada para anexar.");
        return;
      }

      setAttachedRoute(latestActivity);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível anexar a rota.");
    }
  };

  const handlePublishPost = async () => {
    if (!uid) {
      Alert.alert("Erro", "Você precisa estar logado.");
      return;
    }

    try {
      setPublishing(true);
      await createCommunityPost({
        authorId: uid,
        authorName,
        text: postText,
        imageUri: selectedImageUri,
        route: attachedRoute,
      });

      setPostText("");
      setSelectedImageUri(null);
      setAttachedRoute(null);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível publicar seu post.");
    } finally {
      setPublishing(false);
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentInputs[postId] || "").trim();

    if (!text) {
      Alert.alert("Comentário vazio", "Digite algo para comentar.");
      return;
    }

    if (!uid) {
      Alert.alert("Erro", "Você precisa estar logado.");
      return;
    }

    try {
      setCommentingPostId(postId);
      await addCommunityComment({
        postId,
        authorId: uid,
        authorName,
        text,
      });

      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível adicionar comentário.");
    } finally {
      setCommentingPostId(null);
    }
  };

  const renderPost = ({ item }: { item: CommunityPost }) => {
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View>
            <Text style={styles.postAuthor}>{item.authorName || "Usuário"}</Text>
            <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        <Text style={styles.postText}>{item.text}</Text>

        {item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.postImage} /> : null}

        {item.route ? (
          <View style={styles.routeBox}>
            <Text style={styles.routeTitle}>Rota vinculada</Text>
            <Text style={styles.routeText}>Tipo: {item.route.tipo || "Atividade"}</Text>
            <Text style={styles.routeText}>Distância: {item.route.distancia || 0} km</Text>
            <Text style={styles.routeText}>Data: {item.route.data || "-"}</Text>
          </View>
        ) : null}

        <Text style={styles.commentsTitle}>Comentários</Text>
        {(item.comments || []).length === 0 ? (
          <Text style={styles.emptyCommentText}>Seja o primeiro a comentar.</Text>
        ) : (
          (item.comments || []).map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <Text style={styles.commentAuthor}>{comment.authorName}</Text>
              <Text style={styles.commentText}>{comment.text}</Text>
            </View>
          ))
        )}

        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            value={commentInputs[item.id] || ""}
            onChangeText={(value) =>
              setCommentInputs((prev) => ({ ...prev, [item.id]: value }))
            }
            placeholder="Adicionar comentário"
            placeholderTextColor="#888"
          />
          <TouchableOpacity
            style={styles.commentButton}
            onPress={() => handleAddComment(item.id)}
            disabled={commentingPostId === item.id}
          >
            {commentingPostId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground source={require("../../assets/images/Azulao.png")} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Criar publicação</Text>
          <TextInput
            style={styles.postInput}
            value={postText}
            onChangeText={setPostText}
            placeholder="Compartilhe sua trilha de hoje"
            placeholderTextColor="#888"
            multiline
          />

          {selectedImageUri ? <Image source={{ uri: selectedImageUri }} style={styles.previewImage} /> : null}

          {attachedRoute ? (
            <View style={styles.attachedRouteBox}>
              <Text style={styles.attachedRouteText}>
                Rota: {attachedRoute.tipo} - {attachedRoute.distancia || 0} km
              </Text>
              <TouchableOpacity onPress={() => setAttachedRoute(null)}>
                <Ionicons name="close-circle" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.createActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handlePickImage}>
              <Ionicons name="image" size={18} color="#ddd" />
              <Text style={styles.secondaryBtnText}>Foto</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleAttachLatestRoute}>
              <Ionicons name="map" size={18} color="#ddd" />
              <Text style={styles.secondaryBtnText}>Última rota</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, !canPublish && styles.primaryBtnDisabled]}
              onPress={handlePublishPost}
              disabled={!canPublish}
            >
              {publishing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Publicar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color="#1e4db7" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyFeed}>Nenhuma publicação ainda.</Text>}
          />
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 12,
  },
  createCard: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  createTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 8,
  },
  postInput: {
    minHeight: 74,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    color: "#fff",
    padding: 10,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  previewImage: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 8,
  },
  attachedRouteBox: {
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attachedRouteText: {
    color: "#ddd",
    fontSize: 12,
  },
  createActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2b2b2b",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: "#ddd",
    fontSize: 12,
    fontWeight: "700",
  },
  primaryBtn: {
    marginLeft: "auto",
    backgroundColor: "#1e4db7",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 88,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  loadingBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 30,
  },
  postCard: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  postAuthor: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  postDate: {
    color: "#9d9d9d",
    fontSize: 11,
    marginTop: 2,
  },
  postText: {
    color: "#e8e8e8",
    fontSize: 14,
    marginBottom: 8,
  },
  postImage: {
    width: "100%",
    height: 190,
    borderRadius: 10,
    marginBottom: 8,
  },
  routeBox: {
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  routeTitle: {
    color: "#fff",
    fontWeight: "700",
    marginBottom: 3,
    fontSize: 13,
  },
  routeText: {
    color: "#bbb",
    fontSize: 12,
  },
  commentsTitle: {
    color: "#fff",
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 6,
    fontSize: 13,
  },
  emptyCommentText: {
    color: "#9d9d9d",
    fontSize: 12,
    marginBottom: 8,
  },
  commentCard: {
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  commentAuthor: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  commentText: {
    color: "#ddd",
    fontSize: 12,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  commentButton: {
    backgroundColor: "#1e4db7",
    borderRadius: 8,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyFeed: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 30,
  },
});
