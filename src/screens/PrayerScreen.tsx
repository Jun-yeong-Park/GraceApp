import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import { PrayerRequest } from '../types';
import { MoreStackParamList } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import Icon from '../components/Icon';
import { checkContentFilter } from '../utils/moderation';

type Props = NativeStackScreenProps<MoreStackParamList, 'Prayer'>;

const DATE_LOCALES: Record<string, string> = { ko: 'ko-KR', en: 'en-US', es: 'es-ES' };

export default function PrayerScreen({ navigation }: Props) {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const dateLocale = DATE_LOCALES[lang] ?? 'ko-KR';

  // ── Admin: list ────────────────────────────────────────────────────────────
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // ── Submission form ────────────────────────────────────────────────────────
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isAdmin) loadPrayers();
  }, [isAdmin]);

  async function loadPrayers() {
    setListLoading(true);
    try {
      const { data } = await supabase
        .from('prayer_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setPrayers(data as PrayerRequest[]);
    } catch { /* ignore */ }
    setListLoading(false);
  }

  async function deletePrayer(id: string) {
    Alert.alert(t('errorTitle'), t('prayerDeleteMsg'), [
      { text: t('cancelBtn'), style: 'cancel' },
      {
        text: t('deleteLabel'), style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('prayer_requests').delete().eq('id', id);
          if (error) { Alert.alert(t('errorTitle'), error.message); return; }
          setPrayers(prev => prev.filter(p => p.id !== id));
        },
      },
    ]);
  }

  async function submitPrayer() {
    if (!content.trim()) {
      Alert.alert(t('errorTitle'), t('prayerError'));
      return;
    }
    const lng: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
    if (checkContentFilter(`${content} ${author}`, lng)) return;
    setSubmitting(true);
    const payload = {
      author_name: isAnonymous ? t('anonymous') : (author.trim() || t('anonymous')),
      content: content.trim(),
      is_anonymous: isAnonymous,
    };
    const { error } = await supabase.from('prayer_requests').insert(payload);
    setSubmitting(false);
    if (error) {
      Alert.alert(t('errorTitle'), t('submitErrorMsg'));
      return;
    }
    setContent('');
    setAuthor('');
    setIsAnonymous(false);
    setSubmitted(true);
    if (isAdmin) loadPrayers();
  }

  function formatRelative(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return t('justNow');
    if (diffHours < 24) return `${diffHours}${t('hoursAgo')}`;
    if (diffDays < 7) return `${diffDays}${t('daysAgo')}`;
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('prayerTab')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        {/* ── 관리자 목록 ── */}
        {isAdmin && (
          listLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : prayers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="action-prayer" size={56} tintColor={Colors.text.light} />
              <Text style={styles.emptyText}>{t('prayerEmptyList')}</Text>
            </View>
          ) : (
            <FlatList
              data={prayers}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {item.is_anonymous ? t('anonymous').charAt(0) : item.author_name.charAt(0)}
                        </Text>
                      </View>
                      <Text style={styles.authorName}>
                        {item.is_anonymous ? t('anonymous') : item.author_name}
                      </Text>
                    </View>
                    <View style={styles.cardHeaderRight}>
                      <Text style={styles.cardDate}>{formatRelative(item.created_at)}</Text>
                      <TouchableOpacity onPress={() => deletePrayer(item.id)} style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.cardContent}>{item.content}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardFooterText}>{t('prayingTogether')}</Text>
                  </View>
                </View>
              )}
            />
          )
        )}

        {/* ── 일반 사용자: 제출 폼 또는 완료 메시지 ── */}
        {!isAdmin && (
          submitted ? (
            <View style={styles.successBox}>
              <Icon name="action-prayer" size={72} tintColor={Colors.primary} style={styles.successEmoji} />
              <Text style={styles.successTitle}>{t('prayerSuccessTitle')}</Text>
              <Text style={styles.successSub}>{t('prayerSuccessSub')}</Text>
              <TouchableOpacity style={styles.anotherBtn} onPress={() => setSubmitted(false)}>
                <Text style={styles.anotherBtnText}>{t('prayerAnotherBtn')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formBox}>
              <Text style={styles.formTitle}>{t('prayerModalTitle')}</Text>
              <Text style={styles.formSub}>{t('prayerModalSub')}</Text>

              <View style={styles.anonymousRow}>
                <Text style={styles.anonymousLabel}>{t('postAnonymously')}</Text>
                <Switch
                  value={isAnonymous}
                  onValueChange={setIsAnonymous}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>

              {!isAnonymous && (
                <TextInput
                  style={styles.input}
                  placeholder={t('prayerNamePlaceholder')}
                  placeholderTextColor={Colors.text.light}
                  value={author}
                  onChangeText={setAuthor}
                />
              )}

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('prayerContentPlaceholder')}
                placeholderTextColor={Colors.text.light}
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitPrayer}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>{t('postBtn')}</Text>
                }
              </TouchableOpacity>
            </View>
          )
        )}

        {/* ── 관리자: 하단 제출 폼 ── */}
        {isAdmin && (
          <View style={styles.adminFormBar}>
            <TouchableOpacity
              style={styles.adminAddBtn}
              onPress={() => {
                setSubmitted(false);
                void 0;
              }}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backBtnText: { fontSize: 30, color: Colors.primary, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.primary },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: Colors.text.secondary },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  authorName: { fontSize: 14, fontWeight: '700', color: Colors.text.primary },
  cardDate: { fontSize: 12, color: Colors.text.light },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
  cardContent: { fontSize: 14, color: Colors.text.primary, lineHeight: 22, marginBottom: 10 },
  cardFooter: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  cardFooterText: { fontSize: 12, color: Colors.text.secondary },
  successBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  successEmoji: { marginBottom: 8 },
  successTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, textAlign: 'center' },
  successSub: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  anotherBtn: {
    marginTop: 16, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: Colors.primary, borderRadius: 10,
  },
  anotherBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  formBox: {
    flex: 1, padding: 20,
  },
  formTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  formSub: { fontSize: 13, color: Colors.text.secondary, marginBottom: 20, lineHeight: 20 },
  anonymousRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, backgroundColor: Colors.white,
    padding: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  anonymousLabel: { fontSize: 15, color: Colors.text.primary, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 14, fontSize: 14, marginBottom: 12,
    color: Colors.text.primary, backgroundColor: Colors.white,
  },
  textArea: { height: 130 },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  adminFormBar: {},
  adminAddBtn: {},
});
