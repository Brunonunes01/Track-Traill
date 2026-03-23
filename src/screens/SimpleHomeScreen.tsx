import { Ionicons } from "@expo/vector-icons";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, database } from "../../services/connectionFirebase";
import {
  AppButton,
  AppCard,
  EmptyState,
  LoadingState,
  SectionTitle,
} from "../components/ui";
import { TrailAlert } from "../models/alerts";
import { subscribeAlerts } from "../services/alertService";
import { subscribeOfficialRoutes } from "../services/routeService";
import { colors, layout, spacing, typography } from "../theme/designSystem";

export default function SimpleHomeScreen({ navigation }: any) {
  const [fullName, setFullName] = useState("Explorador");
  const [routesCount, setRoutesCount] = useState(0);
  const [alerts, setAlerts] = useState<TrailAlert[]>([]);
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    console.log("[home] SimpleHomeScreen mounted, user:", user?.uid);
    
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("[home] Safety timeout reached in SimpleHomeScreen. Releasing loading.");
        setLoading(false);
      }
    }, 8000);

    if (!user) {
      setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    const userRef = ref(database, `users/${user.uid}`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
      const data = snapshot.val() || {};
      setFullName(data.fullName || data.username || user.email || "Explorador");
      setActivitiesCount(data.atividades ? Object.keys(data.atividades).length : 0);
    });

    const unsubscribeRoutes = subscribeOfficialRoutes((routes) => {
      setRoutesCount(routes.length);
      setLoading(false);
    });

    const unsubscribeAlerts = subscribeAlerts((items) => {
      setAlerts(items);
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribeRoutes();
      unsubscribeAlerts();
    };
  }, []);

  const activeAlerts = useMemo(
    () => alerts.filter((item) => item.status === "ativo").length,
    [alerts]
  );

  const recentAlerts = useMemo(
    () => alerts.filter((item) => Date.now() - item.createdAtMs <= 24 * 60 * 60 * 1000).length,
    [alerts]
  );

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <LoadingState label="Preparando seu painel..." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppCard animated>
        <Text style={styles.title}>Olá, {fullName.split(" ")[0]}</Text>
        <Text style={styles.subtitle}>Pronto para a próxima trilha?</Text>
      </AppCard>

      <View style={styles.metricsRow}>
        <AppCard animated style={styles.metricCard}>
          <Ionicons name="trail-sign-outline" size={18} color={colors.info} />
          <Text style={styles.metricLabel}>Rotas</Text>
          <Text style={styles.metricValue}>{routesCount}</Text>
        </AppCard>

        <AppCard animated style={styles.metricCard}>
          <Ionicons
            name={activeAlerts > 0 ? "warning-outline" : "shield-checkmark-outline"}
            size={18}
            color={activeAlerts > 0 ? colors.danger : colors.success}
          />
          <Text style={styles.metricLabel}>Alertas ativos</Text>
          <Text style={[styles.metricValue, { color: activeAlerts > 0 ? colors.danger : colors.success }]}>
            {activeAlerts}
          </Text>
        </AppCard>

        <AppCard animated style={styles.metricCard}>
          <Ionicons name="walk-outline" size={18} color={colors.warning} />
          <Text style={styles.metricLabel}>Atividades</Text>
          <Text style={styles.metricValue}>{activitiesCount}</Text>
        </AppCard>
      </View>

      <SectionTitle title="Ações principais" subtitle="Movimente-se com segurança" />

      <View style={styles.actionsStack}>
        <AppButton
          title="Abrir mapa principal"
          onPress={() => navigation.navigate("Mapa")}
          icon={<Ionicons name="map-outline" size={18} color={colors.white} />}
        />

        <AppButton
          title="Iniciar gravação de atividade"
          variant="secondary"
          onPress={() => navigation.navigate("Atividades")}
          icon={<Ionicons name="play-outline" size={18} color={colors.textPrimary} />}
        />
      </View>

      <SectionTitle title="Atalhos" subtitle="Acesso rápido ao que importa" />

      <View style={styles.quickRow}>
        <AppCard animated style={styles.quickCard}>
          <Text style={styles.quickTitle}>Rotas</Text>
          <Text style={styles.quickText}>{routesCount} disponíveis para explorar</Text>
          <AppButton
            title="Ver rotas"
            variant="ghost"
            onPress={() => navigation.navigate("Próximas")}
            icon={<Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />}
          />
        </AppCard>

        <AppCard animated style={styles.quickCard}>
          <Text style={styles.quickTitle}>Alertas</Text>
          <Text style={styles.quickText}>{recentAlerts} nas últimas 24 horas</Text>
          <AppButton
            title="Novo alerta"
            variant="ghost"
            onPress={() => navigation.navigate("AlertForm")}
            icon={<Ionicons name="warning-outline" size={16} color={colors.textPrimary} />}
          />
        </AppCard>
      </View>

      {routesCount === 0 ? (
        <EmptyState
          title="Ainda sem rotas"
          description="Quando novas rotas forem publicadas, elas aparecerão aqui."
          icon="map-outline"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  loadingBox: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xxs,
    fontSize: 14,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  metricCard: {
    flex: 1,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
  },
  metricLabel: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
  },
  metricValue: {
    marginTop: spacing.xxs,
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: "800",
  },
  actionsStack: {
    gap: spacing.sm,
  },
  quickRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickCard: {
    flex: 1,
    gap: spacing.sm,
  },
  quickTitle: {
    ...typography.cardTitle,
  },
  quickText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
