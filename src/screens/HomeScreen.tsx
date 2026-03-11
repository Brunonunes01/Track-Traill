import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

// Simulando banco de dados (Mais tarde virá do Firebase)
const ROTAS_CADASTRADAS = [
  { id: '1', titulo: 'Trilha do Mirante', tipo: 'Ciclismo', distancia: '12 km', dificuldade: 'Média', latitude: -20.2647, longitude: -50.5458 },
  { id: '2', titulo: 'Estrada Bela Vista', tipo: 'Corrida', distancia: '5 km', dificuldade: 'Fácil', latitude: -20.2700, longitude: -50.5500 },
  { id: '3', titulo: 'Caminho das Pedras', tipo: 'Caminhada', distancia: '3 km', dificuldade: 'Fácil', latitude: -20.2600, longitude: -50.5400 },
];

export default function HomeScreen({ navigation }: any) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [rotaSelecionada, setRotaSelecionada] = useState<any>(null);
  const [filtroAtivo, setFiltroAtivo] = useState('Todos'); // Estado do Filtro
  const mapRef = useRef<MapView>(null);

  const categorias = ['Todos', 'Ciclismo', 'Corrida', 'Caminhada'];

  // Lógica do Filtro: Só mostra no mapa o que bater com a categoria selecionada
  const rotasFiltradas = ROTAS_CADASTRADAS.filter(rota => 
    filtroAtivo === 'Todos' ? true : rota.tipo === filtroAtivo
  );

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      mapRef.current?.animateCamera({ center: currentLocation.coords, zoom: 14 });
    })();
  }, []);

  const handleNavegarAteTrilha = () => {
    if (!rotaSelecionada) return;
    const url = `http://maps.google.com/maps?q=${rotaSelecionada.latitude},${rotaSelecionada.longitude}`;
    Linking.openURL(url);
  };

  const getIconForType = (tipo: string) => {
    if (tipo === 'Ciclismo') return 'bicycle';
    if (tipo === 'Corrida') return 'barbell-outline'; // Exemplo de ícone diferente
    return 'walk';
  };

  return (
    <View style={styles.container}>
      {/* MAPA */}
      <MapView ref={mapRef} style={styles.map} provider={PROVIDER_DEFAULT} showsUserLocation={true}>
        {rotasFiltradas.map((rota) => (
          <Marker
            key={rota.id}
            coordinate={{ latitude: rota.latitude, longitude: rota.longitude }}
            onPress={() => setRotaSelecionada(rota)}
          >
            <View style={[styles.markerContainer, rotaSelecionada?.id === rota.id && styles.markerSelected]}>
              <Ionicons name={getIconForType(rota.tipo)} size={22} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

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

        {/* BARRA DE ROLAGEM DOS FILTROS */}
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

      {/* CARD INFERIOR */}
      {rotaSelecionada && (
        <View style={styles.bottomCard}>
          <LinearGradient colors={['#1e1e1e', '#121212']} style={styles.cardGradient}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{rotaSelecionada.titulo}</Text>
              <TouchableOpacity onPress={() => setRotaSelecionada(null)}>
                <Ionicons name="close-circle" size={28} color="#aaa" />
              </TouchableOpacity>
            </View>
            <View style={styles.tagsContainer}>
              <View style={styles.tag}><Text style={styles.tagText}>{rotaSelecionada.tipo}</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>{rotaSelecionada.distancia}</Text></View>
              <View style={[styles.tag, {backgroundColor: '#ca8a04'}]}><Text style={styles.tagText}>{rotaSelecionada.dificuldade}</Text></View>
            </View>
            <TouchableOpacity style={styles.navigateBtn} onPress={handleNavegarAteTrilha}>
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.navigateBtnText}>Navegar até o Início</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  
  topContainer: { position: 'absolute', top: 40, width: '100%' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5 },
  iconButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 50 },
  
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  filterChip: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, borderWidth: 1, borderColor: '#555' },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { color: '#ccc', fontWeight: 'bold' },
  filterTextActive: { color: '#fff' },

  markerContainer: { backgroundColor: '#444', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  markerSelected: { backgroundColor: '#2563eb', transform: [{ scale: 1.2 }] },
  
  bottomCard: { position: 'absolute', bottom: 30, left: 20, right: 20, borderRadius: 20, overflow: 'hidden', elevation: 10 },
  cardGradient: { padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', flex: 1 },
  tagsContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tag: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tagText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  navigateBtn: { backgroundColor: '#22c55e', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 15, gap: 10 },
  navigateBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});