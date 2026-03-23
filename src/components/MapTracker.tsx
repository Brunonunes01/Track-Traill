import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FALLBACK_REGION, getRegionWithFallback, toCoordinate, toCoordinateArray } from '../utils/geo';

interface MapTrackerProps {
  onFinish: (data: { coordinates: any[]; distance: number; duration: number }) => void;
  onCancel: () => void;
}

export default function MapTracker({ onFinish, onCancel }: MapTrackerProps) {
  const insets = useSafeAreaInsets();
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Solicitar Permissão e Iniciar Rastreamento
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        console.log("[map-tracker] Checking foreground permissions");
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          console.warn("[map-tracker] GPS permission denied");
          setMapError('Permissão de localização negada.');
          Alert.alert('Permissão negada', 'Precisamos do GPS para rastrear sua trilha.');
          return;
        }

        console.log("[map-tracker] Getting current position for map init");
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        if (!mounted) return;
        
        const safeInitial = toCoordinate(location.coords);
        if (!safeInitial) {
          console.error("[map-tracker] Invalid initial coordinates received:", location.coords);
          setMapError('Coordenadas iniciais inválidas.');
          return;
        }

        console.log("[map-tracker] Map starting at:", safeInitial);
        setCurrentLocation(safeInitial);
        setMapError(null);

        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (!mounted) return;
            const newCoordinate = toCoordinate(loc.coords);
            if (!newCoordinate) return;

            console.log("[map-tracker] GPS update received");
            setRouteCoordinates((prevRoute) => {
              const newRoute = [...prevRoute, newCoordinate];
              if (prevRoute.length > 0) {
                const lastPoint = prevRoute[prevRoute.length - 1];
                const dist = calcDistance(
                  lastPoint.latitude,
                  lastPoint.longitude,
                  newCoordinate.latitude,
                  newCoordinate.longitude
                );
                setDistance((d) => d + dist);
              }
              return newRoute;
            });

            setCurrentLocation(newCoordinate);
            mapRef.current?.animateCamera({ center: newCoordinate, zoom: 17 });
          }
        );
      } catch (error: any) {
        if (!mounted) return;
        console.error("[map-tracker] Initialization error:", error?.message || String(error));
        setMapError('Falha ao iniciar GPS em tempo real.');
        Alert.alert('Erro de localização', 'Não foi possível iniciar o rastreamento por GPS.');
      }
    })();

    return () => {
      mounted = false;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, []);

  // Função auxiliar de distância (Haversine simples)
  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Retorna em KM
  };

  const formatTime = (totalSeconds: number) => {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    const safeCoordinates = toCoordinateArray(routeCoordinates);
    // Retorna os dados para a tela pai
    onFinish({
      coordinates: safeCoordinates,
      distance: parseFloat(distance.toFixed(2)),
      duration: Math.floor(seconds / 60) // em minutos
    });
  };

  const initialRegion = getRegionWithFallback(currentLocation, FALLBACK_REGION, {
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  return (
    <View style={styles.container}>
      {currentLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation={true}
        >
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2563eb"
            strokeWidth={5}
          />
          {routeCoordinates.length > 0 && (
            <Marker coordinate={routeCoordinates[0]} title="Início" pinColor="green" />
          )}
        </MapView>
      ) : (
        <View style={styles.mapFallback}>
          <Text style={styles.mapFallbackTitle}>Aguardando localização</Text>
          <Text style={styles.mapFallbackText}>
            {mapError || 'Ative o GPS para iniciar o rastreamento com segurança.'}
          </Text>
        </View>
      )}

      {/* Overlay de Informações */}
      <View style={[styles.overlay, { bottom: Math.max(insets.bottom + 12, 24) }]}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tempo</Text>
            <Text style={styles.statValue}>{formatTime(seconds)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distância</Text>
            <Text style={styles.statValue}>{distance.toFixed(2)} km</Text>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
                <Text style={styles.buttonText}>Finalizar Trilha</Text>
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  mapFallbackTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  mapFallbackText: {
    marginTop: 8,
    color: '#cbd5e1',
    textAlign: 'center',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#ccc',
    fontSize: 14,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  finishButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
