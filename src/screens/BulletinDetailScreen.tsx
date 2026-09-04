import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BulletinStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';

type Props = NativeStackScreenProps<BulletinStackParamList, 'BulletinDetail'>;

const DATE_LOCALES: Record<string, string> = { ko: 'ko-KR', en: 'en-US', es: 'es-ES' };

export default function BulletinDetailScreen({ navigation, route }: Props) {
  const { bulletin } = route.params;
  const { lang, t } = useLanguage();
  const dateLocale = DATE_LOCALES[lang] ?? 'ko-KR';

  const formattedDate = new Date(bulletin.date).toLocaleDateString(dateLocale, {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const hasWorship       = bulletin.worship_order?.length > 0;
  const hasAnnouncements = bulletin.announcements?.length > 0;
  const hasPrayer        = !!bulletin.prayer_requests?.trim();
  const isEmpty          = !hasWorship && !hasAnnouncements && !hasPrayer;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{bulletin.title}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* 날짜 */}
        <View style={styles.datePill}>
          <Text style={styles.datePillText}>{formattedDate}</Text>
        </View>

        {isEmpty && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>{t('bulletinDetailEmpty')}</Text>
          </View>
        )}

        {/* ── 예배 순서 ──────────────────────────────────────── */}
        {hasWorship && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.sectionTitle}>{t('bulletinSectionWorship')}</Text>
            </View>
            <View style={styles.card}>
              {bulletin.worship_order.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.worshipRow,
                    i < bulletin.worship_order.length - 1 && styles.worshipRowBorder,
                  ]}
                >
                  <Text style={styles.worshipRole}>{item.role}</Text>
                  <Text style={styles.worshipContent}>{item.content}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 공지사항 ────────────────────────────────────────── */}
        {hasAnnouncements && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.sectionTitle}>{t('bulletinSectionAnnouncements')}</Text>
            </View>
            <View style={styles.card}>
              {bulletin.announcements.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.announcementRow,
                    i < bulletin.announcements.length - 1 && styles.worshipRowBorder,
                  ]}
                >
                  <Text style={styles.announcementBullet}>•</Text>
                  <Text style={styles.announcementText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 기도 제목 ────────────────────────────────────────── */}
        {hasPrayer && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.sectionTitle}>{t('bulletinSectionPrayer')}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.prayerText}>{bulletin.prayer_requests}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  backArrow: { fontSize: 30, color: Colors.primary, lineHeight: 32 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontWeight: '700', color: Colors.primary,
  },

  container: { padding: 20 },

  datePill: {
    alignSelf: 'center',
    backgroundColor: Colors.primary + '18',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  datePillText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.text.secondary, letterSpacing: 0.5, textTransform: 'uppercase' },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  worshipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  worshipRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  worshipRole: {
    width: 72,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    flexShrink: 0,
  },
  worshipContent: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },

  announcementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  announcementBullet: {
    fontSize: 16,
    color: '#F59E0B',
    fontWeight: '800',
    lineHeight: 22,
    flexShrink: 0,
  },
  announcementText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 22,
  },

  prayerText: {
    padding: 16,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 24,
  },

  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.text.secondary },
});
