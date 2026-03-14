import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native'; // <-- MÁGICA
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { onValue, push, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { MapPressEvent, Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { auth, database } from '../../services/connectionFirebase';

type Coordinate = { latitude: number; longitude: number; };

export default function SuggestRouteScreen() {
  const isFocused = useIsFocused(); // Destrói o mapa quando não está na tela

  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView>(null);

  const [startPoint, setStartPoint] = useState<Coordinate | null>(null);
  const [endPoint, setEndPoint] = useState<Coordinate | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [rotasOficiais, setRotasOficiais] = useState<any[]>([]);
  
  const [nomeRota, setNomeRota] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoRota, setTipoRota] = useState('Ciclismo');
  const [dificuldade, setDificuldade] = useState('Média');
  const [distanciaCalculada, setDistanciaCalculada] = useState<string | null>(null);

  const categorias = ['Ciclismo', 'Corrida', 'Caminhada'];
  const dificuldades = ['Fácil', 'Média', 'Difícil'];

  useEffect(() => {
    if (isFocused) {
        (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let currentLocation = await Location.getCurrentPositionAsync({});
        setTimeout(() => {
            mapRef.current?.animateCamera({ center: currentLocation.coords, zoom: 15 });
        }, 300);
        })();
    }
  }, [isFocused]);

  useEffect(() => {
    const oficiaisRef = ref(database, 'rotas_oficiais');
    const unsubscribe = onValue(oficiaisRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const listaRotas = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setRotasOficiais(listaRotas);
      } else {
        setRotasOficiais([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const calcularRotaAcompanhandoEstrada = async (start: Coordinate, end: Coordinate) => {
    setIsCalculating(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const coordsDaEstrada = data.routes[0].geometry.coordinates.map((coord: [number, number]) => ({ latitude: coord[1], longitude: coord[0] }));
        setRouteCoordinates(coordsDaEstrada);
        const distMetros = data.routes[0].distance;
        setDistanciaCalculada((distMetros / 1000).toFixed(1) + ' km');
      } else {
        setRouteCoordinates([start, end]);
        setDistanciaCalculada('N/A');
      }
    } catch {
      setRouteCoordinates([start, end]);
      setDistanciaCalculada('N/A');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleMapPress = (e: MapPressEvent) => {
    const coords = e.nativeEvent.coordinate;
    if (!startPoint) {
      setStartPoint(coords);
    } else if (!endPoint) {
      setEndPoint(coords);
      calcularRotaAcompanhandoEstrada(startPoint, coords);
    } else {
      Alert.alert("Atenção", "Você já marcou o início e o fim. Limpe os pontos para refazer.");
    }
  };

  const handleClearPoints = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteCoordinates([]);
    setDistanciaCalculada(null);
  };

  const handleEnviarSugestao = async () => {
    if (!startPoint || !endPoint) { Alert.alert('Atenção', 'Marque Início e Fim no mapa.'); return; }
    if (!nomeRota) { Alert.alert('Atenção', 'Preencha o nome da rota.'); return; }
    const user = auth.currentUser;
    if (!user) { Alert.alert('Erro', 'Você precisa estar logado.'); return; }

    try {
      const pendentesRef = ref(database, 'rotas_pendentes');
      await set(push(pendentesRef), {
        nome: nomeRota, tipo: tipoRota, dificuldade, distancia: distanciaCalculada || '0 km', descricao: descricao || 'Sem descrição.', startPoint, endPoint, rotaCompleta: routeCoordinates, sugeridoPor: user.uid, emailAutor: user.email, status: 'pendente', criadoEm: new Date().toISOString()
      });
      Alert.alert('Sucesso!', 'A sua rota foi enviada.', [{ text: 'Voltar', onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    }
  };

  return (
    <View style={styles.container}>
      {isFocused && (
        <MapView ref={mapRef} style={styles.map} provider={PROVIDER_DEFAULT} showsUserLocation={true} showsMyLocationButton={false} onPress={handleMapPress}>
            {rotasOficiais.map(rota => rota.rotaCompleta && (
                <Polyline key={`oficial-${rota.id}`} coordinates={rota.rotaCompleta} strokeColor="rgba(37, 99, 235, 0.5)" strokeWidth={5} />
            ))}
            {startPoint && <Marker coordinate={startPoint} title="Início"><Ionicons name="location" size={40} color="#22c55e" /></Marker>}
            {endPoint && <Marker coordinate={endPoint} title="Fim"><Ionicons name="flag" size={40} color="#ef4444" /></Marker>}
            {routeCoordinates.length > 0 && <Polyline coordinates={routeCoordinates} strokeColor="#ffd700" strokeWidth={5} />}
        </MapView>
      )}

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color="#fff" /></TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={handleClearPoints}><Ionicons name="trash-outline" size={28} color="#fff" /></TouchableOpacity>
      </View>

      <View style={styles.instructionBox}>
        {isCalculating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color="#000" /><Text style={styles.instructionText}>Calculando rota...</Text>
          </View>
        ) : (
          <Text style={styles.instructionText}>{!startPoint ? "1. Marque o INÍCIO" : !endPoint ? "2. Marque o FIM" : "3. Rota calculada!"}</Text>
        )}
      </View>

      <View style={styles.bottomSheet}>
        <ImageBackground source={require('../../assets/images/Azulao.png')} style={styles.sheetBg} imageStyle={{ borderTopLeftRadius: 30, borderTopRightRadius: 30 }}>
          <LinearGradient colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.98)']} style={styles.sheetOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.dragIndicator} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={styles.sheetTitle}>Detalhes da Rota</Text>
                    {distanciaCalculada && (
                        <View style={styles.distBadge}><Ionicons name="analytics" size={16} color="#000" /><Text style={styles.distText}>{distanciaCalculada}</Text></View>
                    )}
                </View>
                
                <Text style={styles.label}>Nome da Trilha</Text>
                <TextInput style={styles.input} placeholder="Ex: Trilha da Pedra Grande" placeholderTextColor="#666" value={nomeRota} onChangeText={setNomeRota} />

                <Text style={styles.label}>Desporto Principal</Text>
                <View style={styles.chipsContainer}>
                    {categorias.map(cat => (
                        <TouchableOpacity key={cat} style={[styles.chip, tipoRota === cat && styles.chipActive]} onPress={() => setTipoRota(cat)}>
                            <Text style={[styles.chipText, tipoRota === cat && styles.chipTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Dificuldade</Text>
                <View style={styles.chipsContainer}>
                    {dificuldades.map(dif => (
                        <TouchableOpacity key={dif} style={[styles.chip, dificuldade === dif && styles.chipActive]} onPress={() => setDificuldade(dif)}>
                            <Text style={[styles.chipText, dificuldade === dif && styles.chipTextActive]}>{dif}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Dicas</Text>
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Tem muita subida?" placeholderTextColor="#666" multiline value={descricao} onChangeText={setDescricao} />

                <TouchableOpacity style={[styles.submitBtn, (!startPoint || !endPoint || isCalculating) && styles.submitBtnDisabled]} onPress={handleEnviarSugestao} disabled={isCalculating}>
                  <Text style={styles.submitBtnText}>ENVIAR PARA ANÁLISE</Text>
                  <Ionicons name="paper-plane-outline" size={20} color="#000" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </LinearGradient>
        </ImageBackground>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { ...StyleSheet.absoluteFillObject },
  topBar: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  iconButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 50, borderWidth: 1, borderColor: '#333' },
  instructionBox: { position: 'absolute', top: 110, alignSelf: 'center', backgroundColor: '#ffd700', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, elevation: 5 },
  instructionText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', height: '55%', borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  sheetBg: { flex: 1 },
  sheetOverlay: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  scrollContent: { padding: 25, paddingBottom: 40 },
  dragIndicator: { width: 40, height: 5, backgroundColor: '#555', borderRadius: 5, alignSelf: 'center', marginBottom: 15 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  distBadge: { backgroundColor: '#ffd700', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, gap: 5 },
  distText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  label: { color: '#bbb', fontSize: 13, marginBottom: 8, marginLeft: 5, marginTop: 10 },
  input: { backgroundColor: '#1A1A1A', color: '#fff', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 10, borderWidth: 1, borderColor: '#444' },
  chipsContainer: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  chip: { flex: 1, backgroundColor: '#1A1A1A', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  chipActive: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  chipText: { color: '#aaa', fontWeight: 'bold', fontSize: 13 },
  chipTextActive: { color: '#000' },
  submitBtn: { backgroundColor: '#ffd700', flexDirection: 'row', borderRadius: 15, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  submitBtnDisabled: { backgroundColor: '#555' },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
