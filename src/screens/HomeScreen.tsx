import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native'; // <-- MÁGICA AQUI
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { database } from '../../services/connectionFirebase';

export default function HomeScreen({ navigation }: any) {
  const isFocused = useIsFocused(); // Verifica se o usuário está nesta tela agora

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [rotasOficiais, setRotasOficiais] = useState<any[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<any>(null);
  const [filtroAtivo, setFiltroAtivo] = useState('Todos'); 
  const [loading, setLoading] = useState(true);
  
  const mapRef = useRef<MapView>(null);

  const categorias = ['Todos', 'Ciclismo', 'Corrida', 'Caminhada'];

  const rotasFiltradas = rotasOficiais.filter(rota => {
    if (filtroAtivo === 'Todos') return true;
    return rota.tipo.toLowerCase().includes(filtroAtivo.toLowerCase());
  });

  // Atualiza a localização APENAS quando a tela está focada
  useEffect(() => {
    if (isFocused) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
        // Pequeno atraso para dar tempo de o mapa renderizar na volta
        setTimeout(() => {
            mapRef.current?.animateCamera({ center: currentLocation.coords, zoom: 14 });
        }, 300);
      })();
    }
  }, [isFocused]);

  useEffect(() => {
    const oficiaisRef = ref(database, 'rotas_oficiais');
    const unsubscribe = onValue(oficiaisRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const listaRotas = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setRotasOficiais(listaRotas);
      } else {
        setRotasOficiais([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleComoChegar = () => {
    if (!rotaSelecionada || !rotaSelecionada.startPoint) return;
    const url = `http://maps.google.com/maps?q=$${rotaSelecionada.startPoint.latitude},${rotaSelecionada.startPoint.longitude}`;
    Linking.openURL(url);
  };

  const handleIniciarAtividade = () => {
    navigation.navigate("Atividades", { rotaSugerida: rotaSelecionada });
  };

  const getIconForType = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t.includes('ciclismo') || t.includes('bike')) return 'bicycle';
    if (t.includes('corrida') || t.includes('run')) return 'barbell-outline';
    return 'walk';
  };

  return (
    <View style={styles.container}>
      
      {/* O MAPA SÓ EXISTE SE A TELA ESTIVER ATIVA (Poupa muita RAM!) */}
      {isFocused && (
        <MapView 
            ref={mapRef} 
            style={styles.map} 
            provider={PROVIDER_DEFAULT} 
            showsUserLocation={true} 
            showsMyLocationButton={false}
        >
            {rotasFiltradas.map((rota) => (
            <Marker
                key={rota.id}
                coordinate={rota.startPoint}
                onPress={() => setRotaSelecionada(rota)}
            >
                <View style={[styles.markerContainer, rotaSelecionada?.id === rota.id && styles.markerSelected]}>
                <Ionicons name={getIconForType(rota.tipo)} size={22} color="#fff" />
                </View>
            </Marker>
            ))}

            {rotaSelecionada && rotaSelecionada.rotaCompleta && (
            <Polyline coordinates={rotaSelecionada.rotaCompleta} strokeColor="#ffd700" strokeWidth={5} />
            )}
        </MapView>
      )}

      {/* CABEÇALHO E FILTROS */}
      <View style={styles.topContainer}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate("DashboardScreen")}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Radar de Rotas</Text>
          <TouchableOpacity style={styles.iconButton} onPress={() => location && mapRef.current?.animateCamera({ center: location.coords, zoom: 15 })}>
            <Ionicons name="locate" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {categorias.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.filterChip, filtroAtivo === cat && styles.filterChipActive]}
              onPress={() => { setFiltroAtivo(cat); setRotaSelecionada(null); }}
            >
              <Text style={[styles.filterText, filtroAtivo === cat && styles.filterTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={{ marginLeft: 8, fontWeight: 'bold' }}>A procurar rotas...</Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.fabSuggest, rotaSelecionada ? { bottom: 230 } : { bottom: 40 }]}
        onPress={() => navigation.navigate("SuggestRoute")}
      >
        <Ionicons name="add" size={24} color="#000" />
        <Text style={styles.fabSuggestText}>Sugerir Rota</Text>
      </TouchableOpacity>

      {rotaSelecionada && (
        <View style={styles.bottomCard}>
          <LinearGradient colors={['#1e1e1e', '#121212']} style={styles.cardGradient}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{rotaSelecionada.titulo}</Text>
                {rotaSelecionada.distancia && (
                  <Text style={styles.distText}>{rotaSelecionada.distancia}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setRotaSelecionada(null)} style={{ padding: 5 }}>
                <Ionicons name="close-circle" size={28} color="#aaa" />
              </TouchableOpacity>
            </View>

            <View style={styles.tagsContainer}>
              <View style={styles.tag}><Text style={styles.tagText}>{rotaSelecionada.tipo}</Text></View>
              {rotaSelecionada.dificuldade && (
                <View style={[styles.tag, {backgroundColor: '#ca8a04'}]}><Text style={styles.tagText}>{rotaSelecionada.dificuldade}</Text></View>
              )}
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.directionsBtn} onPress={handleComoChegar}>
                <Ionicons name="map-outline" size={24} color="#ccc" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.startBtn} onPress={handleIniciarAtividade}>
                <Ionicons name="play" size={20} color="#000" />
                <Text style={styles.startBtnText}>INICIAR TRILHA</Text>
              </TouchableOpacity>
            </View>
            
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { ...StyleSheet.absoluteFillObject }, // <-- MELHORIA DE PERFORMANCE
  
  topContainer: { position: 'absolute', top: 40, width: '100%' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5 },
  iconButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 50 },
  
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  filterChip: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, borderWidth: 1, borderColor: '#555' },
  filterChipActive: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  filterText: { color: '#ccc', fontWeight: 'bold' },
  filterTextActive: { color: '#000' },

  loadingBadge: { position: 'absolute', top: 120, alignSelf: 'center', backgroundColor: '#ffd700', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, elevation: 5 },

  markerContainer: { backgroundColor: '#444', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  markerSelected: { backgroundColor: '#ffd700', transform: [{ scale: 1.2 }] },
  
  fabSuggest: { position: 'absolute', right: 20, backgroundColor: '#ffd700', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 30, elevation: 5, zIndex: 10 },
  fabSuggestText: { color: '#000', fontWeight: 'bold', marginLeft: 5 },

  bottomCard: { position: 'absolute', bottom: 30, left: 20, right: 20, borderRadius: 20, overflow: 'hidden', elevation: 10 },
  cardGradient: { padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 10 },
  distText: { color: '#ffd700', fontSize: 14, fontWeight: '600', marginTop: 4 },
  
  tagsContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tag: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tagText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  actionButtonsRow: { flexDirection: 'row', gap: 10 },
  directionsBtn: { backgroundColor: '#333', padding: 15, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  startBtn: { flex: 1, backgroundColor: '#ffd700', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 15, gap: 8 },
  startBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});