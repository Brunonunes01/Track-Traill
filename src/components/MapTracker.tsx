import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';

interface MapTrackerProps {
  onFinish: (data: { coordinates: any[]; distance: number; duration: number }) => void;
  onCancel: () => void;
}

export default function MapTracker({ onFinish, onCancel }: MapTrackerProps) {
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [distance, setDistance] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const mapRef = useRef<MapView>(null);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Solicitar Permissão e Iniciar Rastreamento
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos do GPS para rastrear sua trilha.');
        return;
      }

      // Pega posição inicial
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);

      // Inicia monitoramento
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // Atualiza a cada 2s
          distanceInterval: 5, // Ou a cada 5 metros
        },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          const newCoordinate = { latitude, longitude };

          setRouteCoordinates((prevRoute) => {
            const newRoute = [...prevRoute, newCoordinate];
            
            // Calcula distância simples (acumulativa)
            if (prevRoute.length > 0) {
              const lastPoint = prevRoute[prevRoute.length - 1];
              const dist = calcDistance(
                lastPoint.latitude, lastPoint.longitude,
                latitude, longitude
              );
              setDistance((d) => d + dist);
            }
            return newRoute;
          });

          setCurrentLocation(loc.coords);
          
          // Centraliza mapa na nova posição
          mapRef.current?.animateCamera({ center: newCoordinate, zoom: 17 });
        }
      );
    })();
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
    // Retorna os dados para a tela pai
    onFinish({
      coordinates: routeCoordinates,
      distance: parseFloat(distance.toFixed(2)),
      duration: Math.floor(seconds / 60) // em minutos
    });
  };

  return (
    <View style={styles.container}>
      {currentLocation && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
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
      )}

      {/* Overlay de Informações */}
      <View style={styles.overlay}>
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
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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