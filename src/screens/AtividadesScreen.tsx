import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { push, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { auth, database } from '../../services/connectionFirebase';

// IMPEDIR QUE A TELA APAGUE SOZINHA
import { useKeepAwake } from 'expo-keep-awake';

type Coordinate = { latitude: number; longitude: number };

const calcularDistanciaKM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function AtividadesScreen() {
  // Ativa a função que impede o celular de desligar a tela enquanto estiver nesta página
  useKeepAwake();

  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const rotaGuia = route.params?.rotaSugerida;

  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [caminhoUsuario, setCaminhoUsuario] = useState<Coordinate[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [distanciaTotal, setDistanciaTotal] = useState(0); 
  
  // Estados do Cronómetro Inteligente (Resistente a bloqueios de tela)
  const [tempoSegundos, setTempoSegundos] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const tempoAcumuladoRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'Precisamos do GPS para gravar a sua atividade.');
        return;
      }
      let currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(currentLocation);
      
      const startFocus = rotaGuia?.startPoint || currentLocation.coords;
      mapRef.current?.animateCamera({ center: startFocus, zoom: 16 });
    })();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  // Cronómetro que não para se o app for minimizado
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>; // <-- A MÁGICA ACONTECE AQUI
    if (isRecording) {
      interval = setInterval(() => {
        if (startTimeRef.current) {
          const segundosPassados = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setTempoSegundos(tempoAcumuladoRef.current + segundosPassados);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const formatarTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min < 10 ? '0' : ''}${min}:${seg < 10 ? '0' : ''}${seg}`;
  };

  const handleStart = async () => {
    setIsRecording(true);
    startTimeRef.current = Date.now(); // Marca a hora real do relógio do celular
    
    locationSubscription.current = await Location.watchPositionAsync(
      { 
        accuracy: Location.Accuracy.BestForNavigation, 
        timeInterval: 3000, 
        distanceInterval: 5 
      },
      (loc) => {
        const novaCoordenada = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        
        setCaminhoUsuario((caminhoAnterior) => {
          if (caminhoAnterior.length > 0) {
            const ultimaCoordenada = caminhoAnterior[caminhoAnterior.length - 1];
            const distanciaAdicional = calcularDistanciaKM(
              ultimaCoordenada.latitude, ultimaCoordenada.longitude,
              novaCoordenada.latitude, novaCoordenada.longitude
            );
            setDistanciaTotal((d) => d + distanciaAdicional);
          }
          return [...caminhoAnterior, novaCoordenada];
        });
        
        setLocation(loc);
        mapRef.current?.animateCamera({ center: novaCoordenada });
      }
    );
  };

  const handlePause = () => {
    setIsRecording(false);
    
    // Guarda o tempo que já passou
    if (startTimeRef.current) {
      const segundosPassados = Math.floor((Date.now() - startTimeRef.current) / 1000);
      tempoAcumuladoRef.current += segundosPassados;
      startTimeRef.current = null;
    }

    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  const handleFinish = () => {
    handlePause();

    if (distanciaTotal === 0 && tempoSegundos < 10) {
      Alert.alert("Atividade muito curta", "Não há dados suficientes para guardar.");
      setCaminhoUsuario([]);
      setTempoSegundos(0);
      tempoAcumuladoRef.current = 0;
      return;
    }

    Alert.alert(
      "Finalizar Atividade",
      `Tem a certeza? \nDistância: ${distanciaTotal.toFixed(2)} km \nTempo: ${formatarTempo(tempoSegundos)}`,
      [
        { text: "Continuar a Gravar", style: "cancel", onPress: handleStart },
        { 
          text: "Guardar", 
          style: "default",
          onPress: async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
              const atividadesRef = ref(database, `users/${user.uid}/atividades`);
              const novaAtivRef = push(atividadesRef);

            await set(novaAtivRef, {
                tipo: rotaGuia ? rotaGuia.tipo : 'Caminhada/Livre',
                cidade: 'Rota Registada pelo GPS',
                data: new Date().toLocaleDateString('pt-BR'),
                duracao: tempoSegundos, // Guardamos os SEGUNDOS totais para não zerar
                distancia: distanciaTotal.toFixed(2),
                rota: caminhoUsuario, // <-- AQUI ESTÁ A MÁGICA: Guardamos o trajeto!
                criadoEm: new Date().toISOString()
              });

              Alert.alert("Sucesso!", "Atividade gravada no seu Dashboard!");
              navigation.navigate("DashboardScreen");
            } catch (error) {
              Alert.alert("Erro", "Falha ao gravar.");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {rotaGuia?.rotaCompleta && (
          <Polyline coordinates={rotaGuia.rotaCompleta} strokeColor="rgba(255, 215, 0, 0.4)" strokeWidth={8} />
        )}
        {caminhoUsuario.length > 0 && (
          <Polyline coordinates={caminhoUsuario} strokeColor="#ef4444" strokeWidth={5} />
        )}
      </MapView>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => { handlePause(); navigation.goBack(); }}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.titleBadge}>
          <Text style={styles.titleText}>
            {rotaGuia ? `Guiando: ${rotaGuia.titulo}` : "Gravação Livre"}
          </Text>
        </View>
      </View>

      <View style={styles.bottomPanel}>
        <ImageBackground source={require('../../assets/images/Azulao.png')} style={{ flex: 1 }} imageStyle={{ borderTopLeftRadius: 30, borderTopRightRadius: 30 }}>
          <LinearGradient colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.98)']} style={styles.panelOverlay}>
            
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>TEMPO</Text>
                <Text style={styles.statValue}>{formatarTempo(tempoSegundos)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>DISTÂNCIA</Text>
                <Text style={styles.statValue}>{distanciaTotal.toFixed(2)} <Text style={{fontSize: 16}}>km</Text></Text>
              </View>
            </View>

            <View style={styles.controlsRow}>
              {!isRecording ? (
                <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#22c55e', flex: 1 }]} onPress={handleStart}>
                  <Ionicons name="play" size={28} color="#fff" />
                  <Text style={styles.controlBtnText}>{tempoSegundos > 0 ? "RETOMAR" : "INICIAR"}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#f59e0b', flex: 1 }]} onPress={handlePause}>
                  <Ionicons name="pause" size={28} color="#fff" />
                  <Text style={styles.controlBtnText}>PAUSAR</Text>
                </TouchableOpacity>
              )}

              {tempoSegundos > 0 && (
                <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#ef4444', marginLeft: 10 }]} onPress={handleFinish}>
                  <Ionicons name="stop" size={28} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

          </LinearGradient>
        </ImageBackground>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  topBar: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', alignItems: 'center' },
  iconButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 50, borderWidth: 1, borderColor: '#333' },
  titleBadge: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', marginLeft: 15, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  titleText: { color: '#ffd700', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  bottomPanel: { position: 'absolute', bottom: 0, width: '100%', height: 220, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  panelOverlay: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, justifyContent: 'space-between' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#aaa', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, marginBottom: 5 },
  statValue: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  divider: { width: 1, height: 50, backgroundColor: '#333', marginHorizontal: 20 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  controlBtn: { flexDirection: 'row', paddingVertical: 18, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  controlBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
});