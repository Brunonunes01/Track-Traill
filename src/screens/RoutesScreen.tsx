import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionButton,
  EmptyState,
  LoadingState,
  RouteCard,
  SectionTitle,
} from "../components/ui";
import { TrackTrailRoute, TrailAlert } from "../models/alerts";
import { subscribeAlerts } from "../services/alertService";
import { calculateDistanceKm, subscribeOfficialRoutes } from "../services/routeService";
import { colors, layout, spacing } from "../theme/designSystem";

type RouteWithDistance = TrackTrailRoute & { distanceFromUserKm?: number };

type DistanceFilter = "Todas" | 5 | 20 | 50;
const TEST_ROUTE_TYPE = "teste";

const normalizeRouteType = (value?: string) => (value || "").trim().toLowerCase();
const isTestRouteType = (value?: string) => normalizeRouteType(value) === TEST_ROUTE_TYPE;

export default function RoutesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [routes, setRoutes] = useState<TrackTrailRoute[]>([]);
  const [alerts, setAlerts] = useState<TrailAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedType, setSelectedType] = useState("Todos");
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>(20);

  useEffect(() => {
    const unsubscribeRoutes = subscribeOfficialRoutes(
      (items) => {
        setRoutes(items);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      }
    );

    const unsubscribeAlerts = subscribeAlerts((items) => {
      setAlerts(items);
      setLoading(false);
    });

    return () => {
      unsubscribeRoutes();
      unsubscribeAlerts();
    };
  }, []);

  useEffect(() => {
    const loadLocation = async () => {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          setLocationError("Ative o GPS para priorizar rotas próximas.");
          return;
        }

        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (permission.status !== "granted") {
          setLocationError("Permissão de localização negada. Mostrando catálogo geral.");
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setUserLocation(current);
        setLocationError(null);
      } catch {
        setLocationError("Não foi possível obter sua localização agora.");
      }
    };

    loadLocation();
  }, []);

  const activeAlertsByRoute = useMemo(() => {
    return alerts.reduce<Record<string, number>>((acc, item) => {
      if (!item.routeId || item.status !== "ativo") return acc;
      acc[item.routeId] = (acc[item.routeId] || 0) + 1;
      return acc;
    }, {});
  }, [alerts]);

  const routeTypes = useMemo(() => {
    const types = Array.from(
      new Set(
        routes
          .map((route) => route.tipo)
          .filter((value): value is string => Boolean(value && !isTestRouteType(value)))
      )
    );
    return ["Todos", ...types];
  }, [routes]);

  const routesWithDistance = useMemo<RouteWithDistance[]>(() => {
    if (!userLocation) {
      return [...routes].sort((a, b) => a.titulo.localeCompare(b.titulo));
    }

    const withDistance = routes.map<RouteWithDistance>((route) => {
      if (!route.startPoint) return { ...route };

      const distanceFromUserKm = calculateDistanceKm(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        route.startPoint.latitude,
        route.startPoint.longitude
      );

      return { ...route, distanceFromUserKm };
    });

    return withDistance.sort((a, b) => {
      const distanceA = a.distanceFromUserKm ?? Number.POSITIVE_INFINITY;
      const distanceB = b.distanceFromUserKm ?? Number.POSITIVE_INFINITY;
      return distanceA - distanceB;
    });
  }, [routes, userLocation]);

  const visibleRoutes = useMemo(() => {
    return routesWithDistance.filter((route) => {
      if (isTestRouteType(route.tipo)) return false;

      const normalizedSelectedType = normalizeRouteType(selectedType);
      const normalizedRouteType = normalizeRouteType(route.tipo);
      const matchesType =
        selectedType === "Todos" || normalizedRouteType.includes(normalizedSelectedType);

      if (!matchesType) return false;
      if (distanceFilter === "Todas") return true;

      return (route.distanceFromUserKm ?? Number.POSITIVE_INFINITY) <= distanceFilter;
    });
  }, [distanceFilter, routesWithDistance, selectedType]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <LoadingState label="Carregando rotas próximas..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SectionTitle
          title="Próximas a você"
          subtitle={
            userLocation
              ? "Ordenadas por distância da sua localização"
              : "Sem localização: exibindo catálogo geral"
          }
        />

        {locationError ? (
          <View style={styles.warningRow}>
            <Ionicons name="locate-outline" size={16} color={colors.warning} />
            <Text style={styles.warningText}>{locationError}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.warningRow}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <Text style={styles.warningText}>{error}</Text>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {routeTypes.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setSelectedType(type)}
              style={[styles.filterChip, selectedType === type ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterText, selectedType === type ? styles.filterTextActive : null]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.distanceRow}>
          {([5, 20, 50, "Todas"] as DistanceFilter[]).map((item) => (
            <TouchableOpacity
              key={String(item)}
              onPress={() => setDistanceFilter(item)}
              style={[styles.distanceChip, distanceFilter === item ? styles.distanceChipActive : null]}
            >
              <Text style={[styles.distanceText, distanceFilter === item ? styles.distanceTextActive : null]}>
                {item === "Todas" ? "Todas" : `Até ${item} km`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={visibleRoutes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        ListEmptyComponent={
          <EmptyState
            title="Sem rotas para o filtro atual"
            description="Ajuste o tipo ou o raio de distância para encontrar trilhas próximas."
            icon="trail-sign-outline"
          />
        }
        renderItem={({ item }) => (
          <RouteCard
            route={{
              ...item,
              distancia:
                item.distanceFromUserKm !== undefined
                  ? `${item.distanceFromUserKm.toFixed(1)} km de você`
                  : item.distancia,
            }}
            activeAlerts={activeAlertsByRoute[item.id] || 0}
            onPress={() => navigation.navigate("RouteDetail", { routeData: item })}
          />
        )}
      />

      <ActionButton
        label="Abrir mapa"
        icon="map-outline"
        style={[styles.mapButton, { bottom: insets.bottom + spacing.lg }]}
        onPress={() => navigation.navigate("Mapa")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.xl,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: spacing.sm,
  },
  warningRow: {
    marginBottom: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
    flex: 1,
  },
  filtersRow: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChipActive: {
    borderColor: colors.info,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  filterText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 12,
  },
  filterTextActive: {
    color: colors.info,
  },
  distanceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  distanceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  distanceChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(252, 76, 2, 0.15)",
  },
  distanceText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  distanceTextActive: {
    color: colors.primary,
  },
  mapButton: {
    position: "absolute",
    right: spacing.md,
  },
});
