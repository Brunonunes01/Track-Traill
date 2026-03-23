import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/connectionFirebase";
import AlertCard from "../components/AlertCard";
import { ALERT_TYPE_META, TrailAlert } from "../models/alerts";
import { confirmAlert, markAlertAsResolved, subscribeAlerts } from "../services/alertService";
import { toCoordinate } from "../utils/geo";

type AlertDetailParams = {
  alertId?: string;
  alertData?: TrailAlert;
};

type AlertDetailScreenProps = {
  navigation?: any;
  route?: any;
};

export default function AlertDetailScreen(props: AlertDetailScreenProps) {
  const hookNavigation = useNavigation<any>();
  const hookRoute = useRoute<any>();
  const navigation = props.navigation || hookNavigation;
  const insets = useSafeAreaInsets();
  const params = props.route?.params || hookRoute.params;
  const { alertId, alertData } = (params || {}) as AlertDetailParams;

  const [alertItem, setAlertItem] = useState<TrailAlert | null>(alertData || null);
  const [loading, setLoading] = useState(!alertData);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (alertData) {
      setAlertItem(alertData);
      setLoading(false);
      return;
    }

    if (!alertId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeAlerts((allAlerts) => {
      const found = allAlerts.find((item) => item.id === alertId) || null;
      setAlertItem(found);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [alertData, alertId]);

  const canResolve = useMemo(() => {
    if (!alertItem) return false;
    return auth.currentUser?.uid === alertItem.userId;
  }, [alertItem]);

  const handleConfirm = async () => {
    if (!alertItem) return;

    try {
      setSubmitting(true);
      await confirmAlert(alertItem.id);
      Alert.alert("Confirmado", "Você confirmou este alerta.");
    } catch {
      Alert.alert("Erro", "Não foi possível confirmar este alerta.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!alertItem) return;

    try {
      setSubmitting(true);
      await markAlertAsResolved(alertItem.id);
      Alert.alert("Alerta atualizado", "O alerta foi marcado como resolvido.");
    } catch {
      Alert.alert("Erro", "Não foi possível marcar como resolvido.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#ffd700" />
        <Text style={styles.centerText}>Carregando alerta...</Text>
      </View>
    );
  }

  if (!alertItem) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.centerText}>Alerta não encontrado.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta = ALERT_TYPE_META[alertItem.type] || ALERT_TYPE_META.outro;
  const markerCoordinate = toCoordinate({
    latitude: alertItem.latitude,
    longitude: alertItem.longitude,
  });

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        {markerCoordinate ? (
          <MapView
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: markerCoordinate.latitude,
              longitude: markerCoordinate.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker coordinate={markerCoordinate}>
              <Ionicons name={meta.icon as any} size={32} color={meta.color} />
            </Marker>
          </MapView>
        ) : (
          <View style={styles.invalidMapWrap}>
            <Text style={styles.invalidMapText}>Localização inválida para este alerta.</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.backIcon, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AlertCard alert={alertItem} />

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Informações</Text>
          <Text style={styles.metaText}>Tipo: {meta.label}</Text>
          <Text style={styles.metaText}>Status: {alertItem.status}</Text>
          <Text style={styles.metaText}>Rota: {alertItem.routeName || "Não vinculada"}</Text>
          <Text style={styles.metaText}>
            Autor: {alertItem.userDisplayName || alertItem.userEmail || "Usuário"}
          </Text>
          <Text style={styles.metaText}>
            Coordenadas: {markerCoordinate ? `${markerCoordinate.latitude.toFixed(5)}, ${markerCoordinate.longitude.toFixed(5)}` : "indisponíveis"}
          </Text>
        </View>

        {alertItem.photoUrl ? (
          <Image source={{ uri: alertItem.photoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.photoFallback}>
            <Ionicons name="image-outline" size={20} color="#6b7280" />
            <Text style={styles.photoFallbackText}>Alerta sem foto</Text>
          </View>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={18} color="#000" />
              <Text style={styles.primaryBtnText}>Confirmar alerta</Text>
            </>
          )}
        </TouchableOpacity>

        {canResolve && alertItem.status !== "resolvido" ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleResolve} disabled={submitting}>
            <Ionicons name="checkmark-circle" size={18} color="#d1d5db" />
            <Text style={styles.secondaryBtnText}>Marcar como resolvido</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  mapWrap: {
    height: "35%",
    position: "relative",
  },
  invalidMapWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  invalidMapText: {
    color: "#d1d5db",
  },
  backIcon: {
    position: "absolute",
    top: 48,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    padding: 10,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  metaCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14,
    marginBottom: 12,
  },
  metaTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 8,
  },
  metaText: {
    color: "#d1d5db",
    marginBottom: 5,
  },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginBottom: 14,
  },
  photoFallback: {
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    flexDirection: "row",
    gap: 8,
  },
  photoFallbackText: {
    color: "#9ca3af",
  },
  primaryBtn: {
    backgroundColor: "#ffd700",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: "#000",
    fontWeight: "800",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#1f2937",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: {
    color: "#d1d5db",
    fontWeight: "700",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030712",
  },
  centerText: {
    color: "#fff",
    marginTop: 10,
    marginBottom: 10,
  },
  backBtn: {
    backgroundColor: "#ffd700",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: {
    color: "#000",
    fontWeight: "700",
  },
});
