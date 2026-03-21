import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { onValue, ref, remove, set } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import AdminUserList from "../../components/AdminUserList";
import { database } from "../../services/connectionFirebase";
import {
  addAdminByEmail,
  removeAdminRole,
  resolveUserRole,
  subscribeAdmins,
  subscribeCurrentUserRole,
  subscribeUsers,
} from "../../services/adminService";

type AdminSection = "add" | "admins" | "users" | "tools" | "routes" | "settings";

type AdminRouteItem = {
  id: string;
  titulo: string;
  tipo: string;
  distancia?: string;
  criadoEm?: string;
  autor?: string;
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<AdminSection>("add");
  const [adminEmail, setAdminEmail] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const [admins, setAdmins] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [pendentes, setPendentes] = useState<any[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<any>(null);
  const [officialRoutes, setOfficialRoutes] = useState<AdminRouteItem[]>([]);
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCurrentUserRole(({ isAdmin: adminAllowed, user }: any) => {
      setCurrentUserId(user?.uid || null);
      setIsAdmin(adminAllowed);
      setCheckingAccess(false);

      if (user && !adminAllowed) {
        Alert.alert("Acesso negado", "Esta área é exclusiva para administradores.");
        router.replace("/(tabs)");
      }
    });

    return unsubscribe;
  }, [navigation, router]);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribeAdmins = subscribeAdmins((adminUsers: any[]) => {
      setAdmins(
        adminUsers
          .map((user: any) => ({ ...user, role: resolveUserRole(user, user.email) }))
          .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
      );
    });

    const unsubscribeUsers = subscribeUsers((allUsers: any[]) => {
      setUsers(
        allUsers
          .map((user: any) => ({ ...user, role: resolveUserRole(user, user.email) }))
          .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
      );
    });

    const pendentesRef = ref(database, "rotas_pendentes");
    const unsubscribePendentes = onValue(pendentesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPendentes([]);
        return;
      }

      const data = snapshot.val();
      const lista = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
      setPendentes(lista);
    });

    const oficiaisRef = ref(database, "rotas_oficiais");
    const unsubscribeOfficialRoutes = onValue(oficiaisRef, (snapshot) => {
      if (!snapshot.exists()) {
        setOfficialRoutes([]);
        return;
      }

      const data = snapshot.val();
      const lista: AdminRouteItem[] = Object.keys(data).map((key) => {
        const route = data[key] || {};
        return {
          id: key,
          titulo: String(route.titulo || route.nome || "Rota sem nome"),
          tipo: String(route.tipo || "trilha"),
          distancia: route.distancia ? String(route.distancia) : undefined,
          criadoEm: route.aprovadoEm || route.createdAt || route.dataCriacao,
          autor: route.autor || route.emailAutor || route.userEmail || route.userDisplayName,
        };
      });

      lista.sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""));
      setOfficialRoutes(lista);
    });

    return () => {
      unsubscribeAdmins();
      unsubscribeUsers();
      unsubscribePendentes();
      unsubscribeOfficialRoutes();
    };
  }, [isAdmin]);

  const totalCommonUsers = useMemo(
    () => users.filter((user) => user.role !== "admin").length,
    [users]
  );

  const handleAddAdmin = async () => {
    try {
      setIsAddingAdmin(true);
      await addAdminByEmail(adminEmail);
      setAdminEmail("");
      Alert.alert("Sucesso", "Usuário promovido para administrador.");
      setActiveSection("admins");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Falha ao adicionar administrador.");
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = (adminUser: any) => {
    if (adminUser.uid === currentUserId) {
      Alert.alert("Ação bloqueada", "Você não pode remover seu próprio acesso de admin.");
      return;
    }

    Alert.alert(
      "Remover administrador",
      `Deseja remover privilégios de admin para ${adminUser.email}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await removeAdminRole(adminUser.uid);
              Alert.alert("Sucesso", "Privilégios de administrador removidos.");
            } catch (error: any) {
              Alert.alert("Erro", error.message || "Não foi possível remover o administrador.");
            }
          },
        },
      ]
    );
  };

  const handleAprovarRota = async () => {
    if (!rotaSelecionada) return;

    try {
      const oficialRef = ref(database, `rotas_oficiais/${rotaSelecionada.id}`);
      await set(oficialRef, {
        titulo: rotaSelecionada.nome,
        tipo: rotaSelecionada.tipo,
        startPoint: rotaSelecionada.startPoint,
        endPoint: rotaSelecionada.endPoint,
        rotaCompleta: rotaSelecionada.rotaCompleta,
        autor: rotaSelecionada.emailAutor,
        aprovadoEm: new Date().toISOString(),
      });

      await remove(ref(database, `rotas_pendentes/${rotaSelecionada.id}`));
      setRotaSelecionada(null);
      Alert.alert("Aprovada", "Rota aprovada e publicada.");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível aprovar a rota.");
    }
  };

  const handleRejeitarRota = () => {
    if (!rotaSelecionada) return;

    Alert.alert("Rejeitar rota", "Essa sugestão será removida permanentemente.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rejeitar",
        style: "destructive",
        onPress: async () => {
          try {
            await remove(ref(database, `rotas_pendentes/${rotaSelecionada.id}`));
            setRotaSelecionada(null);
            Alert.alert("Concluído", "Rota rejeitada com sucesso.");
          } catch (error: any) {
            Alert.alert("Erro", error.message || "Não foi possível rejeitar a rota.");
          }
        },
      },
    ]);
  };

  const formatAdminDate = (value?: string) => {
    if (!value) return "Data não informada";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Data não informada";
    return parsed.toLocaleString("pt-BR");
  };

  const handleDeleteOfficialRoute = (routeItem: AdminRouteItem) => {
    Alert.alert(
      "Excluir rota",
      "Tem certeza que deseja excluir esta rota?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingRouteId(routeItem.id);
              await remove(ref(database, `rotas_oficiais/${routeItem.id}`));
              Alert.alert("Rota excluída", "A rota foi removida com sucesso.");
            } catch (error: any) {
              Alert.alert(
                "Erro ao excluir",
                error?.message || "Não foi possível excluir a rota agora."
              );
            } finally {
              setDeletingRouteId(null);
            }
          },
        },
      ]
    );
  };

  const renderSectionButtons = () => (
    <View style={styles.sectionButtons}>
      <TouchableOpacity
        style={[styles.sectionBtn, activeSection === "add" && styles.sectionBtnActive]}
        onPress={() => setActiveSection("add")}
      >
        <Text style={[styles.sectionBtnText, activeSection === "add" && styles.sectionBtnTextActive]}>
          Adicionar administrador
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.sectionBtn, activeSection === "admins" && styles.sectionBtnActive]}
        onPress={() => setActiveSection("admins")}
      >
        <Text style={[styles.sectionBtnText, activeSection === "admins" && styles.sectionBtnTextActive]}>
          Lista de administradores
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.sectionBtn, activeSection === "users" && styles.sectionBtnActive]}
        onPress={() => setActiveSection("users")}
      >
        <Text style={[styles.sectionBtnText, activeSection === "users" && styles.sectionBtnTextActive]}>
          Gerenciar usuários
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.sectionBtn, activeSection === "tools" && styles.sectionBtnActive]}
        onPress={() => setActiveSection("tools")}
      >
        <Text style={[styles.sectionBtnText, activeSection === "tools" && styles.sectionBtnTextActive]}>
          Ferramentas do app
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.sectionBtn, activeSection === "settings" && styles.sectionBtnActive]}
        onPress={() => setActiveSection("settings")}
      >
        <Text style={[styles.sectionBtnText, activeSection === "settings" && styles.sectionBtnTextActive]}>
          Configurações do sistema
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.sectionBtn, activeSection === "routes" && styles.sectionBtnActive]}
        onPress={() => setActiveSection("routes")}
      >
        <Text style={[styles.sectionBtnText, activeSection === "routes" && styles.sectionBtnTextActive]}>
          Gerenciar rotas
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSectionContent = () => {
    if (activeSection === "add") {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Adicionar novo administrador</Text>
          <Text style={styles.sectionDescription}>
            Informe o e-mail de um usuário já cadastrado para conceder acesso administrativo.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Email do usuário"
            placeholderTextColor="#888"
            value={adminEmail}
            onChangeText={setAdminEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={handleAddAdmin}
            disabled={isAddingAdmin}
          >
            {isAddingAdmin ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={18} color="#000" />
                <Text style={styles.primaryActionText}>Adicionar como administrador</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (activeSection === "admins") {
      return (
        <AdminUserList
          title={`Administradores (${admins.length})`}
          users={admins}
          emptyMessage="Nenhum administrador cadastrado."
          actionLabel="Remover"
          onActionPress={handleRemoveAdmin}
          disableActionForUid={currentUserId}
        />
      );
    }

    if (activeSection === "users") {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Usuários cadastrados ({users.length})</Text>
          <Text style={styles.sectionDescription}>
            {totalCommonUsers} usuário(s) comum(ns) e {admins.length} administrador(es).
          </Text>
          <AdminUserList
            title="Lista de usuários"
            users={users}
            emptyMessage="Nenhum usuário cadastrado."
            actionLabel=""
            onActionPress={() => {}}
            disableActionForUid={null}
          />
        </View>
      );
    }

    if (activeSection === "settings") {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Configurações do sistema</Text>
          <Text style={styles.sectionDescription}>
            Área reservada para parâmetros globais do app e controles de segurança.
          </Text>
          <View style={styles.systemItem}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#22c55e" />
            <Text style={styles.systemItemText}>Controle de acesso por role ativo</Text>
          </View>
          <View style={styles.systemItem}>
            <Ionicons name="server-outline" size={20} color="#60a5fa" />
            <Text style={styles.systemItemText}>Conectado ao Firebase Realtime Database</Text>
          </View>
        </View>
      );
    }

    if (activeSection === "routes") {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Rotas oficiais ({officialRoutes.length})</Text>
          <Text style={styles.sectionDescription}>
            Lista completa de rotas cadastradas. Exclua apenas quando necessário.
          </Text>

          {officialRoutes.length === 0 ? (
            <View style={styles.emptyTools}>
              <Ionicons name="trail-sign-outline" size={52} color="#94a3b8" />
              <Text style={styles.emptyToolsText}>Nenhuma rota oficial cadastrada.</Text>
            </View>
          ) : (
            <FlatList
              data={officialRoutes}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.routeCard}>
                  <View style={styles.routeCardIcon}>
                    <Ionicons name="map-outline" size={24} color="#60a5fa" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeCardTitle}>{item.titulo}</Text>
                    <Text style={styles.routeCardMeta}>Tipo: {item.tipo}</Text>
                    <Text style={styles.routeCardMeta}>
                      Distância: {item.distancia || "Não informada"}
                    </Text>
                    <Text style={styles.routeCardMeta}>Criada em: {formatAdminDate(item.criadoEm)}</Text>
                    <Text style={styles.routeCardMeta}>Autor: {item.autor || "Não informado"}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteRouteBtn}
                    disabled={deletingRouteId === item.id}
                    onPress={() => handleDeleteOfficialRoute(item)}
                  >
                    {deletingRouteId === item.id ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      );
    }

    return (
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Ferramentas de gerenciamento do app</Text>
        <Text style={styles.sectionDescription}>
          Modere rotas sugeridas pela comunidade.
        </Text>

        {pendentes.length === 0 ? (
          <View style={styles.emptyTools}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color="#22c55e" />
            <Text style={styles.emptyToolsText}>Nenhuma rota pendente no momento.</Text>
          </View>
        ) : (
          <FlatList
            data={pendentes}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.routeCard} onPress={() => setRotaSelecionada(item)}>
                <View style={styles.routeCardIcon}>
                  <Ionicons name="map-outline" size={24} color="#ffd700" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeCardTitle}>{item.nome}</Text>
                  <Text style={styles.routeCardMeta}>Tipo: {item.tipo}</Text>
                  <Text style={styles.routeCardMeta}>Autor: {item.emailAutor}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#888" />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  };

  return (
    <ImageBackground source={require("../../assets/images/Azulao.png")} style={styles.background}>
      <LinearGradient colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0.95)"]} style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Dashboard</Text>
          <View style={{ width: 28 }} />
        </View>

        {checkingAccess ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#ffd700" />
            <Text style={styles.centerStateText}>Validando permissões...</Text>
          </View>
        ) : !isAdmin ? (
          <View style={styles.centerState}>
            <Ionicons name="lock-closed-outline" size={52} color="#ef4444" />
            <Text style={styles.centerStateText}>Acesso restrito para administradores.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {renderSectionButtons()}
            {renderSectionContent()}
          </ScrollView>
        )}

        <Modal visible={!!rotaSelecionada} animationType="slide">
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            {rotaSelecionada && (
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: rotaSelecionada.startPoint.latitude,
                  longitude: rotaSelecionada.startPoint.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                <Marker coordinate={rotaSelecionada.startPoint} title="Início">
                  <Ionicons name="location" size={40} color="#22c55e" />
                </Marker>
                <Marker coordinate={rotaSelecionada.endPoint} title="Fim">
                  <Ionicons name="flag" size={40} color="#ef4444" />
                </Marker>
                {rotaSelecionada.rotaCompleta && (
                  <Polyline
                    coordinates={rotaSelecionada.rotaCompleta}
                    strokeColor="#ffd700"
                    strokeWidth={5}
                  />
                )}
              </MapView>
            )}

            <View style={styles.modalPanel}>
              <Text style={styles.modalTitle}>{rotaSelecionada?.nome}</Text>
              <Text style={styles.modalSubtitle}>
                A rota parece segura e adequada para publicação?
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: "#ef4444" }]}
                  onPress={handleRejeitarRota}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                  <Text style={styles.modalActionText}>Rejeitar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: "#22c55e" }]}
                  onPress={handleAprovarRota}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.modalActionText}>Aprovar</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.modalBackBtn} onPress={() => setRotaSelecionada(null)}>
                <Text style={styles.modalBackText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: "cover" },
  overlay: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: { padding: 5 },
  title: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerStateText: { color: "#ccc", fontSize: 15 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  sectionButtons: { gap: 10 },
  sectionBtn: {
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sectionBtnActive: {
    backgroundColor: "#ffd700",
    borderColor: "#ffd700",
  },
  sectionBtnText: { color: "#ddd", fontWeight: "700", fontSize: 14 },
  sectionBtnTextActive: { color: "#000" },
  sectionCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    padding: 16,
  },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  sectionDescription: { color: "#aaa", fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#333",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  primaryActionBtn: {
    backgroundColor: "#ffd700",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryActionText: { color: "#000", fontWeight: "700", fontSize: 14 },
  systemItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2c2c2c",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  systemItemText: { color: "#ddd", fontSize: 13 },
  emptyTools: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyToolsText: { color: "#aaa", fontSize: 14 },
  routeCard: {
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2c2c2c",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  routeCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 215, 0, 0.12)",
  },
  routeCardTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  routeCardMeta: { color: "#aaa", fontSize: 12, marginTop: 2 },
  deleteRouteBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.45)",
    backgroundColor: "rgba(127,29,29,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  map: { width: Dimensions.get("window").width, height: Dimensions.get("window").height * 0.65 },
  modalPanel: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#121212",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
  },
  modalTitle: { color: "#fff", fontSize: 21, fontWeight: "700", marginBottom: 4 },
  modalSubtitle: { color: "#aaa", fontSize: 14, marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 12, marginBottom: 10 },
  modalActionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  modalActionText: { color: "#fff", fontWeight: "700" },
  modalBackBtn: { alignItems: "center", paddingVertical: 10 },
  modalBackText: { color: "#aaa", fontWeight: "700" },
});
