import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList, Member } from '../types';
import { Colors } from '../utils/colors';
import { supabase } from '../services/supabase';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
// (login form removed — login is handled in MoreScreen)

type Props = NativeStackScreenProps<MoreStackParamList, 'Directory'>;

// ── 다국어 UI 문자열 ──────────────────────────────────────────────────────────
const UI = {
  title:         { ko: '요람',              en: 'Directory',          es: 'Directorio'         },
  subtitle:      { ko: '성도 디렉토리',     en: 'Member Directory',   es: 'Directorio de Miembros' },
  loginRequired: { ko: '요람은 로그인한 성도만\n이용할 수 있습니다.', en: 'Only logged-in members\ncan access the directory.', es: 'Solo los miembros\nregistrados pueden acceder.' },
  email:         { ko: '이메일',            en: 'Email',              es: 'Correo'             },
  password:      { ko: '비밀번호',          en: 'Password',           es: 'Contraseña'         },
  loginBtn:      { ko: '로그인',            en: 'Sign In',            es: 'Iniciar sesión'     },
  loggingIn:     { ko: '로그인 중…',        en: 'Signing in…',        es: 'Iniciando sesión…'  },
  logoutBtn:     { ko: '로그아웃',          en: 'Sign Out',           es: 'Cerrar sesión'      },
  search:        { ko: '이름, 전화번호, 이메일 검색', en: 'Search name, phone, email', es: 'Buscar nombre, teléfono' },
  empty:         { ko: '성도 정보가 없습니다.', en: 'No members found.',  es: 'No hay miembros.'   },
  emptySearch:   { ko: '검색 결과가 없습니다.', en: 'No results found.', es: 'Sin resultados.'    },
  errorLogin:    { ko: '이메일 또는 비밀번호를 확인해 주세요.', en: 'Invalid email or password.', es: 'Correo o contraseña incorrectos.' },
  loading:       { ko: '불러오는 중…',      en: 'Loading…',           es: 'Cargando…'          },
  members:       { ko: '명',               en: 'members',            es: 'miembros'           },
};

function t(key: keyof typeof UI, lang: string): string {
  return UI[key]?.[lang as 'ko' | 'en' | 'es'] ?? UI[key]?.ko ?? '';
}

// ── 이니셜 아바타 ─────────────────────────────────────────────────────────────
function InitialAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? '?';
  // 이름 해시로 색상 결정
  const colors = ['#1E3A5F', '#2C5282', '#276749', '#744210', '#553C9A', '#97266D'];
  const colorIndex = (name.charCodeAt(0) ?? 0) % colors.length;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors[colorIndex] }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

export default function DirectoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { lang } = useLanguage();

  // ── 멤버 상태 ─────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [fetching, setFetching] = useState(false);

  // 로그인되면 멤버 목록 fetch
  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  const fetchMembers = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('name');
    if (!error && data) setMembers(data as Member[]);
    setFetching(false);
  }, []);

  // ── 검색 필터 ─────────────────────────────────────────────────────────────
  const filtered = query.trim()
    ? members.filter(m => {
        const q = query.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.phone ?? '').toLowerCase().includes(q) ||
          (m.email ?? '').toLowerCase().includes(q)
        );
      })
    : members;

  // ─────────────────────────────────────────────────────────────────────────
  // 로그인 전 화면
  // ─────────────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('title', lang)}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loginWrap}>
          <View style={styles.loginCard}>
            <View style={styles.loginIconWrap}>
              <Icon name="more-directory" size={44} tintColor={Colors.primary} />
            </View>
            <Text style={styles.loginTitle}>{t('title', lang)}</Text>
            <Text style={styles.loginDesc}>{t('loginRequired', lang)}</Text>
            <TouchableOpacity
              style={styles.goLoginBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.goLoginBtnText}>
                {lang === 'en' ? '← Go to More to Sign In'
                  : lang === 'es' ? '← Ir a Más para iniciar sesión'
                  : '← 더보기에서 로그인하기'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 로그인 후 화면
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('title', lang)}</Text>
          <Text style={styles.headerSub}>
            {filtered.length}{t('members', lang) === 'members' ? ' ' : ''}{t('members', lang)}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* 검색 바 */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Icon name="ui-search" size={16} tintColor={Colors.text.light} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search', lang)}
            placeholderTextColor={Colors.text.light}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* 목록 */}
      {fetching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('loading', lang)}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.memberRow}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('MemberDetail', { member: item })}
            >
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.memberPhoto} />
              ) : (
                <InitialAvatar name={item.name} size={48} />
              )}
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.name}</Text>
                {item.phone ? (
                  <Text style={styles.memberSub}>{item.phone}</Text>
                ) : item.email ? (
                  <Text style={styles.memberSub}>{item.email}</Text>
                ) : null}
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="more-directory" size={48} tintColor={Colors.text.light} style={styles.emptyEmoji} />
              <Text style={styles.emptyText}>
                {query ? t('emptySearch', lang) : t('empty', lang)}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backText: { fontSize: 28, color: Colors.primary, lineHeight: 30 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  headerSub: { fontSize: 11, color: Colors.text.secondary, marginTop: 1 },
  // 로그인 안내
  loginWrap: { flex: 1, justifyContent: 'center', padding: 24 },
  loginCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  loginIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F0F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary, marginBottom: 8 },
  loginDesc: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  goLoginBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  goLoginBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },

  // 검색
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text.primary },

  // 목록
  list: { padding: 14, gap: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  memberPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.border,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '800' },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  memberSub: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  arrow: { fontSize: 20, color: Colors.text.light, marginLeft: 4 },

  // 상태
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  loadingText: { fontSize: 14, color: Colors.text.secondary },
  emptyEmoji: { marginBottom: 4 },
  emptyText: { fontSize: 15, color: Colors.text.secondary, fontWeight: '600' },
});
