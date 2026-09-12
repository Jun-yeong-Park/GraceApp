import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommunityTabStackParamList } from "../types";
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import Icon, { COMMUNITY_ICON } from '../components/Icon';

type Props = NativeStackScreenProps<CommunityTabStackParamList, 'CommunityMain'>;

export const COMMUNITIES = [
  {
    id: 'kosovo',
    ko: '코소보 공동체',
    en: 'Kosovo Community',
    es: 'Comunidad de Kosovo',
    emoji: '🕊️',
    color: '#1B4F8A',
  },
  {
    id: 'albania',
    ko: '알바니아 공동체',
    en: 'Albania Community',
    es: 'Comunidad de Albania',
    emoji: '🦅',
    color: '#C41E3A',
  },
  {
    id: 'dagestan',
    ko: '다게스탄 공동체',
    en: 'Dagestan Community',
    es: 'Comunidad de Daguestán',
    emoji: '⛰️',
    color: '#2D6A4F',
  },
  {
    id: 'kissimmee',
    ko: '키시미 (니카라과) 공동체',
    en: 'Kissimmee (Nicaragua) Community',
    es: 'Comunidad Kissimmee (Nicaragua)',
    emoji: '🌿',
    color: '#2E7D32',
  },
  {
    id: 'bridge',
    ko: '브릿지 공동체',
    en: 'Bridge Community',
    es: 'Comunidad Puente',
    emoji: '🌉',
    color: '#1565C0',
  },
  {
    id: 'hope',
    ko: '소망 공동체',
    en: 'Hope Community',
    es: 'Comunidad Esperanza',
    emoji: '✨',
    color: '#6A0DAD',
  },
  {
    id: 'community7',
    ko: '공동체',
    en: 'Community',
    es: 'Comunidad',
    emoji: '🤝',
    color: '#C5A84F',
  },
];

// 로그인 게이트 문구 (App Store Guideline 1.2 — UGC 열람 전 EULA 동의 보장)
const GATE = {
  title:  { ko: '커뮤니티는 로그인 후 이용할 수 있습니다',
            en: 'Sign in to view the community',
            es: 'Inicia sesión para ver la comunidad' },
  body:   { ko: '교인 간 게시물·사진·채팅을 안전하게 운영하기 위해 로그인이 필요합니다.\n\n부적절한 콘텐츠와 학대 행위에는 무관용 원칙이 적용되며, 신고된 콘텐츠는 24시간 내에 검토·삭제됩니다.',
            en: 'Sign-in is required so posts, photos, and chat stay safe for everyone.\n\nWe have zero tolerance for objectionable content and abusive users. Reported content is reviewed and removed within 24 hours.',
            es: 'Se requiere iniciar sesión para mantener seguras las publicaciones, fotos y chats.\n\nTenemos tolerancia cero con el contenido objetable y los usuarios abusivos. El contenido reportado se revisa y elimina en 24 horas.' },
  button: { ko: '로그인 / 회원가입', en: 'Sign In / Sign Up', es: 'Entrar / Registrarse' },
  terms:  { ko: '이용약관 보기', en: 'View Terms of Use', es: 'Ver Términos de Uso' },
};

export type CommunityItem = typeof COMMUNITIES[0];

export function getCommunityName(c: CommunityItem, lang: string) {
  return lang === 'en' ? c.en : lang === 'es' ? c.es : c.ko;
}

export default function CommunityScreen({ navigation }: Props) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const g: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  // 더보기 탭의 로그인 모달을 연다 (인증 UI 는 MoreScreen 한 곳에만 존재)
  function goToLogin() {
    (navigation.getParent() as any)?.navigate('More', {
      screen: 'MoreMain',
      params: { openLogin: true },
    });
  }

  function goToTerms() {
    (navigation.getParent() as any)?.navigate('More', { screen: 'Eula' });
  }

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('community_posts')
      .select('community_id')
      .then(({ data }) => {
        if (data) {
          const counts: Record<string, number> = {};
          data.forEach((row) => {
            counts[row.community_id] = (counts[row.community_id] ?? 0) + 1;
          });
          setPostCounts(counts);
        }
        setLoading(false);
      }, () => setLoading(false));
  }, [user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('communityTitle')}</Text>
        <View style={styles.backBtn} />
      </View>

      {!user ? (
        /* ── 로그인 게이트 (App Store Guideline 1.2) ── */
        <View style={styles.gateWrap}>
          <Icon name="more-privacy" size={56} tintColor={Colors.text.light} style={styles.gateEmoji} />
          <Text style={styles.gateTitle}>{GATE.title[g]}</Text>
          <Text style={styles.gateBody}>{GATE.body[g]}</Text>
          <TouchableOpacity style={styles.gateBtn} onPress={goToLogin} activeOpacity={0.85}>
            <Text style={styles.gateBtnText}>{GATE.button[g]}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToTerms} hitSlop={8}>
            <Text style={styles.gateTermsLink}>{GATE.terms[g]}</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <FlatList
        data={COMMUNITIES}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.subtitle}>{t('communitySubtitle')}</Text>
        }
        renderItem={({ item }) => {
          const count = postCounts[item.id] ?? 0;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}
              activeOpacity={0.8}
            >
              {/* 왼쪽 컬러 바 */}
              <View style={[styles.colorBar, { backgroundColor: item.color }]} />

              {/* 이모지 */}
              <View style={[styles.emojiWrap, { backgroundColor: item.color + '18' }]}>
                <Icon name={COMMUNITY_ICON[item.id]} size={52} />
              </View>

              {/* 텍스트 */}
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{getCommunityName(item, lang)}</Text>
                <Text style={styles.cardMeta}>
                  {count > 0
                    ? `${count}${t('communityPostCount')}`
                    : t('communityNoPost')}
                </Text>
              </View>

              {/* 뱃지 + 화살표 */}
              {count > 0 && (
                <View style={[styles.countBadge, { backgroundColor: item.color }]}>
                  <Text style={styles.countBadgeText}>{count}</Text>
                </View>
              )}
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : null
        }
      />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 30,
    color: Colors.primary,
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },

  // 로그인 게이트
  gateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 110,
  },
  gateEmoji: { marginBottom: 16 },
  gateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  gateBody: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  gateBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  gateBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  gateTermsLink: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // 리스트
  list: {
    padding: 20,
    paddingBottom: 110,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },

  // 공동체 카드
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  emojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 14,
    marginVertical: 14,
  },
  cardInfo: {
    flex: 1,
    paddingVertical: 16,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    marginRight: 8,
  },
  countBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  arrow: {
    fontSize: 24,
    color: Colors.text.light,
    marginRight: 14,
  },
});
