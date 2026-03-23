import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../services/connectionFirebase";
import { ensureUserProfileCompatibility } from "../services/userService";
import {
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
  subscribeFriendships,
  subscribeUsers,
} from "../../services/friendsService";

type AppUser = {
  uid: string;
  fullName?: string;
  username?: string;
  photoUrl?: string;
};

type Friendship = {
  id: string;
  senderId: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt?: string;
};

const getUserDisplayName = (user?: AppUser) => {
  if (!user) return "Usuário";
  return user.fullName || user.username || "Usuário";
};

const getPublicUsername = (user?: AppUser) => {
  if (!user) return "@sem_username";
  return `@${user.username || "sem_username"}`;
};

const sortByCreatedAtDesc = (a: Friendship, b: Friendship) => {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
};

type FriendsScreenProps = {
  navigation?: any;
};

export default function FriendsScreen(props: FriendsScreenProps) {
  const hookNavigation = useNavigation<any>();
  const navigation = props.navigation || hookNavigation;
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [sendingToUid, setSendingToUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || "");
      if (user) {
        ensureUserProfileCompatibility({
          uid: user.uid,
          email: user.email || "",
        }).catch((error: any) => {
          console.error("[username-flow] ensure-profile:failure", {
            screen: "FriendsScreen",
            uid: user.uid,
            reason: error?.message || String(error),
          });
          Alert.alert(
            "Aviso",
            "Não foi possível sincronizar seu username agora. Você pode continuar usando o app."
          );
        });
      }
      setLoading(false);
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    const unsubscribeUsers = subscribeUsers(
      (list: AppUser[]) => {
        setUsers(list);
      },
      (error: any) => {
        console.warn("[friends] users subscription error:", error?.message || String(error));
      }
    );

    const unsubscribeFriendships = subscribeFriendships(
      (list: Friendship[]) => {
        setFriendships(list);
      },
      (error: any) => {
        console.warn("[friends] friendships subscription error:", error?.message || String(error));
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeFriendships();
    };
  }, []);

  const usersById = useMemo(() => {
    return users.reduce((acc: Record<string, AppUser>, item) => {
      acc[item.uid] = item;
      return acc;
    }, {});
  }, [users]);

  const pendingReceived = useMemo(() => {
    if (!uid) return [];
    return friendships
      .filter((item) => item.status === "pending" && item.receiverId === uid)
      .sort(sortByCreatedAtDesc);
  }, [friendships, uid]);

  const pendingSent = useMemo(() => {
    if (!uid) return [];
    return friendships
      .filter((item) => item.status === "pending" && item.senderId === uid)
      .sort(sortByCreatedAtDesc);
  }, [friendships, uid]);

  const friends = useMemo(() => {
    if (!uid) return [];

    const accepted = friendships.filter(
      (item) =>
        item.status === "accepted" &&
        (item.senderId === uid || item.receiverId === uid)
    );

    return accepted
      .map((item) => {
        const friendId = item.senderId === uid ? item.receiverId : item.senderId;
        return usersById[friendId];
      })
      .filter(Boolean) as AppUser[];
  }, [friendships, uid, usersById]);

  const searchResults = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text || !uid) return [];

    return users
      .filter((item) => item.uid !== uid)
      .filter((item) => {
        const query = text.replace(/^@/, "");
        const haystack = `${item.fullName || ""} ${item.username || ""}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 15);
  }, [search, users, uid]);

  const getRelationshipStatus = (targetUid: string) => {
    return friendships.find(
      (item) =>
        (item.senderId === uid && item.receiverId === targetUid) ||
        (item.senderId === targetUid && item.receiverId === uid)
    );
  };

  const handleSendRequest = async (targetUid: string) => {
    if (!uid) {
      Alert.alert("Erro", "Você precisa estar autenticado.");
      return;
    }

    try {
      setSendingToUid(targetUid);
      await sendFriendRequest({ senderId: uid, receiverId: targetUid });
      Alert.alert("Solicitação enviada", "Pedido de amizade enviado com sucesso.");
    } catch (error: any) {
      Alert.alert("Não foi possível enviar", error.message || "Erro ao enviar solicitação.");
    } finally {
      setSendingToUid(null);
    }
  };

  const handleRequestAction = async (requestId: string, action: "accept" | "reject") => {
    try {
      setSavingRequestId(requestId);

      if (action === "accept") {
        await acceptFriendRequest(requestId);
      } else {
        await rejectFriendRequest(requestId);
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível atualizar a solicitação.");
    } finally {
      setSavingRequestId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e4db7" />
        <Text style={styles.loadingText}>Carregando amigos...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={require("../../assets/images/Azulao.png")} style={styles.background}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity
            style={styles.feedButton}
            onPress={() => navigation.navigate("Ajuda")}
          >
            <Ionicons name="people-circle-outline" size={18} color="#d1d5db" />
            <Text style={styles.feedButtonText}>Abrir feed dos amigos</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Buscar usuários</Text>
          <View style={styles.searchCard}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por @username ou nome"
              placeholderTextColor="#8a8a8a"
              autoCapitalize="none"
            />

            {searchResults.length === 0 && search.trim() ? (
              <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>
            ) : null}

            {searchResults.map((item) => {
              const relation = getRelationshipStatus(item.uid);
              const canSend = !relation || relation.status === "rejected";

              return (
                <View key={item.uid} style={styles.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{getUserDisplayName(item)}</Text>
                    <Text style={styles.rowSubtitle}>{getPublicUsername(item)}</Text>
                  </View>

                  {canSend ? (
                    <TouchableOpacity
                      style={styles.primaryAction}
                      onPress={() => handleSendRequest(item.uid)}
                      disabled={sendingToUid === item.uid}
                    >
                      {sendingToUid === item.uid ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.primaryActionText}>Adicionar</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {relation?.status === "accepted" ? "Amigo" : "Pendente"}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Solicitações recebidas</Text>
          <View style={styles.blockCard}>
            {pendingReceived.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma solicitação recebida.</Text>
            ) : (
              pendingReceived.map((request) => {
                const sender = usersById[request.senderId];
                return (
                  <View key={request.id} style={styles.rowCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{getUserDisplayName(sender)}</Text>
                      <Text style={styles.rowSubtitle}>{getPublicUsername(sender)}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleRequestAction(request.id, "accept")}
                      disabled={savingRequestId === request.id}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleRequestAction(request.id, "reject")}
                      disabled={savingRequestId === request.id}
                    >
                      <Ionicons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          <Text style={styles.sectionTitle}>Solicitações enviadas</Text>
          <View style={styles.blockCard}>
            {pendingSent.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma solicitação enviada.</Text>
            ) : (
              pendingSent.map((request) => {
                const receiver = usersById[request.receiverId];
                return (
                  <View key={request.id} style={styles.rowCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{getUserDisplayName(receiver)}</Text>
                      <Text style={styles.rowSubtitle}>{getPublicUsername(receiver)}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>Pendente</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <Text style={styles.sectionTitle}>Amigos</Text>
          <View style={styles.blockCard}>
            {friends.length === 0 ? (
              <Text style={styles.emptyText}>Você ainda não possui amigos aceitos.</Text>
            ) : (
              friends.map((friend) => (
                <View key={friend.uid} style={styles.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{getUserDisplayName(friend)}</Text>
                    <Text style={styles.rowSubtitle}>{getPublicUsername(friend)}</Text>
                  </View>
                  <Ionicons name="people" size={18} color="#1e4db7" />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111",
  },
  loadingText: {
    color: "#bbb",
    marginTop: 10,
  },
  background: {
    flex: 1,
    resizeMode: "cover",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  feedButton: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  feedButtonText: {
    color: "#d1d5db",
    fontWeight: "700",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 8,
  },
  searchCard: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  blockCard: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#3b3b3b",
    backgroundColor: "#151515",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  rowTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  rowSubtitle: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },
  primaryAction: {
    backgroundColor: "#1e4db7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  acceptBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadge: {
    backgroundColor: "#303030",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: "#ddd",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyText: {
    color: "#aaa",
    fontSize: 13,
  },
});
