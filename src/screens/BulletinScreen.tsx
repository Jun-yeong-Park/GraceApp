import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import { Bulletin, BulletinStackParamList } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../services/supabase';
import Icon from '../components/Icon';

type Props = NativeStackScreenProps<BulletinStackParamList, 'BulletinList'>;

const DATE_LOCALES: Record<string, string> = { ko: 'ko-KR', en: 'en-US', es: 'es-ES' };

export default function BulletinScreen({ navigation }: Props) {
  const { t, lang } = useLanguage();
  const dateLocale = DATE_LOCALES[lang] ?? 'ko-KR';

  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBulletins = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data } = await supabase
      .from('bulletins')
      .select('*')
      .order('date', { ascending: false });

    if (data) setBulletins(data as Bulletin[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchBulletins(); }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('bulletinTitle')}</Text>
          <Text style={styles.headerSub}>{t('bulletinSubtitle')}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('bulletinTitle')}</Text>
        <Text style={styles.headerSub}>{t('bulletinSubtitle')}</Text>
      </View>

      <FlatList
        data={bulletins}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, bulletins.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchBulletins(true)}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          const date = new Date(item.date);
          const month = date.toLocaleDateString(dateLocale, { month: 'short' });
          const day = date.getDate();

          const sectionLabels = {
            worship: lang === 'en' ? 'Worship Order' : lang === 'es' ? 'Orden del Culto' : '예배순서',
            anns:    lang === 'en' ? 'Announcements' : lang === 'es' ? 'Anuncios'         : '공지사항',
            prayer:  lang === 'en' ? 'Prayer'        : lang === 'es' ? 'Oración'          : '기도제목',
          };
          const sections = [
            item.worship_order?.length > 0      && sectionLabels.worship,
            item.announcements?.length > 0       && sectionLabels.anns,
            !!item.prayer_requests?.trim()       && sectionLabels.prayer,
          ].filter(Boolean) as string[];

          return (
            <TouchableOpacity
              style={styles.item}
              onPress={() => navigation.navigate('BulletinDetail', { bulletin: item })}
              activeOpacity={0.8}
            >
              <View style={styles.dateBadge}>
                <Text style={styles.dateMonth}>{month}</Text>
                <Text style={styles.dateDay}>{day}</Text>
              </View>

              <View style={styles.itemContent}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.itemDate}>
                  {date.toLocaleDateString(dateLocale, {
                    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                  })}
                </Text>
                {sections.length > 0 && (
                  <View style={styles.sectionBadges}>
                    {sections.map(s => (
                      <View key={s} style={styles.sectionBadge}>
                        <Text style={styles.sectionBadgeText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="admin-bulletins" size={56} tintColor={Colors.text.light} />
            <Text style={styles.emptyText}>{t('bulletinEmpty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  headerSub: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },

  list: { padding: 16, gap: 10, paddingBottom: 110 },
  listEmpty: { flex: 1 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dateBadge: {
    width: 48, height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  dateMonth: { color: Colors.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dateDay: { color: Colors.white, fontSize: 20, fontWeight: '800', lineHeight: 24 },

  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginBottom: 4 },
  itemDate: { fontSize: 12, color: Colors.text.secondary },
  sectionBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  sectionBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  arrow: { fontSize: 22, color: Colors.text.light, marginLeft: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.text.secondary },
});
