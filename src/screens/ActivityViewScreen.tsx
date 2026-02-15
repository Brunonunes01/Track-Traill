import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';

export default function ActivityViewScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { atividade }: any = route.params;

    // Verifica se tem rota gravada
    const hasRoute = atividade.rota && atividade.rota.length > 0;
    
    // Pega o ponto inicial para centralizar o mapa
    const initialRegion = hasRoute ? {
        latitude: atividade.rota[0].latitude,
        longitude: atividade.rota[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    } : undefined;

    return (
        <View style={styles.container}>
            {/* CABEÇALHO COM MAPA OU IMAGEM */}
            <View style={styles.headerContainer}>
                {hasRoute ? (
                    <MapView
                        style={styles.map}
                        provider={PROVIDER_DEFAULT}
                        initialRegion={initialRegion}
                        scrollEnabled={true}
                        zoomEnabled={true}
                    >
                        <Polyline
                            coordinates={atividade.rota}
                            strokeColor="#2563eb"
                            strokeWidth={4}
                        />
                        <Marker coordinate={atividade.rota[0]} title="Início" pinColor="green" />
                        <Marker coordinate={atividade.rota[atividade.rota.length - 1]} title="Fim" pinColor="red" />
                    </MapView>
                ) : (
                    <ImageBackground 
                        source={require('../../assets/images/Corrida.jpg')} 
                        style={styles.placeholderImage}
                    >
                        <View style={styles.noGpsOverlay}>
                            <Ionicons name="navigate-circle-outline" size={60} color="#fff" />
                            <Text style={styles.noGpsText}>Sem dados de GPS</Text>
                        </View>
                    </ImageBackground>
                )}

                {/* Botão Voltar Flutuante */}
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* DETALHES DA ATIVIDADE */}
            <View style={styles.detailsContainer}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.titleRow}>
                        <Text style={styles.activityTitle}>{atividade.tipo}</Text>
                        <Text style={styles.activityDate}>{atividade.data}</Text>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Distância</Text>
                            <Text style={styles.statValue}>{atividade.distancia ?? 0} <Text style={styles.unit}>km</Text></Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Duração</Text>
                            <Text style={styles.statValue}>{atividade.duracao} <Text style={styles.unit}>min</Text></Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Ritmo Médio</Text>
                            <Text style={styles.statValue}>
                                {atividade.distancia > 0 
                                    ? (atividade.duracao / atividade.distancia).toFixed(1) 
                                    : '--'} <Text style={styles.unit}>min/km</Text>
                            </Text>
                        </View>
                    </View>

                    <View style={styles.locationBox}>
                         <Ionicons name="location" size={24} color="#2563eb" />
                         <View>
                            <Text style={styles.locationTitle}>Localização</Text>
                            <Text style={styles.locationText}>{atividade.cidade} - {atividade.estado}</Text>
                         </View>
                    </View>

                    <TouchableOpacity style={styles.shareButton} onPress={() => alert('Em breve: Compartilhar no Instagram!')}>
                        <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.gradientBtn}>
                            <Ionicons name="share-social-outline" size={20} color="#fff" />
                            <Text style={styles.shareText}>Compartilhar Conquista</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    headerContainer: { height: '45%', width: '100%', position: 'relative' },
    map: { ...StyleSheet.absoluteFillObject },
    placeholderImage: { width: '100%', height: '100%' },
    noGpsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    noGpsText: { color: '#fff', fontSize: 16, marginTop: 10, fontWeight: 'bold' },
    backButton: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 20 },
    
    detailsContainer: { 
        flex: 1, 
        backgroundColor: '#1C1C1C', 
        marginTop: -30, 
        borderTopLeftRadius: 30, 
        borderTopRightRadius: 30,
        padding: 25,
        paddingTop: 30
    },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    activityTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', textTransform: 'capitalize' },
    activityDate: { fontSize: 16, color: '#aaa' },
    
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    statBox: { alignItems: 'center' },
    statLabel: { color: '#888', fontSize: 14, marginBottom: 5 },
    statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    unit: { fontSize: 14, color: '#666', fontWeight: 'normal' },

    locationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', padding: 15, borderRadius: 15, gap: 15, marginBottom: 30 },
    locationTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    locationText: { color: '#ccc' },

    shareButton: { borderRadius: 15, overflow: 'hidden' },
    gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10 },
    shareText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});