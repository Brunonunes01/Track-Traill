import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import WeatherCard from '../components/WeatherCard';

export default function ActivityViewScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { atividade }: any = route.params;

    // Verifica se tem rota gravada válida
    const hasRoute = atividade.rota && atividade.rota.length > 0;
    
    // Pega o ponto inicial para centralizar o mapa
    const initialRegion = hasRoute ? {
        latitude: atividade.rota[0].latitude,
        longitude: atividade.rota[0].longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
    } : undefined;

    // Formata os segundos vindos do Firebase para MM:SS
    const formatarDuracao = (totalSegundos: number) => {
        if (!totalSegundos) return "00:00";
        const min = Math.floor(totalSegundos / 60);
        const seg = totalSegundos % 60;
        return `${min < 10 ? '0' : ''}${min}:${seg < 10 ? '0' : ''}${seg}`;
    };

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
                            strokeColor="#ffd700" // Linha dourada premium
                            strokeWidth={5}
                        />
                        <Marker coordinate={atividade.rota[0]} title="Início">
                             <Ionicons name="location" size={40} color="#22c55e" />
                        </Marker>
                        <Marker coordinate={atividade.rota[atividade.rota.length - 1]} title="Fim">
                             <Ionicons name="flag" size={40} color="#ef4444" />
                        </Marker>
                    </MapView>
                ) : (
                    <ImageBackground 
                        source={require('../../assets/images/Azulao.png')} 
                        style={styles.placeholderImage}
                    >
                        <View style={styles.noGpsOverlay}>
                            <Ionicons name="map-outline" size={60} color="#ffd700" />
                            <Text style={styles.noGpsText}>Trajeto GPS não registado</Text>
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
                        <View style={styles.dateBadge}>
                            <Text style={styles.activityDate}>{atividade.data}</Text>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Ionicons name="resize" size={20} color="#ffd700" style={{ marginBottom: 5 }} />
                            <Text style={styles.statLabel}>Distância</Text>
                            <Text style={styles.statValue}>{atividade.distancia ?? 0} <Text style={styles.unit}>km</Text></Text>
                        </View>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.statBox}>
                            <Ionicons name="time-outline" size={20} color="#ffd700" style={{ marginBottom: 5 }} />
                            <Text style={styles.statLabel}>Duração</Text>
                            <Text style={styles.statValue}>{formatarDuracao(atividade.duracao)}</Text>
                        </View>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.statBox}>
                            <Ionicons name="flash-outline" size={20} color="#ffd700" style={{ marginBottom: 5 }} />
                            <Text style={styles.statLabel}>Ritmo</Text>
                            <Text style={styles.statValue}>
                                {atividade.distancia > 0 
                                    ? ((atividade.duracao / 60) / atividade.distancia).toFixed(1) 
                                    : '--'} <Text style={styles.unit}>/km</Text>
                            </Text>
                        </View>
                    </View>

                    <View style={styles.locationBox}>
                         <View style={styles.iconCircle}>
                             <Ionicons name="location" size={20} color="#000" />
                         </View>
                         <View>
                            <Text style={styles.locationTitle}>Local de Registo</Text>
                            <Text style={styles.locationText}>{atividade.cidade}</Text>
                         </View>
                    </View>

                    {hasRoute ? (
                        <WeatherCard
                            latitude={atividade.rota[0].latitude}
                            longitude={atividade.rota[0].longitude}
                        />
                    ) : (
                        <View style={styles.noWeatherBox}>
                            <Text style={styles.noWeatherText}>
                                Clima indisponível: esta atividade não possui coordenadas de rota.
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.shareButton} onPress={() => alert('Em breve: Partilhar no Instagram!')}>
                        <LinearGradient colors={['#ffd700', '#ca8a04']} style={styles.gradientBtn}>
                            <Ionicons name="share-social" size={22} color="#000" />
                            <Text style={styles.shareText}>Partilhar Conquista</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    headerContainer: { height: '50%', width: '100%', position: 'relative' },
    map: { ...StyleSheet.absoluteFillObject },
    placeholderImage: { width: '100%', height: '100%' },
    noGpsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    noGpsText: { color: '#ffd700', fontSize: 18, marginTop: 10, fontWeight: 'bold' },
    
    backButton: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 50, borderWidth: 1, borderColor: '#333' },
    
    detailsContainer: { 
        flex: 1, 
        backgroundColor: '#121212', 
        marginTop: -30, 
        borderTopLeftRadius: 30, 
        borderTopRightRadius: 30,
        padding: 25,
        paddingTop: 30,
        elevation: 20
    },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    activityTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', textTransform: 'capitalize' },
    dateBadge: { backgroundColor: '#1e1e1e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
    activityDate: { fontSize: 14, color: '#ffd700', fontWeight: 'bold' },
    
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e1e1e', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#333' },
    statBox: { alignItems: 'center', flex: 1 },
    statLabel: { color: '#888', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 },
    statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    unit: { fontSize: 14, color: '#aaa', fontWeight: 'normal' },
    divider: { width: 1, backgroundColor: '#333', marginVertical: 10 },

    locationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 15, borderRadius: 15, gap: 15, marginBottom: 30, borderWidth: 1, borderColor: '#333' },
    iconCircle: { backgroundColor: '#ffd700', padding: 10, borderRadius: 50 },
    locationTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    locationText: { color: '#aaa', marginTop: 2 },
    noWeatherBox: { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333', borderRadius: 15, padding: 14, marginBottom: 24 },
    noWeatherText: { color: '#aaa', fontSize: 14 },

    shareButton: { borderRadius: 15, overflow: 'hidden', elevation: 5 },
    gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10 },
    shareText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});
