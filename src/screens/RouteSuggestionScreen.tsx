import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/connectionFirebase";
import { TrackTrailRoute } from "../models/alerts";
import { RouteCard } from "../components/ui";
import {
  calculateDistanceKm,
  subscribeOfficialRoutes,
  subscribeUserRoutes,
} from "../services/routeService";
import { colors, layout, spacing } from "../theme/designSystem";

type DifficultyFilter = "Todas" | "Fácil" | "Média" | "Difícil";
type DistanceFilter = 5 | 10 | 20 | 40;

type SuggestedRoute = TrackTrailRoute & {
  distanceKm?: number;
  score: number;
  source: "oficial" | "minha";
};

const ACTIVITY_OPTIONS = ["Todos", "Caminhada", "Corrida", "Ciclismo", "Trilha"];
const DIFFICULTY_OPTIONS: DifficultyFilter[] = ["Todas", "Fácil", "Média", "Difícil"];
const DISTANCE_OPTIONS: DistanceFilter[] = [5, 10, 20, 40];

const normalizeValue = (value?: string) => (value || "").trim().toLowerCase();

export default function RouteSuggestionScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;

  const [officialRoutes, setOfficialRoutes] = useState<TrackTrailRoute[]>([]);
  const [userRoutes, setUserRoutes] = useState<TrackTrailRoute[]>([]);
  const [selectedType, setSelectedType] = useState("Todos");
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>("Todas");
  const [selectedDistance, setSelectedDistance] = useState<DistanceFilter>(20);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeOfficialRoutes = subscribeOfficialRoutes(
      (routes) => {
        setOfficialRoutes(routes);
        setLoading(false);
      },
      () => setLoading(false)
    );

    let unsubscribeUserRoutes = () => {};
    if (user?.uid) {
      unsubscribeUserRoutes = subscribeUserRoutes(
        user.uid,
        (routes) => setUserRoutes(routes),
        () => setUserRoutes([])
      );
    }

    return () => {
      unsubscribeOfficialRoutes();
      unsubscribeUserRoutes();
    };
  }, [user?.uid]);

  useEffect(() => {
    let mounted = true;

    const loadLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          setLocationError("Sem permissão de localização. Mostrando recomendações gerais.");
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!mounted) return;
        setUserLocation(current);
        setLocationError(null);
      } catch {
        if (mounted) {
          setLocationError("Não foi possível obter sua localização agora.");
        }
      }
    };

    loadLocation();

    return () => {
      mounted = false;
    };
  }, []);

  const suggestedRoutes = useMemo(() => {
    const allRoutes: SuggestedRoute[] = [
      ...officialRoutes.map((route) => ({ ...route, source: "oficial" as const })),
      ...userRoutes.map((route) => ({ ...route, source: "minha" as const })),
    ].map((route) => {
      let distanceKm: number | undefined;
      if (userLocation && route.startPoint) {
        distanceKm = calculateDistanceKm(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          route.startPoint.latitude,
          route.startPoint.longitude
        );
      }

      const routeType = normalizeValue(route.tipo);
      const routeDifficulty = normalizeValue(route.dificuldade);
      const requestedType = normalizeValue(selectedType);
      const requestedDifficulty = normalizeValue(selectedDifficulty);

      const typeScore =
        selectedType === "Todos"
          ? 1
          : routeType.includes(requestedType)
            ? 1.4
            : 0.5;

      const difficultyScore =
        selectedDifficulty === "Todas"
          ? 1
          : routeDifficulty.includes(requestedDifficulty)
            ? 1.2
            : 0.6;

      const distanceScore =
        typeof distanceKm === "number"
          ? Math.max(0.1, 1.8 - Math.min(distanceKm, 60) / 35)
          : 0.8;

      return {
        ...route,
        distanceKm,
        score: typeScore * difficultyScore * distanceScore,
      };
    });

    return allRoutes
      .filter((route) => {
        if (selectedType !== "Todos") {
          const matchesType = normalizeValue(route.tipo).includes(normalizeValue(selectedType));
          if (!matchesType) return false;
        }

        if (selectedDifficulty !== "Todas") {
          const matchesDifficulty = normalizeValue(route.dificuldade).includes(
            normalizeValue(selectedDifficulty)
          );
          if (!matchesDifficulty) return false;
        }

        if (typeof route.distanceKm === "number") {
          return route.distanceKm <= selectedDistance;
        }

        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [officialRoutes, userRoutes, selectedType, selectedDifficulty, selectedDistance, userLocation]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}> 
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Sugerir rota</Text>
          <Text style={styles.subtitle}>Recomendações por proximidade e perfil</Text>
        </View>
      </View>

      {locationError ? (
        <View style={styles.warningBox}>
          <Ionicons name="locate-outline" size={15} color={colors.warning} />
          <Text style={styles.warningText}>{locationError}</Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {ACTIVITY_OPTIONS.map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => setSelectedType(item)}
            style={[styles.filterChip, selectedType === item ? styles.filterChipActive : null]}
          >
            <Text style={[styles.filterText, selectedType === item ? styles.filterTextActive : null]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.inlineFiltersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineScroll}>
          {DIFFICULTY_OPTIONS.map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setSelectedDifficulty(item)}
              style={[styles.inlineChip, selectedDifficulty === item ? styles.inlineChipActive : null]}
            >
              <Text style={[styles.inlineText, selectedDifficulty === item ? styles.inlineTextActive : null]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineScroll}>
          {DISTANCE_OPTIONS.map((item) => (
            <TouchableOpacity
              key={String(item)}
              onPress={() => setSelectedDistance(item)}
              style={[styles.inlineChip, selectedDistance === item ? styles.inlineChipActive : null]}
            >
              <Text style={[styles.inlineText, selectedDistance === item ? styles.inlineTextActive : null]}>
                Até {item} km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Buscando rotas recomendadas...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}> 
          {suggestedRoutes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="trail-sign-outline" size={30} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma rota encontrada para os filtros atuais.</Text>
            </View>
          ) : (
            suggestedRoutes.map((route) => (
              <View key={`${route.source}-${route.id}`}>
                <RouteCard
                  route={{
                    ...route,
                    distancia:
                      typeof route.distanceKm === "number"
                        ? `${route.distanceKm.toFixed(1)} km de você`
                        : route.distancia,
                  }}
                  onPress={() => navigation.navigate("RouteDetail", { routeData: route })}
                />
                <View style={styles.sourceRow}>
                  <Ionicons
                    name={route.source === "oficial" ? "ribbon-outline" : "person-outline"}
                    size={14}
                    color={colors.textMuted}
                  />
                  <Text style={styles.sourceText}>
                    {route.source === "oficial" ? "Rota oficial" : "Rota traçada por você"}
                  </Text>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.traceButton} onPress={() => navigation.navigate("TraceRoute")}> 
            <Ionicons name="create-outline" size={16} color="#111827" />
            <Text style={styles.traceButtonText}>Traçar rota manualmente</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: layout.screenPaddingHorizontal,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  warningBox: {
    marginBottom: spacing.xs,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  warningText: {
    color: colors.warning,
    fontSize: 12,
    flex: 1,
  },
  filterRow: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
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
  inlineFiltersRow: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  inlineScroll: {
    gap: spacing.xs,
  },
  inlineChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  inlineChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(252, 76, 2, 0.15)",
  },
  inlineText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 11,
  },
  inlineTextActive: {
    color: colors.primary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  sourceRow: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.xs,
  },
  sourceText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
  },
  traceButton: {
    marginTop: spacing.sm,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#facc15",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  traceButtonText: {
    color: "#111827",
    fontWeight: "800",
  },
});
