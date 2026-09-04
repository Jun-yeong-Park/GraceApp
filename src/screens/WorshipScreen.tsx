import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WorshipStackParamList, Bulletin } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../i18n/translations';

type Props = NativeStackScreenProps<WorshipStackParamList, 'WorshipMain'>;

const LATEST_YOUTUBE_URL = 'https://www.youtube.com/live/vOI6wz51_20?si=eM0l56-mLCyTyLUy';
const YOUTUBE_THUMBNAIL = 'https://img.youtube.com/vi/vOI6wz51_20/hqdefault.jpg';

interface BulletinItem extends Bulletin {
  titleKey: TranslationKey;
}

const DUMMY_BULLETINS: BulletinItem[] = [
  { id: '1', title: '2026년 4월 12일 주보', titleKey: 'bulletinB1Title', date: '2026-04-12', worship_order: [], announcements: [], prayer_requests: '', created_at: '2026-04-10T10:00:00Z' },
  { id: '2', title: '2026년 4월 5일 주보',  titleKey: 'bulletinB2Title', date: '2026-04-05', worship_order: [], announcements: [], prayer_requests: '', created_at: '2026-04-03T10:00:00Z' },
  { id: '3', title: '2026년 3월 29일 주보', titleKey: 'bulletinB3Title', date: '2026-03-29', worship_order: [], announcements: [], prayer_requests: '', created_at: '2026-03-27T10:00:00Z' },
  { id: '4', title: '2026년 3월 22일 주보', titleKey: 'bulletinB4Title', date: '2026-03-22', worship_order: [], announcements: [], prayer_requests: '', created_at: '2026-03-20T10:00:00Z' },
];

const DATE_LOCALES: Record<string, string> = { ko: 'ko-KR', en: 'en-US', es: 'es-ES' };

type ScheduleItem = { ko: string; en: string; es: string };

const sundaySchedule: ScheduleItem[] = [
  { ko: '주일예배',  en: 'Sunday Service',        es: 'Culto Dominical'    },
  { ko: '어린이부',  en: 'Sunday School',          es: 'Escuela Dominical'  },
  { ko: '청년부',    en: 'English Young Adults',   es: 'Jóvenes en Inglés'  },
  { ko: '청소년부',  en: 'Youth Group',            es: 'Grupo Juvenil'      },
];
const weekdaySchedule: ScheduleItem[] = [
  { ko: '북클럽',         en: 'Bookclub Meeting',      es: 'Club de Lectura'        },
  { ko: '영어 성경 읽기', en: 'English Bible Reading', es: 'Lectura Bíblica'        },
  { ko: '커피 브레이크',  en: 'Coffee Break',          es: 'Pausa de Café'          },
  { ko: '토요 성경 공부', en: 'Saturday Bible Study',  es: 'Estudio Bíblico Sábado' },
];

const sundayTimes: Record<string, string[]> = {
  ko: ['일요일 오전 9시 · 11시', '일요일 오전 11시', '금요일 오후 6시', '일요일 오후 1시'],
  en: ['Sunday 9 & 11 AM',       'Sunday 11 AM',     'Friday 6 PM',     'Sunday 1 PM'  ],
  es: ['Domingo 9 & 11 AM',      'Domingo 11 AM',    'Viernes 6 PM',    'Domingo 1 PM' ],
};
const weekdayTimes: Record<string, string[]> = {
  ko: ['수요일 오전 10시', '수요일 오후 9시', '금요일 오전 10시', '토요일 오후 5시'],
  en: ['Wednesday 10 AM', 'Wednesday 9 PM', 'Friday 10 AM',     'Saturday 5 PM' ],
  es: ['Miércoles 10 AM', 'Miércoles 9 PM', 'Viernes 10 AM',    'Sábado 5 PM'   ],
};

const UI = {
  recentSermon: { ko: '최근 설교',    en: 'Recent Sermon',   es: 'Sermón Reciente'   },
  watchYoutube: { ko: 'YouTube에서 보기', en: 'Watch on YouTube', es: 'Ver en YouTube' },
  serviceInfo:  { ko: '예배 안내',    en: 'Service Info',    es: 'Horario de Cultos'  },
  sunday:       { ko: '🙏 주일 예배', en: '🙏 Sunday Services', es: '🙏 Cultos Dominicales' },
  weekday:      { ko: '📖 주중 모임', en: '📖 Weekday Meetings', es: '📖 Reuniones Semanales' },
  bulletin:     { ko: '주보',         en: 'Bulletin',        es: 'Boletín'            },
};

function lu(key: keyof typeof UI, lang: string) {
  const l: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
  return UI[key][l] ?? UI[key]['ko'];
}

export default function WorshipScreen({ navigation }: Props) {
  const { t, lang } = useLanguage();
  const L: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
  const dateLocale = DATE_LOCALES[L];
  const [sermonTitle, setSermonTitle] = useState('');

  useEffect(() => {
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(LATEST_YOUTUBE_URL)}&format=json`)
      .then(r => r.json())
      .then(d => { if (d.title) setSermonTitle(d.title); })
      .catch(() => {});
  }, []);

  function scheduleName(item: ScheduleItem) {
    return item[L] ?? item.ko;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── 최근 설교 ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{lu('recentSermon', lang)}</Text>
        <TouchableOpacity
          style={styles.sermonCard}
          onPress={() => Linking.openURL(LATEST_YOUTUBE_URL)}
          activeOpacity={0.85}
        >
          <View style={styles.thumbnailWrap}>
            <Image source={{ uri: YOUTUBE_THUMBNAIL }} style={styles.thumbnail} resizeMode="cover" />
            <View style={styles.playOverlay}>
              <View style={styles.playBtn}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            </View>
          </View>
          <View style={styles.sermonInfo}>
            <Text style={styles.sermonTitle} numberOfLines={3}>
              {sermonTitle || t('homeLatestSermonTitle')}
            </Text>
            <Text style={styles.watchLabel}>{lu('watchYoutube', lang)} ›</Text>
          </View>
        </TouchableOpacity>

        {/* ── 예배 안내 ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{lu('serviceInfo', lang)}</Text>
        <View style={styles.scheduleCard}>
          <View style={styles.scheduleSection}>
            <Text style={styles.scheduleSectionTitle}>{lu('sunday', lang)}</Text>
          </View>
          {sundaySchedule.map((item, i) => (
            <View key={i} style={[styles.scheduleRow, styles.scheduleRowBorder]}>
              <View style={styles.scheduleLeft}>
                {i === 0 && <View style={styles.scheduleAccent} />}
                <Text style={[styles.scheduleName, i === 0 && styles.scheduleNameHL]}>
                  {scheduleName(item)}
                </Text>
              </View>
              <Text style={[styles.scheduleTime, i === 0 && styles.scheduleTimeHL]}>
                {(sundayTimes[L] ?? sundayTimes['en'])[i]}
              </Text>
            </View>
          ))}
          <View style={{ height: 10 }} />
          <View style={styles.scheduleSection}>
            <Text style={styles.scheduleSectionTitle}>{lu('weekday', lang)}</Text>
          </View>
          {weekdaySchedule.map((item, i) => (
            <View key={i} style={[styles.scheduleRow, i < weekdaySchedule.length - 1 && styles.scheduleRowBorder]}>
              <Text style={styles.scheduleName}>{scheduleName(item)}</Text>
              <Text style={styles.scheduleTime}>{(weekdayTimes[L] ?? weekdayTimes['en'])[i]}</Text>
            </View>
          ))}
        </View>

        {/* ── 주보 ──────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{lu('bulletin', lang)}</Text>
        <View style={styles.bulletinCard}>
          {DUMMY_BULLETINS.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.bulletinRow, index < DUMMY_BULLETINS.length - 1 && styles.bulletinRowBorder]}
              onPress={() => navigation.navigate('BulletinDetail', { bulletin: { ...item, title: t(item.titleKey) } })}
              activeOpacity={0.8}
            >
              <View style={styles.dateBadge}>
                <Text style={styles.dateMonth}>
                  {new Date(item.date).toLocaleDateString(dateLocale, { month: 'short' })}
                </Text>
                <Text style={styles.dateDay}>{new Date(item.date).getDate()}</Text>
              </View>
              <View style={styles.bulletinInfo}>
                <Text style={styles.bulletinTitle}>{t(item.titleKey)}</Text>
                <Text style={styles.bulletinDate}>
                  {new Date(item.date).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                </Text>
              </View>
              <Text style={styles.bulletinArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 10,
    marginTop: 4,
  },

  // 설교
  sermonCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 90,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbnailWrap: { width: 120, height: 90, backgroundColor: Colors.primary },
  thumbnail: { width: 120, height: 90 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  playIcon: { color: Colors.white, fontSize: 14, marginLeft: 3 },
  sermonInfo: { flex: 1, padding: 14, justifyContent: 'center', gap: 6 },
  sermonTitle: { fontSize: 14, fontWeight: '700', color: Colors.text.primary, lineHeight: 20 },
  watchLabel: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  // 예배 안내
  scheduleCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  scheduleSection: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  scheduleSectionTitle: {
    fontSize: 11, fontWeight: '700',
    color: Colors.text.secondary, letterSpacing: 0.3,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  scheduleRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  scheduleLeft: { flexDirection: 'row', alignItems: 'center' },
  scheduleAccent: {
    width: 3, height: 16, borderRadius: 2,
    backgroundColor: Colors.secondary, marginRight: 8,
  },
  scheduleName: { fontSize: 14, fontWeight: '500', color: Colors.text.primary },
  scheduleNameHL: { color: Colors.primary, fontWeight: '700' },
  scheduleTime: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' },
  scheduleTimeHL: { color: Colors.primary, fontWeight: '700' },

  // 주보
  bulletinCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  bulletinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  bulletinRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dateBadge: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  dateMonth: { fontSize: 9, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase' },
  dateDay: { fontSize: 18, fontWeight: '800', color: Colors.white, lineHeight: 22 },
  bulletinInfo: { flex: 1 },
  bulletinTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: 3 },
  bulletinDate: { fontSize: 11, color: Colors.text.secondary },
  bulletinArrow: { fontSize: 20, color: Colors.text.light },
});
