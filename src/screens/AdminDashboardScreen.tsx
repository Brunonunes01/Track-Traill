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
import { toCoordinate, toCoordinateArray } from "../utils/geo";
import { TrailAlert } from "../models/alerts";
import {
  markAlertAsResolved,
  removeAlertByAdmin,
  subscribeAllAlertsForAdmin,
} from "../services/alertService";
import {
  addAdminByEmail,
  removeAdminRole,
  resolveUserRole,
  subscribeAdmins,
  subscribeCurrentUserRole,
  subscribeUsers,
} from "../../services/adminService";

type AdminSection = "add" | "admins" | "users" | "tools" | "routes" | "settings" | "alerts";
type AlertFilter = "todos" | "ativos" | "expirados" | "denunciados" | "resolvidos" | "removidos";

type AdminRouteItem = {
  id: string;
  titulo: string;
  tipo: string;
  distancia?: string;
  criadoEm?: string;
  autor?: string;
};

type AdminDashboardScreenProps = {
  navigation?: any;
};

export default function AdminDashboardScreen(props: AdminDashboardScreenProps) {
  const hookNavigation = useNavigation<any>();
  const navigation = props.navigation || hookNavigation;
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
  const [alerts, setAlerts] = useState<TrailAlert[]>([]);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("todos");
  const [workingAlertId, setWorkingAlertId] = useState<string | null>(null);

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

    const unsubscribeAlerts = subscribeAllAlertsForAdmin(
      (incoming) => {
        setAlerts(incoming);
      },
      () => {
        setAlerts([]);
      }
    );

    return () => {
      unsubscribeAdmins();
      unsubscribeUsers();
      unsubscribePendentes();
      unsubscribeOfficialRoutes();
      unsubscribeAlerts();
    };
  }, [isAdmin]);

  const totalCommonUsers = useMemo(
    () => users.filter((user) => user.role !== "admin").length,
    [users]
  );

  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      if (alertFilter === "todos") return true;
      if (alertFilter === "ativos") return item.status === "ativo";
      if (alertFilter === "expirados") return item.status === "expirado";
      if (alertFilter === "resolvidos") return item.status === "resolvido";
      if (alertFilter === "removidos") return item.status === "removido";
      if (alertFilter === "denunciados") return (item.reportCount || 0) > 0;
      return true;
    });
  }, [alertFilter, alerts]);

  const formatAlertDate = (value?: string) => {
    if (!value) return "Data não informada";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Data não informada";
    return parsed.toLocaleString("pt-BR");
  };

  const reportSummary = (item: TrailAlert) => {
    if (!item.reports) return "Sem denúncias";
    const reasons = Object.values(item.reports).reduce<Record<string, number>>((acc, report) => {
      const key = report.reason;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const entries = Object.entries(reasons);
    if (entries.length === 0) return "Sem denúncias";
    return entries.map(([reason, count]) => `${reason}: ${count}`).join(" | ");
  };

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
      const safeStartPoint = toCoordinate(rotaSelecionada.startPoint);
      const safeEndPoint = toCoordinate(rotaSelecionada.endPoint);
      const safePath = toCoordinateArray(rotaSelecionada.rotaCompleta);

      if (!safeStartPoint || !safeEndPoint || safePath.length < 2) {
        Alert.alert("Rota inválida", "Esta sugestão tem coordenadas incompletas e não pode ser aprovada.");
        return;
      }

      const oficialRef = ref(database, `rotas_oficiais/${rotaSelecionada.id}`);
      await set(oficialRef, {
        titulo: rotaSelecionada.nome,
        tipo: rotaSelecionada.tipo,
        startPoint: safeStartPoint,
        endPoint: safeEndPoint,
        rotaCompleta: safePath,
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

  const handleResolveAlertAdmin = async (alertId: string) => {
    try {
      setWorkingAlertId(alertId);
      await markAlertAsResolved(alertId);
      Alert.alert("Alerta atualizado", "Alerta marcado como resolvido.");
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Não foi possível resolver o alerta.");
    } finally {
      setWorkingAlertId(null);
    }
  };

  const handleRemoveAlertAdmin = (alertId: string) => {
    Alert.alert("Remover alerta", "Este alerta será ocultado para usuários comuns.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            setWorkingAlertId(alertId);
            await removeAlertByAdmin(alertId, currentUserId);
            Alert.alert("Alerta removido", "O alerta foi removido da visualização pública.");
          } catch (error: any) {
            Alert.alert("Erro", error?.message || "Não foi possível remover o alerta.");
          } finally {
            setWorkingAlertId(null);
          }
        },
      },
    ]);
  };

  const selectedStartPoint = useMemo(() => toCoordinate(rotaSelecionada?.startPoint), [rotaSelecionada]);
  const selectedEndPoint = useMemo(() => toCoordinate(rotaSelecionada?.endPoint), [rotaSelecionada]);
  const selectedPath = useMemo(() => toCoordinateArray(rotaSelecionada?.rotaCompleta), [rotaSelecionada]);

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

      <TouchableOpacity
        style={[styles.sectionBtn, activeSection === "alerts" && styles.sectionBtnActive]}
        onPress={() => setActiveSection("alerts")}
      >
        <Text style={[styles.sectionBtnText, activeSection === "alerts" && styles.sectionBtnTextActive]}>
          Moderação de alertas
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

    if (activeSection === "alerts") {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Moderação de alertas ({alerts.length})</Text>
          <Text style={styles.sectionDescription}>
            Filtre por status e trate denúncias para manter o sistema confiável.
          </Text>

          <View style={styles.alertFilterRow}>
            {(
              [
                { key: "todos", label: "Todos" },
                { key: "ativos", label: "Ativos" },
                { key: "expirados", label: "Expirados" },
                { key: "denunciados", label: "Denunciados" },
                { key: "resolvidos", label: "Resolvidos" },
                { key: "removidos", label: "Removidos" },
              ] as { key: AlertFilter; label: string }[]
            ).map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => setAlertFilter(item.key)}
                style={[
                  styles.alertFilterChip,
                  alertFilter === item.key ? styles.alertFilterChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.alertFilterText,
                    alertFilter === item.key ? styles.alertFilterTextActive : null,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredAlerts.length === 0 ? (
            <View style={styles.emptyTools}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyToolsText}>Nenhum alerta para o filtro atual.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredAlerts}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.alertAdminCard}>
                  <View style={styles.alertAdminHeader}>
                    <Text style={styles.alertAdminType}>{item.type}</Text>
                    <Text style={styles.alertAdminStatus}>Status: {item.status}</Text>
                  </View>

                  <Text style={styles.alertAdminDescription}>{item.description}</Text>
                  <Text style={styles.alertAdminMeta}>Criado: {formatAlertDate(item.createdAt)}</Text>
                  <Text style={styles.alertAdminMeta}>Expira: {formatAlertDate(item.expiresAt)}</Text>
                  <Text style={styles.alertAdminMeta}>Rota: {item.routeName || "Não vinculada"}</Text>
                  <Text style={styles.alertAdminMeta}>Denúncias: {item.reportCount || 0}</Text>
                  <Text style={styles.alertAdminMeta}>Resumo denúncias: {reportSummary(item)}</Text>
                  {item.reports
                    ? Object.values(item.reports)
                        .slice(0, 3)
                        .map((report, index) => (
                          <Text key={`${item.id}-report-${index}`} style={styles.alertAdminReportItem}>
                            • {report.reason} — {report.userEmail || report.userDisplayName || report.userId}
                          </Text>
                        ))
                    : null}

                  <View style={styles.alertAdminActions}>
                    <TouchableOpacity
                      style={styles.alertResolveBtn}
                      disabled={workingAlertId === item.id || item.status !== "ativo"}
                      onPress={() => handleResolveAlertAdmin(item.id)}
                    >
                      {workingAlertId === item.id ? (
                        <ActivityIndicator size="small" color="#d1fae5" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={16} color="#d1fae5" />
                          <Text style={styles.alertResolveText}>Resolver</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.alertRemoveBtn}
                      disabled={workingAlertId === item.id || item.status === "removido"}
                      onPress={() => handleRemoveAlertAdmin(item.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fecaca" />
                      <Text style={styles.alertRemoveText}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
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
            {rotaSelecionada && selectedStartPoint ? (
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: selectedStartPoint.latitude,
                  longitude: selectedStartPoint.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                <Marker coordinate={selectedStartPoint} title="Início">
                  <Ionicons name="location" size={40} color="#22c55e" />
                </Marker>
                {selectedEndPoint ? (
                  <Marker coordinate={selectedEndPoint} title="Fim">
                    <Ionicons name="flag" size={40} color="#ef4444" />
                  </Marker>
                ) : null}
                {selectedPath.length > 1 ? (
                  <Polyline
                    coordinates={selectedPath}
                    strokeColor="#ffd700"
                    strokeWidth={5}
                  />
                ) : null}
              </MapView>
            ) : rotaSelecionada ? (
              <View style={styles.modalMapFallback}>
                <Ionicons name="warning-outline" size={30} color="#f59e0b" />
                <Text style={styles.modalMapFallbackText}>
                  Não foi possível renderizar o mapa desta rota. Coordenadas inválidas.
                </Text>
              </View>
            ) : null}

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
  alertFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  alertFilterChip: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#111827",
  },
  alertFilterChipActive: {
    borderColor: "#fbbf24",
    backgroundColor: "rgba(251,191,36,0.18)",
  },
  alertFilterText: {
    color: "#cbd5e1",
    fontWeight: "600",
    fontSize: 12,
  },
  alertFilterTextActive: {
    color: "#fde68a",
  },
  alertAdminCard: {
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2c2c2c",
    borderRadius: 12,
    padding: 12,
    gap: 5,
    marginBottom: 10,
  },
  alertAdminHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  alertAdminType: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
  alertAdminStatus: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  alertAdminDescription: {
    color: "#e5e7eb",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2,
  },
  alertAdminMeta: {
    color: "#94a3b8",
    fontSize: 12,
  },
  alertAdminReportItem: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  alertAdminActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  alertResolveBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.5)",
    backgroundColor: "rgba(6,78,59,0.45)",
    borderRadius: 10,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  alertResolveText: {
    color: "#d1fae5",
    fontWeight: "700",
    fontSize: 12,
  },
  alertRemoveBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.45)",
    backgroundColor: "rgba(127,29,29,0.25)",
    borderRadius: 10,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  alertRemoveText: {
    color: "#fecaca",
    fontWeight: "700",
    fontSize: 12,
  },
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
  modalMapFallback: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.65,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#111827",
  },
  modalMapFallbackText: {
    color: "#e5e7eb",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },
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
