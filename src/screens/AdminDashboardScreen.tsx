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
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AdminUserList from "../../components/AdminUserList";
import { database } from "../../services/connectionFirebase";
import { toCoordinate, toCoordinateArray } from "../utils/geo";
import { TrailAlert } from "../models/alerts";
import { colors, layout, radius, spacing, typography } from "../theme/designSystem";
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
type AlertFilter = "todos" | "ativos" | "expirados" | "denunciados" | "resolvidos";

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

const SECTION_ITEMS: { key: AdminSection; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "add", label: "Adicionar", icon: "person-add-outline" },
  { key: "admins", label: "Administradores", icon: "shield-checkmark-outline" },
  { key: "users", label: "Usuários", icon: "people-outline" },
  { key: "tools", label: "Ferramentas", icon: "construct-outline" },
  { key: "settings", label: "Sistema", icon: "settings-outline" },
  { key: "routes", label: "Rotas", icon: "map-outline" },
  { key: "alerts", label: "Alertas", icon: "warning-outline" },
];

export default function AdminDashboardScreen(props: AdminDashboardScreenProps) {
  const hookNavigation = useNavigation<any>();
  const navigation = props.navigation || hookNavigation;
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
  const visibleModerationAlerts = useMemo(
    () => alerts.filter((item) => item.status !== "removido"),
    [alerts]
  );
  const activeAlertsCount = useMemo(
    () => visibleModerationAlerts.filter((item) => item.status === "ativo").length,
    [visibleModerationAlerts]
  );
  const reportedAlertsCount = useMemo(
    () => visibleModerationAlerts.filter((item) => (item.reportCount || 0) > 0).length,
    [visibleModerationAlerts]
  );

  const filteredAlerts = useMemo(() => {
    return visibleModerationAlerts.filter((item) => {
      if (alertFilter === "todos") return true;
      if (alertFilter === "ativos") return item.status === "ativo";
      if (alertFilter === "expirados") return item.status === "expirado";
      if (alertFilter === "resolvidos") return item.status === "resolvido";
      if (alertFilter === "denunciados") return (item.reportCount || 0) > 0;
      return true;
    });
  }, [alertFilter, visibleModerationAlerts]);

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
        visibility: "public",
        dificuldade: rotaSelecionada.dificuldade || "Não informada",
        tempoEstimado: rotaSelecionada.tempoEstimado || null,
        duracaoSegundos:
          typeof rotaSelecionada.duracaoSegundos === "number" ? rotaSelecionada.duracaoSegundos : null,
        terreno: rotaSelecionada.terreno || null,
        descricao: rotaSelecionada.descricao || "Sem descrição disponível.",
        distancia: rotaSelecionada.distancia || null,
        startPoint: safeStartPoint,
        endPoint: safeEndPoint,
        rotaCompleta: safePath,
        elevacaoGanhoM:
          typeof rotaSelecionada.elevacaoGanhoM === "number" ? rotaSelecionada.elevacaoGanhoM : null,
        elevacaoPerdaM:
          typeof rotaSelecionada.elevacaoPerdaM === "number" ? rotaSelecionada.elevacaoPerdaM : null,
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sectionButtons}
      style={styles.sectionButtonsScroll}
    >
      {SECTION_ITEMS.map((item) => {
        const isActive = activeSection === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.sectionBtn, isActive && styles.sectionBtnActive]}
            onPress={() => setActiveSection(item.key)}
          >
            <Ionicons
              name={item.icon}
              size={16}
              color={isActive ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.sectionBtnText, isActive && styles.sectionBtnTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
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
            placeholderTextColor={colors.textMuted}
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
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={18} color={colors.white} />
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
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
            <Text style={styles.systemItemText}>Controle de acesso por role ativo</Text>
          </View>
          <View style={styles.systemItem}>
            <Ionicons name="server-outline" size={20} color={colors.info} />
            <Text style={styles.systemItemText}>Conectado ao Firebase Realtime Database</Text>
          </View>
        </View>
      );
    }

    if (activeSection === "alerts") {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Moderação de alertas ({visibleModerationAlerts.length})</Text>
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
              <Ionicons name="shield-checkmark-outline" size={48} color={colors.textMuted} />
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
                        <ActivityIndicator size="small" color="#dcfce7" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={16} color="#dcfce7" />
                          <Text style={styles.alertResolveText}>Resolver</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.alertRemoveBtn}
                      disabled={workingAlertId === item.id || item.status === "removido"}
                      onPress={() => handleRemoveAlertAdmin(item.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fee2e2" />
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
              <Ionicons name="trail-sign-outline" size={52} color={colors.textMuted} />
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
                    <Ionicons name="map-outline" size={24} color={colors.info} />
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
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
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
            <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.success} />
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
                  <Ionicons name="map-outline" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeCardTitle}>{item.nome}</Text>
                  <Text style={styles.routeCardMeta}>Tipo: {item.tipo}</Text>
                  <Text style={styles.routeCardMeta}>Autor: {item.emailAutor}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={["#08101D", "#0B1220", "#121F36"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Painel Admin</Text>
          <Text style={styles.headerSubtitle}>Gestão de usuários, rotas e moderação</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {checkingAccess ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateText}>Validando permissões...</Text>
        </View>
      ) : !isAdmin ? (
        <View style={styles.centerState}>
          <Ionicons name="lock-closed-outline" size={52} color={colors.danger} />
          <Text style={styles.centerStateText}>Acesso restrito para administradores.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, spacing.xxl) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{admins.length}</Text>
              <Text style={styles.statLabel}>Admins</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{pendentes.length}</Text>
              <Text style={styles.statLabel}>Pendências</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{activeAlertsCount}</Text>
              <Text style={styles.statLabel}>Alertas ativos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{reportedAlertsCount}</Text>
              <Text style={styles.statLabel}>Denunciados</Text>
            </View>
          </View>

          {renderSectionButtons()}
          {renderSectionContent()}
        </ScrollView>
      )}

      <Modal visible={!!rotaSelecionada} animationType="slide">
        <View style={styles.modalRoot}>
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
                <TouchableOpacity style={[styles.modalActionBtn, styles.rejectBtn]} onPress={handleRejeitarRota}>
                  <Ionicons name="close" size={18} color={colors.white} />
                  <Text style={styles.modalActionText}>Rejeitar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalActionBtn, styles.approveBtn]} onPress={handleAprovarRota}>
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                  <Text style={styles.modalActionText}>Aprovar</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.modalBackBtn} onPress={() => setRotaSelecionada(null)}>
                <Text style={styles.modalBackText}>Voltar</Text>
              </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1 },
  headerSpacer: { width: 40 },
  title: { ...typography.sectionTitle, fontSize: 22, lineHeight: 28 },
  headerSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerStateText: { color: colors.textSecondary, fontSize: 15 },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCard: {
    minWidth: "48%",
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionButtonsScroll: { marginTop: spacing.xs },
  sectionButtons: { gap: spacing.xs, paddingRight: spacing.md },
  sectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
  },
  sectionBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sectionBtnText: { color: colors.textSecondary, fontWeight: "700", fontSize: 13 },
  sectionBtnTextActive: { color: colors.white },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionTitle: { ...typography.cardTitle, marginBottom: 6 },
  sectionDescription: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  primaryActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryActionText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  systemItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: 8,
  },
  systemItemText: { color: colors.textSecondary, fontSize: 13 },
  emptyTools: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyToolsText: { color: colors.textMuted, fontSize: 14 },
  routeCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  routeCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  routeCardTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  routeCardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  alertFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  alertFilterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.backgroundAlt,
  },
  alertFilterChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(252, 76, 2, 0.18)",
  },
  alertFilterText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 12,
  },
  alertFilterTextActive: {
    color: colors.textPrimary,
  },
  alertAdminCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
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
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
  alertAdminStatus: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  alertAdminDescription: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2,
  },
  alertAdminMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  alertAdminReportItem: {
    color: colors.textSecondary,
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
    borderColor: "rgba(34,197,94,0.6)",
    backgroundColor: "rgba(34,197,94,0.18)",
    borderRadius: radius.sm,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  alertResolveText: {
    color: "#dcfce7",
    fontWeight: "700",
    fontSize: 12,
  },
  alertRemoveBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.65)",
    backgroundColor: "rgba(239,68,68,0.14)",
    borderRadius: radius.sm,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  alertRemoveText: {
    color: "#fee2e2",
    fontWeight: "700",
    fontSize: 12,
  },
  deleteRouteBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.65)",
    backgroundColor: "rgba(239,68,68,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  map: { width: Dimensions.get("window").width, height: Dimensions.get("window").height * 0.65 },
  modalRoot: { flex: 1, backgroundColor: colors.black },
  modalMapFallback: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.65,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.backgroundAlt,
  },
  modalMapFallbackText: {
    color: colors.textPrimary,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  modalPanel: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
  },
  modalTitle: { color: colors.textPrimary, fontSize: 21, fontWeight: "700", marginBottom: 4 },
  modalSubtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 16 },
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
  rejectBtn: { backgroundColor: colors.danger },
  approveBtn: { backgroundColor: colors.success },
  modalActionText: { color: colors.white, fontWeight: "700" },
  modalBackBtn: { alignItems: "center", paddingVertical: 10 },
  modalBackText: { color: colors.textMuted, fontWeight: "700" },
});
