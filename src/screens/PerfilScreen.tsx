import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from "expo-clipboard";
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, database } from '../../services/connectionFirebase';
import { ensureUserRole, resolveUserRole } from '../../services/adminService';
import { ensureUserProfileCompatibility, updatePublicProfile } from "../services/userService";

export default function PerfilScreen() {
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Dados do Usuário
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [uidLogado, setUidLogado] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');

  // Estatísticas
  const [totalKm, setTotalKm] = useState(0);
  const [totalMinutos, setTotalMinutos] = useState(0);

  const navigation = useNavigation<any>();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUidLogado(user.uid);
        setEmail(user.email || '');
        ensureUserRole(user.uid, user.email || '');
        ensureUserProfileCompatibility({ uid: user.uid, email: user.email || "" });

        const userRef = ref(database, `users/${user.uid}`);
        
        const unsubscribeDB = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            
            setFullName(data.fullName || 'Usuário Sem Nome');
            setUsername(data.username || `user_${user.uid.substring(0, 6)}`);
            setRole(resolveUserRole(data, user.email || '') as 'user' | 'admin');

            if (data.atividades) {
              let km = 0;
              let min = 0;
              Object.values(data.atividades).forEach((ativ: any) => {
                km += Number(ativ.distancia || 0);
                min += Number(ativ.duracao || 0);
              });
              setTotalKm(km);
              setTotalMinutos(min);
            } else {
              setTotalKm(0);
              setTotalMinutos(0);
            }
          } else {
            setFullName('Novo Explorador');
            setUsername('user_' + user.uid.substring(0, 5));
            setRole('user');
          }
          setLoading(false);
        }, (error) => {
          Alert.alert('Erro de Leitura', 'O Firebase bloqueou o acesso: ' + error.message);
          setLoading(false);
        });

        return () => unsubscribeDB();

      } else {
        setLoading(false);
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    });

    return () => unsubscribeAuth();
  }, [navigation]);

  const handleSaveProfile = async () => {
    if (!fullName || !username) {
      Alert.alert('Atenção', 'Nome e Username não podem ficar vazios.');
      return;
    }
    if (!uidLogado) return;

    try {
      await updatePublicProfile({
        uid: uidLogado,
        fullName,
        username,
      });
      setIsEditing(false);
      Alert.alert('Sucesso', 'O seu perfil foi atualizado!');
    } catch (error: any) {
      Alert.alert('Erro', 'Falha ao atualizar perfil: ' + error.message);
    }
  };

  const profileDeepLink = `tracktrail://user/${username}`;
  const profileWebLink = `https://tracktrail.app/user/${username}`;

  const handleCopyProfileLink = async () => {
    await Clipboard.setStringAsync(profileDeepLink);
    Alert.alert("Link copiado", profileDeepLink);
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Meu perfil no Track & Trail:\n${profileDeepLink}\n${profileWebLink}`,
      });
    } catch {
      Alert.alert("Erro", "Não foi possível compartilhar o perfil agora.");
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair da Conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Sair', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await signOut(auth);
          } catch {
            Alert.alert('Erro', 'Não foi possível fazer logout.');
          }
        } 
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: '#aaa', marginTop: 15 }}>A sincronizar perfil...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={require('../../assets/images/Azulao.png')} style={styles.background}>
      <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']} style={styles.overlay}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Meu Perfil</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.backButton}>
            <Ionicons name="log-out-outline" size={28} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{fullName ? fullName.charAt(0).toUpperCase() : 'U'}</Text>
            </View>
            <Text style={styles.usernameText}>@{username}</Text>
            <View style={[styles.roleBadge, role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
              <Text style={styles.roleText}>{role.toUpperCase()}</Text>
            </View>
            <View style={styles.shareRow}>
              <TouchableOpacity style={styles.shareButton} onPress={handleCopyProfileLink}>
                <Ionicons name="copy-outline" size={16} color="#d1d5db" />
                <Text style={styles.shareButtonText}>Copiar link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareButton} onPress={handleShareProfile}>
                <Ionicons name="share-social-outline" size={16} color="#d1d5db" />
                <Text style={styles.shareButtonText}>Compartilhar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Ionicons name="resize" size={24} color="#2563eb" />
              <Text style={styles.statValue}>{totalKm.toFixed(1)} km</Text>
              <Text style={styles.statLabel}>Percorridos</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Ionicons name="time" size={24} color="#22c55e" />
              <Text style={styles.statValue}>{totalMinutos} min</Text>
              <Text style={styles.statLabel}>de Atividade</Text>
            </View>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Informações Pessoais</Text>
              <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
                <Ionicons name={isEditing ? "close-circle" : "pencil"} size={24} color="#aaa" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={[styles.input, isEditing ? styles.inputEditable : null]}
              value={fullName}
              onChangeText={setFullName}
              editable={isEditing}
              placeholderTextColor="#888"
            />

            <Text style={styles.label}>Nome de Usuário</Text>
            <TextInput
              style={[styles.input, isEditing ? styles.inputEditable : null]}
              value={username}
              onChangeText={setUsername}
              editable={isEditing}
              placeholderTextColor="#888"
              autoCapitalize="none"
            />

            <Text style={styles.label}>E-mail (privado)</Text>
            <TextInput
              style={[styles.input, { color: '#666' }]}
              value={email}
              editable={false}
            />

            {isEditing && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
                <Text style={styles.saveButtonText}>SALVAR ALTERAÇÕES</Text>
              </TouchableOpacity>
            )}

            {/* Botão exclusivo para contas com role admin. */}
            {role === 'admin' && (
              <TouchableOpacity 
                style={{ backgroundColor: '#ef4444', borderRadius: 25, paddingVertical: 15, alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center' }} 
                onPress={() => navigation.navigate("AdminDashboard")}
              >
                <Ionicons name="shield-checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>PAINEL DE ADMINISTRAÇÃO</Text>
              </TouchableOpacity>
            )}

          </View>

        </ScrollView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  background: { flex: 1, resizeMode: 'cover' },
  overlay: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20 },
  backButton: { padding: 5 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarContainer: { alignItems: 'center', marginBottom: 30 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff', elevation: 5 },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  usernameText: { color: '#aaa', fontSize: 16, marginTop: 10, fontWeight: '600' },
  roleBadge: { marginTop: 10, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  roleBadgeAdmin: { backgroundColor: 'rgba(239, 68, 68, 0.25)', borderWidth: 1, borderColor: '#ef4444' },
  roleBadgeUser: { backgroundColor: 'rgba(37, 99, 235, 0.25)', borderWidth: 1, borderColor: '#2563eb' },
  roleText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  shareRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shareButtonText: { color: "#d1d5db", fontSize: 12, fontWeight: "700" },
  statsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statBox: { flex: 1, alignItems: 'center' },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 15 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 8 },
  statLabel: { color: '#aaa', fontSize: 12, marginTop: 4 },
  formContainer: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  formTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  label: { color: '#bbb', fontSize: 13, marginBottom: 5, marginLeft: 5 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: 'transparent' },
  inputEditable: { borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)' },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 25, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
