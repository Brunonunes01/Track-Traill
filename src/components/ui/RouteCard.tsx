import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TrackTrailRoute } from "../../models/alerts";
import { colors, radius, spacing, typography } from "../../theme/designSystem";
import AppCard from "./AppCard";

type RouteCardProps = {
  route: TrackTrailRoute;
  activeAlerts?: number;
  onPress?: () => void;
};

export default function RouteCard({ route, activeAlerts = 0, onPress }: RouteCardProps) {
  const danger = activeAlerts > 0;
  const safetyScore = Math.max(0, Math.min(100, Math.round(route.safetyScore ?? 0)));
  const safetyColor =
    safetyScore >= 75 ? colors.success : safetyScore >= 50 ? colors.warning : colors.danger;
  const alertsCount = route.activeAlertsNearby ?? activeAlerts;

  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress}>
      <AppCard animated style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {route.titulo}
          </Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{route.tipo || "Rota"}</Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {route.descricao || "Sem descrição disponível."}
        </Text>

        <View style={styles.badgesRow}>
          {route.regionalLabel ? (
            <View style={styles.regionBadge}>
              <Ionicons name="location-outline" size={12} color={colors.info} />
              <Text style={styles.regionBadgeText}>{route.regionalLabel}</Text>
            </View>
          ) : null}
          {route.isAmbassadorCurated ? (
            <View style={styles.curatedBadge}>
              <Ionicons name="ribbon-outline" size={12} color={colors.success} />
              <Text style={styles.curatedBadgeText}>
                Curadoria local{route.curatorName ? ` • ${route.curatorName}` : ""}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="resize-outline" size={14} color={colors.info} />
            <Text style={styles.metaText}>{route.distancia || "N/D"}</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="speedometer-outline" size={14} color={colors.warning} />
            <Text style={styles.metaText}>{route.dificuldade || "N/D"}</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons
              name={danger ? "warning-outline" : "shield-checkmark-outline"}
              size={14}
              color={danger ? colors.danger : colors.success}
            />
            <Text style={[styles.metaText, { color: danger ? colors.danger : colors.success }]}> 
              {alertsCount} alerta(s)
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="shield-half-outline" size={14} color={safetyColor} />
            <Text style={[styles.metaText, { color: safetyColor }]}>
              Segurança {safetyScore}%
            </Text>
          </View>
        </View>
      </AppCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    flex: 1,
  },
  tag: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.5)",
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  tagText: {
    color: colors.info,
    fontSize: 11,
    fontWeight: "700",
  },
  description: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  badgesRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  regionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.45)",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  regionBadgeText: {
    color: colors.info,
    fontSize: 11,
    fontWeight: "700",
  },
  curatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.45)",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  curatedBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
});
