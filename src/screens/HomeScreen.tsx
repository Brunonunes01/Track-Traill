import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { MapType, Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AlertCard from "../components/AlertCard";
import AlertMarker from "../components/AlertMarker";
import RouteMarker from "../components/RouteMarker";
import { TrackTrailRoute, TrailAlert } from "../models/alerts";
import { subscribeAlerts } from "../services/alertService";
import { calculateDistanceKm, subscribeOfficialRoutes } from "../services/routeService";

const NEARBY_RADIUS_KM = 20;
const DEFAULT_REGION = {
  latitude: -15.7942,
  longitude: -47.8822,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

type RouteDistance = TrackTrailRoute & {
  distanceFromUserKm?: number;
};

export default function HomeScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [routes, setRoutes] = useState<TrackTrailRoute[]>([]);
  const [alerts, setAlerts] = useState<TrailAlert[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteDistance | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<TrailAlert | null>(null);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);

  const categories = useMemo(() => {
    const dynamicTypes = Array.from(new Set(routes.map((route) => route.tipo)));
    return ["Todos", ...dynamicTypes];
  }, [routes]);

  const stopLocationWatcher = () => {
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
    }
  };

  const requestLocationAccess = async (showSystemAlert: boolean): Promise<boolean> => {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      setLocationError("GPS desativado. Ative a localização do dispositivo.");
      if (showSystemAlert) {
        Alert.alert("GPS desativado", "Ative a localização do dispositivo para usar o mapa em tempo real.");
      }
      return false;
    }

    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== "granted") {
      setLocationError("Permissão de localização negada.");
      if (showSystemAlert) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à localização para centralizar o mapa e usar o modo em tempo real."
        );
      }
      return false;
    }

    setLocationError(null);
    return true;
  };

  const centerOnUser = async () => {
    const hasAccess = await requestLocationAccess(true);
    if (!hasAccess) return;

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(current);
      mapRef.current?.animateCamera({ center: current.coords, zoom: 15 });
    } catch {
      setLocationError("Não foi possível obter sua localização atual.");
      Alert.alert("Falha de localização", "Não foi possível obter sua posição no momento.");
    }
  };

  useEffect(() => {
    if (!isFocused) {
      stopLocationWatcher();
      return;
    }

    let mounted = true;
    const syncLocation = async () => {
      try {
        const hasAccess = await requestLocationAccess(false);
        if (!hasAccess || !mounted) return;

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;

        setLocation(current);
        mapRef.current?.animateCamera({ center: current.coords, zoom: 14 });

        stopLocationWatcher();
        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 8,
          },
          (updatedLocation) => {
            if (!mounted) return;
            setLocation(updatedLocation);
          }
        );
      } catch {
        if (!mounted) return;
        setLocationError("Falha ao iniciar localização em tempo real.");
      }
    };

    syncLocation();

    return () => {
      mounted = false;
      stopLocationWatcher();
    };
  }, [isFocused]);

  useEffect(() => {
    const unsubscribeRoutes = subscribeOfficialRoutes(
      (incoming) => {
        setRoutes(incoming);
        setLoadingRoutes(false);
      },
      (message) => {
        setRouteError(message);
        setLoadingRoutes(false);
      }
    );

    const unsubscribeAlerts = subscribeAlerts(
      (incoming) => {
        setAlerts(incoming);
        setLoadingAlerts(false);
      },
      (message) => {
        setAlertError(message);
        setLoadingAlerts(false);
      }
    );

    return () => {
      unsubscribeRoutes();
      unsubscribeAlerts();
    };
  }, []);

  const routeDistances = useMemo<RouteDistance[]>(() => {
    return routes.map((route): RouteDistance => {
      if (!location || !route.startPoint) {
        return route;
      }

      const km = calculateDistanceKm(
        location.coords.latitude,
        location.coords.longitude,
        route.startPoint.latitude,
        route.startPoint.longitude
      );

      return {
        ...route,
        distanceFromUserKm: km,
      };
    });
  }, [location, routes]);

  const alertsByRoute = useMemo(() => {
    return alerts.reduce<Record<string, TrailAlert[]>>((acc, item) => {
      if (!item.routeId) return acc;
      if (!acc[item.routeId]) acc[item.routeId] = [];
      acc[item.routeId].push(item);
      return acc;
    }, {});
  }, [alerts]);

  const visibleRoutes = useMemo(() => {
    return routeDistances.filter((route) => {
      const categoryOk =
        activeFilter === "Todos" || route.tipo.toLowerCase().includes(activeFilter.toLowerCase());

      if (!categoryOk) return false;
      if (!nearbyOnly) return true;

      return (route.distanceFromUserKm ?? Number.POSITIVE_INFINITY) <= NEARBY_RADIUS_KM;
    });
  }, [activeFilter, nearbyOnly, routeDistances]);

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "ativo"),
    [alerts]
  );

  const recentAlerts = useMemo(
    () => alerts.filter((alert) => Date.now() - alert.createdAtMs <= 12 * 60 * 60 * 1000),
    [alerts]
  );

  const selectedRouteId = selectedRoute?.id;
  useEffect(() => {
    if (!selectedRouteId) return;
    const updated = routeDistances.find((item) => item.id === selectedRouteId) || null;
    setSelectedRoute(updated);
  }, [routeDistances, selectedRouteId]);

  const focusNearbyRoutes = () => {
    setNearbyOnly((current) => {
      const nextValue = !current;
      if (!nextValue) {
        return nextValue;
      }

      const nearest = routeDistances
        .filter((route): route is RouteDistance => typeof route.distanceFromUserKm === "number")
        .sort((a, b) => (a.distanceFromUserKm || 0) - (b.distanceFromUserKm || 0))[0];

      if (nearest?.startPoint) {
        mapRef.current?.animateCamera({ center: nearest.startPoint, zoom: 13 });
        setSelectedRoute(nearest);
        setSelectedAlert(null);
      }

      return nextValue;
    });
  };

  const handleOpenDirections = () => {
    if (!selectedRoute?.startPoint) return;
    const url = `http://maps.google.com/maps?q=${selectedRoute.startPoint.latitude},${selectedRoute.startPoint.longitude}`;
    Linking.openURL(url);
  };

  const handleStartTrail = () => {
    if (!selectedRoute) return;
    navigation.navigate("Atividades", { rotaSugerida: selectedRoute });
  };

  const handleRegisterAlert = () => {
    navigation.navigate("AlertForm", {
      routeId: selectedRoute?.id,
      routeName: selectedRoute?.titulo,
      latitude: selectedRoute?.startPoint?.latitude ?? location?.coords.latitude,
      longitude: selectedRoute?.startPoint?.longitude ?? location?.coords.longitude,
    });
  };

  const activeAlertsForRoute = selectedRoute ? alertsByRoute[selectedRoute.id] || [] : [];
  const selectedRouteActiveAlerts = activeAlertsForRoute.filter((item) => item.status === "ativo");

  const loading = loadingRoutes || loadingAlerts;
  const tabSafeOffset = Math.max(insets.bottom, 12);
  const floatingBottomBase = tabSafeOffset + 72;
  const handleOpenDrawer = () => {
    const parent = navigation.getParent?.();
    if (parent?.openDrawer) {
      parent.openDrawer();
      return;
    }
    navigation.navigate("Próximas");
  };

  return (
    <View style={styles.container}>
      {isFocused ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={
            location
              ? {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }
              : DEFAULT_REGION
          }
          mapType={mapType}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {visibleRoutes.map((route) =>
            route.startPoint ? (
              <Marker
                key={`route-${route.id}`}
                coordinate={route.startPoint}
                onPress={() => {
                  setSelectedRoute(route);
                  setSelectedAlert(null);
                }}
              >
                <RouteMarker
                  type={route.tipo}
                  selected={selectedRoute?.id === route.id}
                  activeAlertsCount={
                    (alertsByRoute[route.id] || []).filter((item) => item.status === "ativo").length
                  }
                />
              </Marker>
            ) : null
          )}

          {alerts.map((alert) => (
            <Marker
              key={`alert-${alert.id}`}
              coordinate={{ latitude: alert.latitude, longitude: alert.longitude }}
              onPress={() => {
                setSelectedAlert(alert);
                setSelectedRoute(null);
              }}
            >
              <AlertMarker alert={alert} selected={selectedAlert?.id === alert.id} />
            </Marker>
          ))}

          {selectedRoute?.rotaCompleta && selectedRoute.rotaCompleta.length > 0 ? (
            <Polyline coordinates={selectedRoute.rotaCompleta} strokeColor="#ffd700" strokeWidth={5} />
          ) : null}
        </MapView>
      ) : null}

      <View style={styles.topContainer}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleOpenDrawer}
          >
            <Ionicons name="menu" size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Mapa Inteligente</Text>

          <TouchableOpacity style={styles.iconButton} onPress={centerOnUser}>
            <Ionicons name="locate" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[styles.filterChip, activeFilter === category ? styles.filterChipActive : null]}
              onPress={() => {
                setActiveFilter(category);
                setSelectedRoute(null);
                setSelectedAlert(null);
              }}
            >
              <Text style={[styles.filterText, activeFilter === category ? styles.filterTextActive : null]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.filterChip, nearbyOnly ? styles.filterChipNearbyActive : null]}
            onPress={focusNearbyRoutes}
          >
            <Ionicons name="navigate" size={14} color={nearbyOnly ? "#000" : "#fff"} />
            <Text style={[styles.filterText, nearbyOnly ? styles.filterTextActive : null]}>Perto de mim</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.mapTypeSwitch}>
          <TouchableOpacity
            style={[styles.mapTypeOption, mapType === "standard" ? styles.mapTypeOptionActive : null]}
            onPress={() => setMapType("standard")}
          >
            <Ionicons name="map-outline" size={14} color={mapType === "standard" ? "#000" : "#fff"} />
            <Text
              style={[
                styles.mapTypeOptionText,
                mapType === "standard" ? styles.mapTypeOptionTextActive : null,
              ]}
            >
              Mapa
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mapTypeOption, mapType === "satellite" ? styles.mapTypeOptionActive : null]}
            onPress={() => setMapType("satellite")}
          >
            <Ionicons name="earth-outline" size={14} color={mapType === "satellite" ? "#000" : "#fff"} />
            <Text
              style={[
                styles.mapTypeOptionText,
                mapType === "satellite" ? styles.mapTypeOptionTextActive : null,
              ]}
            >
              Satélite
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={styles.loadingText}>Atualizando rotas e alertas...</Text>
        </View>
      ) : null}

      {routeError || alertError ? (
        <View style={styles.errorBadge}>
          <Ionicons name="warning-outline" size={16} color="#fef3c7" />
          <Text style={styles.errorText}>{routeError || alertError}</Text>
        </View>
      ) : null}

      {!routeError && !alertError && locationError ? (
        <View style={styles.errorBadge}>
          <Ionicons name="locate-outline" size={16} color="#fef3c7" />
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[
          styles.fabPrimary,
          selectedRoute || selectedAlert
            ? { bottom: floatingBottomBase + 145 }
            : { bottom: floatingBottomBase },
        ]}
        onPress={handleRegisterAlert}
      >
        <Ionicons name="warning" size={20} color="#000" />
        <Text style={styles.fabText}>Registrar alerta</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.fabSecondary,
          selectedRoute || selectedAlert
            ? { bottom: floatingBottomBase + 84 }
            : { bottom: tabSafeOffset + 8 },
        ]}
        onPress={() => navigation.navigate("Próximas")}
      >
        <Ionicons name="list" size={20} color="#000" />
        <Text style={styles.fabText}>Ver rotas</Text>
      </TouchableOpacity>

      {selectedRoute ? (
        <View style={[styles.bottomCardWrap, { bottom: floatingBottomBase + 6 }]}>
          <LinearGradient colors={["#0b1220", "#111827"]} style={styles.bottomCard}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {selectedRoute.titulo}
                </Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {selectedRoute.descricao}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setSelectedRoute(null)}>
                <Ionicons name="close-circle" size={26} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View style={styles.routeMetaRow}>
              <View style={styles.routeTag}>
                <Text style={styles.routeTagText}>{selectedRoute.tipo}</Text>
              </View>
              <View style={styles.routeTagWarning}>
                <Text style={styles.routeTagText}>{selectedRoute.dificuldade || "N/D"}</Text>
              </View>
              <View style={styles.routeTagDark}>
                <Text style={styles.routeTagText}>
                  {selectedRoute.distanceFromUserKm !== undefined
                    ? `${selectedRoute.distanceFromUserKm.toFixed(1)} km`
                    : selectedRoute.distancia || "Distância N/D"}
                </Text>
              </View>
            </View>

            <View style={styles.alertSummaryRow}>
              <Text style={styles.alertSummaryLabel}>Alertas ativos:</Text>
              <Text
                style={[
                  styles.alertSummaryValue,
                  { color: selectedRouteActiveAlerts.length > 0 ? "#f87171" : "#4ade80" },
                ]}
              >
                {selectedRouteActiveAlerts.length}
              </Text>
              <Text style={styles.alertSummaryLabel}>| Recentes no mapa: {recentAlerts.length}</Text>
            </View>

            {selectedRouteActiveAlerts[0] ? (
              <AlertCard
                alert={selectedRouteActiveAlerts[0]}
                compact
                onPress={() => navigation.navigate("AlertDetail", { alertData: selectedRouteActiveAlerts[0] })}
              />
            ) : (
              <Text style={styles.noAlertText}>Esta rota não tem alertas ativos no momento.</Text>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.roundBtn} onPress={handleOpenDirections}>
                <Ionicons name="map-outline" size={21} color="#d1d5db" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() =>
                  navigation.navigate("RouteDetail", {
                    routeData: selectedRoute,
                  })
                }
              >
                <Text style={styles.secondaryActionText}>Detalhes da rota</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryActionBtn} onPress={handleStartTrail}>
                <Ionicons name="play" size={18} color="#000" />
                <Text style={styles.primaryActionText}>Iniciar trilha</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      ) : null}

      {selectedAlert ? (
        <View style={styles.alertCardWrap}>
          <View style={styles.alertCardHeader}>
            <Text style={styles.alertCardTitle}>Alerta no mapa</Text>
            <TouchableOpacity onPress={() => setSelectedAlert(null)}>
              <Ionicons name="close" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <AlertCard
            alert={selectedAlert}
            onPress={() => navigation.navigate("AlertDetail", { alertData: selectedAlert })}
          />

          <TouchableOpacity
            style={styles.alertDetailBtn}
            onPress={() => navigation.navigate("AlertDetail", { alertData: selectedAlert })}
          >
            <Text style={styles.alertDetailBtnText}>Abrir detalhe do alerta</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!loading && visibleRoutes.length === 0 ? (
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateText}>
            Nenhuma rota encontrada para este filtro. Tente desativar o modo Perto de mim.
          </Text>
        </View>
      ) : null}

      {!loading && activeAlerts.length === 0 ? (
        <View style={styles.emptyAlertBadge}>
          <Ionicons name="shield-checkmark" size={16} color="#86efac" />
          <Text style={styles.emptyAlertText}>Sem alertas ativos no momento.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  map: { ...StyleSheet.absoluteFillObject },

  topContainer: { position: "absolute", top: 40, width: "100%" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 5,
  },
  iconButton: {
    backgroundColor: "rgba(0,0,0,0.65)",
    padding: 10,
    borderRadius: 50,
  },

  filterScroll: { paddingHorizontal: 20, gap: 10, alignItems: "center" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#555",
  },
  filterChipActive: { backgroundColor: "#1e4db7", borderColor: "#1e4db7" },
  filterChipNearbyActive: { backgroundColor: "#ffd700", borderColor: "#ffd700" },
  filterText: { color: "#fff", fontWeight: "bold" },
  filterTextActive: { color: "#000" },
  mapTypeSwitch: {
    marginTop: 10,
    marginHorizontal: 20,
    padding: 4,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 14,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#374151",
    alignSelf: "flex-start",
  },
  mapTypeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mapTypeOptionActive: {
    backgroundColor: "#ffd700",
  },
  mapTypeOptionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  mapTypeOptionTextActive: {
    color: "#000",
  },

  loadingBadge: {
    position: "absolute",
    top: 168,
    alignSelf: "center",
    backgroundColor: "#ffd700",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 5,
    gap: 8,
  },
  loadingText: { color: "#000", fontWeight: "700" },

  errorBadge: {
    position: "absolute",
    top: 206,
    alignSelf: "center",
    backgroundColor: "rgba(127, 29, 29, 0.95)",
    borderWidth: 1,
    borderColor: "#991b1b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "90%",
  },
  errorText: { color: "#fee2e2", flexShrink: 1 },

  fabPrimary: {
    position: "absolute",
    right: 20,
    backgroundColor: "#ffd700",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 28,
    elevation: 8,
    gap: 6,
  },
  fabSecondary: {
    position: "absolute",
    right: 20,
    backgroundColor: "#facc15",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 28,
    elevation: 8,
    gap: 6,
  },
  fabText: { color: "#000", fontWeight: "800", fontSize: 12 },

  bottomCardWrap: {
    position: "absolute",
    bottom: 20,
    left: 14,
    right: 14,
    borderRadius: 18,
    overflow: "hidden",
    elevation: 10,
  },
  bottomCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  cardTitle: { color: "#fff", fontSize: 19, fontWeight: "800" },
  cardSubtitle: { color: "#9ca3af", fontSize: 13, marginTop: 2 },

  routeMetaRow: { flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  routeTag: {
    backgroundColor: "#1e40af",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  routeTagWarning: {
    backgroundColor: "#ca8a04",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  routeTagDark: {
    backgroundColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  routeTagText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  alertSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 4,
  },
  alertSummaryLabel: { color: "#d1d5db", fontSize: 12 },
  alertSummaryValue: { fontSize: 12, fontWeight: "800" },
  noAlertText: { color: "#9ca3af", marginBottom: 10 },

  actionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: "#374151",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryActionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: "#ffd700",
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryActionText: { color: "#000", fontWeight: "800", fontSize: 12 },

  alertCardWrap: {
    position: "absolute",
    bottom: 20,
    left: 14,
    right: 14,
    backgroundColor: "#030712",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    elevation: 10,
  },
  alertCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  alertCardTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  alertDetailBtn: {
    backgroundColor: "#1f2937",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  alertDetailBtnText: { color: "#fff", fontWeight: "700" },

  emptyStateBox: {
    position: "absolute",
    bottom: 20,
    left: 18,
    right: 18,
    backgroundColor: "rgba(17,24,39,0.95)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  emptyStateText: { color: "#d1d5db", textAlign: "center" },

  emptyAlertBadge: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    backgroundColor: "rgba(6, 78, 59, 0.9)",
    borderColor: "#065f46",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyAlertText: { color: "#d1fae5", fontSize: 12, fontWeight: "600" },
});
