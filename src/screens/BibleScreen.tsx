import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BibleStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { BIBLE_BOOKS, TOTAL_CHAPTERS, BibleBook } from '../data/bibleBooks';
import { useBibleProgress } from '../hooks/useBibleProgress';
import { useLanguage } from '../context/LanguageContext';

type Props = NativeStackScreenProps<BibleStackParamList, 'BibleMain'>;
type Tab = 'OT' | 'NT';

const TRANSLATION_OPTIONS = [
  { id: 'gaeyeok',  label: '개역개정',    group: '한국어' },
  { id: 'new_rev',  label: '새번역',      group: '한국어' },
  { id: 'easy_kor', label: '쉬운성경',    group: '한국어' },
  { id: 'modern',   label: '현대인성경',  group: '한국어' },
  { id: 'niv',      label: 'NIV',         group: 'English' },
  { id: 'esv',      label: 'ESV',         group: 'English' },
  { id: 'nkjv',     label: 'NKJV',        group: 'English' },
  { id: 'rv',       label: 'Reina-Valera', group: 'Español' },
];

function defaultTransId(lang: string): string {
  if (lang === 'en') return 'niv';
  if (lang === 'es') return 'rv';
  return 'gaeyeok';
}

export default function BibleScreen({ navigation }: Props) {
  const { lang, t } = useLanguage();
  const { getBookProgress, getTotalProgress } = useBibleProgress();
  const [tab, setTab] = useState<Tab>('NT');
  const [selectedTransId, setSelectedTransId] = useState(() => defaultTransId(lang));
  const [transModalVisible, setTransModalVisible] = useState(false);

  const selectedTrans = TRANSLATION_OPTIONS.find(t => t.id === selectedTransId)!;
  // zh/tl → 영어로 폴백
  const L: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  const { read: totalRead } = getTotalProgress();
  const pct = Math.round((totalRead / TOTAL_CHAPTERS) * 100);

  const books = BIBLE_BOOKS.filter(b => b.testament === tab);

  const TAB_LABELS = {
    OT: { ko: '구약', en: 'Old Testament', es: 'A. Testamento' },
    NT: { ko: '신약', en: 'New Testament', es: 'N. Testamento' },
  };

  const HEADER = {
    ko: '공동체 성경 읽기',
    en: 'Community Bible Reading',
    es: 'Lectura Bíblica',
  };

  const CHAPTER_SUFFIX = { ko: '장', en: 'ch', es: 'cap' };
  const READ_SUFFIX = { ko: '읽음', en: 'read', es: 'leído' };

  function renderBook({ item }: { item: BibleBook }) {
    const { read, total } = getBookProgress(item.num);
    const done = read === total;
    const pctBook = total > 0 ? read / total : 0;
    const bookName = item.name[L];

    return (
      <TouchableOpacity
        style={styles.bookRow}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('BibleBookChapters', { bookNum: item.num, translationId: selectedTransId } as any)}
      >
        {/* 왼쪽: 이름 + 진도 텍스트 */}
        <View style={styles.bookLeft}>
          <View style={styles.bookNameRow}>
            <Text style={[styles.bookName, done && styles.bookNameDone]} numberOfLines={1}>
              {bookName}
            </Text>
            {done && (
              <View style={styles.doneBadge}>
                <Text style={styles.doneBadgeText}>✓</Text>
              </View>
            )}
          </View>
          {/* 진도 바 */}
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${pctBook * 100}%` as any }]} />
          </View>
        </View>

        {/* 오른쪽: X/XX장 */}
        <Text style={[styles.chapterCount, done && styles.chapterCountDone]}>
          {read}/{total} {CHAPTER_SUFFIX[L]}
        </Text>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>{HEADER[L]}</Text>
          <View style={styles.headerBadges}>
            <View style={styles.translationBadge}>
              <Text style={styles.translationText}>{selectedTrans.label}</Text>
            </View>
            <TouchableOpacity
              style={styles.transPickBtn}
              onPress={() => setTransModalVisible(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.transPickText}>{t('biblePickVersion')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 전체 진도 */}
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>
            {totalRead} / {TOTAL_CHAPTERS} {CHAPTER_SUFFIX[L]}
            {'  '}
            <Text style={styles.totalPct}>{pct}%</Text>
          </Text>
        </View>
        <View style={styles.totalBarBg}>
          <View style={[styles.totalBarFill, { width: `${pct}%` as any }]} />
        </View>
      </View>

      {/* 구약 / 신약 탭 */}
      <View style={styles.tabBar}>
        {(['OT', 'NT'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {TAB_LABELS[t][L]}
            </Text>
            <Text style={[styles.tabCount, tab === t && styles.tabCountActive]}>
              {BIBLE_BOOKS.filter(b => b.testament === t).length}
              {L === 'ko' ? '권' : L === 'es' ? ' lib.' : ' bks'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 책 목록 */}
      <FlatList
        data={books}
        keyExtractor={item => String(item.num)}
        contentContainerStyle={styles.list}
        renderItem={renderBook}
        showsVerticalScrollIndicator={false}
      />

      {/* 역본 선택 모달 */}
      <Modal
        visible={transModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTransModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTransModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {L === 'en' ? 'Select Translation' : L === 'es' ? 'Seleccionar Versión' : '역본 선택'}
            </Text>

            {['한국어', 'English'].map(group => (
              <View key={group}>
                <Text style={styles.modalGroupLabel}>
                  {group === '한국어'
                    ? (L === 'en' ? 'Korean' : L === 'es' ? 'Coreano' : '한국어')
                    : group}
                </Text>
                {TRANSLATION_OPTIONS.filter(t => t.group === group).map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.modalOption, selectedTransId === t.id && styles.modalOptionActive]}
                    onPress={() => { setSelectedTransId(t.id); setTransModalVisible(false); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.modalOptionText, selectedTransId === t.id && styles.modalOptionTextActive]}>
                      {t.label}
                    </Text>
                    {selectedTransId === t.id && (
                      <Text style={styles.modalCheckMark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  // 헤더
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  translationBadge: {
    backgroundColor: 'rgba(197,168,79,0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  translationText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondary,
  },
  transPickBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  transPickText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },

  // 역본 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  modalGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.light,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 10,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: Colors.background,
  },
  modalOptionActive: {
    backgroundColor: '#EBF4FF',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalCheckMark: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  totalPct: {
    color: Colors.secondary,
    fontWeight: '800',
    fontSize: 14,
  },
  totalBarBg: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
  },
  totalBarFill: {
    height: 5,
    backgroundColor: Colors.secondary,
    borderRadius: 3,
  },

  // 탭
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text.secondary },
  tabBtnTextActive: { color: Colors.primary },
  tabCount: { fontSize: 11, color: Colors.text.light, marginTop: 2 },
  tabCountActive: { color: Colors.primary },

  // 책 목록
  list: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 100 },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  bookLeft: { flex: 1, marginRight: 10 },
  bookNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bookName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    flexShrink: 1,
  },
  bookNameDone: { color: Colors.primary },
  doneBadge: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  barBg: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  barFill: {
    height: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 2,
  },
  chapterCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    minWidth: 52,
    textAlign: 'right',
    marginRight: 4,
  },
  chapterCountDone: { color: Colors.primary },
  arrow: { fontSize: 20, color: Colors.text.light },
});
