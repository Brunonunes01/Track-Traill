import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AlertCard from "../components/AlertCard";
import AlertMarker from "../components/AlertMarker";
import { TrackTrailRoute, TrailAlert } from "../models/alerts";
import { subscribeRouteAlerts } from "../services/alertService";
import { toCoordinate, toCoordinateArray } from "../utils/geo";

type RouteDetailParams = {
  routeData: TrackTrailRoute;
};

const getMapRegion = (routeData: TrackTrailRoute) => {
  const anchor = toCoordinate(routeData.startPoint) || toCoordinate(routeData.rotaCompleta?.[0]);

  if (!anchor) {
    return {
      latitude: -15.7942,
      longitude: -47.8822,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }

  return {
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };
};

type RouteDetailScreenProps = {
  navigation?: any;
  route?: any;
};

export default function RouteDetailScreen(props: RouteDetailScreenProps) {
  const hookNavigation = useNavigation<any>();
  const hookRoute = useRoute<any>();
  const navigation = props.navigation || hookNavigation;
  const insets = useSafeAreaInsets();
  const params = props.route?.params || hookRoute.params;
  const { routeData } = (params || {}) as RouteDetailParams;

  const [alerts, setAlerts] = useState<TrailAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeData?.id) {
      setLoadingAlerts(false);
      return;
    }

    const unsubscribe = subscribeRouteAlerts(
      routeData.id,
      (incoming) => {
        setAlerts(incoming);
        setLoadingAlerts(false);
      },
      (message) => {
        setError(message);
        setLoadingAlerts(false);
      }
    );

    return () => unsubscribe();
  }, [routeData?.id]);

  const activeAlerts = useMemo(
    () => alerts.filter((item) => item.status === "ativo"),
    [alerts]
  );
  const safeRoutePath = useMemo(() => toCoordinateArray(routeData?.rotaCompleta), [routeData?.rotaCompleta]);
  const safeStartPoint = useMemo(() => toCoordinate(routeData?.startPoint), [routeData?.startPoint]);
  const safeAlertMarkers = useMemo(
    () =>
      alerts
        .map((alert) => ({
          alert,
          coordinate: toCoordinate({ latitude: alert.latitude, longitude: alert.longitude }),
        }))
        .filter(
          (
            item
          ): item is { alert: TrailAlert; coordinate: { latitude: number; longitude: number } } =>
            Boolean(item.coordinate)
        ),
    [alerts]
  );

  if (!routeData) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.centerText}>Rota não encontrada.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backFallbackBtn}>
          <Text style={styles.backFallbackText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapHeader}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={getMapRegion(routeData)}
        >
          {safeRoutePath.length > 0 ? (
            <Polyline coordinates={safeRoutePath} strokeColor="#ffd700" strokeWidth={5} />
          ) : null}

          {safeStartPoint ? (
            <Marker coordinate={safeStartPoint} title="Início da rota">
              <Ionicons name="flag" size={34} color="#22c55e" />
            </Marker>
          ) : null}

          {safeAlertMarkers.map(({ alert, coordinate }) => (
            <Marker
              key={alert.id}
              coordinate={coordinate}
              onPress={() => navigation.navigate("AlertDetail", { alertData: alert })}
            >
              <AlertMarker alert={alert} />
            </Marker>
          ))}
        </MapView>

        <TouchableOpacity style={[styles.backButton, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.routeTitle}>{routeData.titulo}</Text>
        <Text style={styles.routeDescription}>{routeData.descricao}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Distância</Text>
            <Text style={styles.metricValue}>{routeData.distancia || "N/D"}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Dificuldade</Text>
            <Text style={styles.metricValue}>{routeData.dificuldade || "N/D"}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Alertas ativos</Text>
            <Text style={[styles.metricValue, { color: activeAlerts.length > 0 ? "#ef4444" : "#10b981" }]}> 
              {activeAlerts.length}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Alertas da rota</Text>
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() =>
              navigation.navigate("AlertForm", {
                routeId: routeData.id,
                routeName: routeData.titulo,
                latitude: safeStartPoint?.latitude,
                longitude: safeStartPoint?.longitude,
              })
            }
          >
            <Ionicons name="warning-outline" size={16} color="#000" />
            <Text style={styles.registerText}>Registrar alerta</Text>
          </TouchableOpacity>
        </View>

        {loadingAlerts ? (
          <View style={styles.centerRow}>
            <ActivityIndicator size="small" color="#ffd700" />
            <Text style={styles.helperText}>Carregando alertas...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loadingAlerts && !error && alerts.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum alerta registrado para esta rota.</Text>
        ) : null}

        {!loadingAlerts && !error
          ? alerts.map((item) => (
              <AlertCard
                key={item.id}
                alert={item}
                onPress={() => navigation.navigate("AlertDetail", { alertData: item })}
              />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  mapHeader: {
    height: "42%",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top: 48,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    padding: 10,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 10,
  },
  routeTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  routeDescription: {
    color: "#d1d5db",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  metricLabel: {
    color: "#9ca3af",
    fontSize: 11,
    marginBottom: 6,
  },
  metricValue: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  sectionHeader: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  registerBtn: {
    backgroundColor: "#ffd700",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  registerText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
  },
  centerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  helperText: {
    color: "#9ca3af",
  },
  errorText: {
    color: "#f87171",
    marginTop: 10,
  },
  emptyText: {
    color: "#9ca3af",
    marginTop: 12,
    marginBottom: 4,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030712",
    padding: 24,
  },
  centerText: {
    color: "#fff",
    marginBottom: 12,
  },
  backFallbackBtn: {
    backgroundColor: "#ffd700",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backFallbackText: {
    color: "#000",
    fontWeight: "700",
  },
});
