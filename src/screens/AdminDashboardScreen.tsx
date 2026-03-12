import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { onValue, ref, remove, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    ImageBackground,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { database } from '../../services/connectionFirebase';

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<any>(null);

  // Busca as rotas pendentes no Firebase em tempo real
  useEffect(() => {
    const pendentesRef = ref(database, 'rotas_pendentes');
    const unsubscribe = onValue(pendentesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setPendentes(lista);
      } else {
        setPendentes([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAprovar = async () => {
    if (!rotaSelecionada) return;

    try {
      // 1. Grava a rota no nó oficial (que vai aparecer no radar para todos)
      const oficialRef = ref(database, `rotas_oficiais/${rotaSelecionada.id}`);
      await set(oficialRef, {
        titulo: rotaSelecionada.nome,
        tipo: rotaSelecionada.tipo,
        startPoint: rotaSelecionada.startPoint,
        endPoint: rotaSelecionada.endPoint,
        rotaCompleta: rotaSelecionada.rotaCompleta,
        autor: rotaSelecionada.emailAutor,
        aprovadoEm: new Date().toISOString()
      });

      // 2. Apaga da lista de pendentes
      const pendenteRef = ref(database, `rotas_pendentes/${rotaSelecionada.id}`);
      await remove(pendenteRef);

      Alert.alert("Sucesso", "Rota aprovada e publicada para toda a comunidade!");
      setRotaSelecionada(null);
    } catch (error: any) {
      Alert.alert("Erro", "Não foi possível aprovar: " + error.message);
    }
  };

  const handleRejeitar = () => {
    Alert.alert("Rejeitar Rota", "Tem a certeza? Esta sugestão será apagada permanentemente.", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Rejeitar", 
        style: "destructive",
        onPress: async () => {
          try {
            const pendenteRef = ref(database, `rotas_pendentes/${rotaSelecionada.id}`);
            await remove(pendenteRef);
            setRotaSelecionada(null);
            Alert.alert("Removida", "A sugestão foi rejeitada com sucesso.");
          } catch (error: any) {
            Alert.alert("Erro", "Falha ao rejeitar: " + error.message);
          }
        }
      }
    ]);
  };

  return (
    <ImageBackground source={require('../../assets/images/Azulao.png')} style={styles.background}>
      <LinearGradient colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']} style={styles.overlay}>
        
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Painel de Moderação</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* LISTA DE PENDÊNCIAS */}
        {pendentes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={80} color="#22c55e" />
            <Text style={styles.emptyText}>Tudo limpo! Não há rotas pendentes.</Text>
          </View>
        ) : (
          <FlatList
            data={pendentes}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => setRotaSelecionada(item)}>
                <View style={styles.cardIcon}>
                  <Ionicons name="map-outline" size={28} color="#ffd700" />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.nome}</Text>
                  <Text style={styles.cardSubtitle}>Tipo: {item.tipo}</Text>
                  <Text style={styles.cardAuthor}>Sugerido por: {item.emailAutor}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#555" />
              </TouchableOpacity>
            )}
          />
        )}

        {/* MODAL DO MAPA (Análise visual da rota) */}
        <Modal visible={!!rotaSelecionada} animationType="slide">
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            
            {rotaSelecionada && (
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: rotaSelecionada.startPoint.latitude,
                  longitude: rotaSelecionada.startPoint.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                <Marker coordinate={rotaSelecionada.startPoint} title="Início"><Ionicons name="location" size={40} color="#22c55e" /></Marker>
                <Marker coordinate={rotaSelecionada.endPoint} title="Fim"><Ionicons name="flag" size={40} color="#ef4444" /></Marker>
                
                {rotaSelecionada.rotaCompleta && (
                  <Polyline coordinates={rotaSelecionada.rotaCompleta} strokeColor="#ffd700" strokeWidth={5} />
                )}
              </MapView>
            )}

            {/* PAINEL DE DECISÃO */}
            <View style={styles.decisionPanel}>
              <Text style={styles.decisionTitle}>{rotaSelecionada?.nome}</Text>
              <Text style={styles.decisionSub}>Analise a rota traçada no mapa acima. Ela é segura e real?</Text>
              
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={handleRejeitar}>
                  <Ionicons name="close" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>REJEITAR</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#22c55e' }]} onPress={handleAprovar}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>APROVAR</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={() => setRotaSelecionada(null)}>
                <Text style={styles.closeBtnText}>Voltar à Lista</Text>
              </TouchableOpacity>
            </View>

          </View>
        </Modal>

      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: 'cover' },
  overlay: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20 },
  backButton: { padding: 5 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  emptyText: { color: '#aaa', fontSize: 16, textAlign: 'center', marginTop: 15 },
  
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: '#1e1e1e', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  cardIcon: { backgroundColor: 'rgba(255, 215, 0, 0.1)', padding: 12, borderRadius: 12, marginRight: 15 },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cardSubtitle: { color: '#aaa', fontSize: 14, marginTop: 4 },
  cardAuthor: { color: '#ffd700', fontSize: 12, marginTop: 8 },

  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.65 },
  
  decisionPanel: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#121212', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  decisionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  decisionSub: { color: '#aaa', fontSize: 14, marginBottom: 20 },
  actionRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 15, gap: 5 },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  closeBtn: { paddingVertical: 15, alignItems: 'center' },
  closeBtnText: { color: '#aaa', fontWeight: 'bold', fontSize: 16 }
});