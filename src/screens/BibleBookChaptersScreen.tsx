import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BibleStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { BIBLE_BOOKS } from '../data/bibleBooks';
import { useBibleProgress } from '../hooks/useBibleProgress';
import { useLanguage } from '../context/LanguageContext';

type Props = NativeStackScreenProps<BibleStackParamList, 'BibleBookChapters'>;

const UI: Record<string, Record<string, string>> = {
  chapter: { ko: '장', en: 'Ch', es: 'Cap' },
  read:    { ko: '읽음', en: 'Read', es: 'Leído' },
  unread:  { ko: '미읽음', en: 'Unread', es: 'No leído' },
};

export default function BibleBookChaptersScreen({ navigation, route }: Props) {
  const { bookNum, translationId } = route.params;
  const { lang } = useLanguage();
  const { isRead } = useBibleProgress();
  const L: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  const book = BIBLE_BOOKS.find(b => b.num === bookNum)!;
  const bookName = book.name[L];
  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);

  const chapterLabel = UI.chapter[L] ?? '장';

  const readCount = chapters.filter(ch => isRead(bookNum, ch)).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{bookName}</Text>
          <Text style={styles.headerSub}>
            {readCount} / {book.chapters} {chapterLabel} {UI.read[L]}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* 장 그리드 */}
      <FlatList
        data={chapters}
        keyExtractor={item => String(item)}
        numColumns={5}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const done = isRead(bookNum, item);
          return (
            <TouchableOpacity
              style={[styles.chapterBtn, done && styles.chapterBtnDone]}
              activeOpacity={0.75}
              onPress={() =>
                navigation.navigate('BibleChapter', { bookNum, chapter: item, translationId })
              }
            >
              <Text style={[styles.chapterNum, done && styles.chapterNumDone]}>
                {item}
              </Text>
              {done && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backBtn: { width: 36 },
  backText: { fontSize: 28, color: Colors.primary, lineHeight: 30 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  headerSub: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },

  grid: {
    padding: 16,
    gap: 10,
  },
  chapterBtn: {
    flex: 1,
    margin: 5,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chapterBtnDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chapterNum: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  chapterNumDone: {
    color: Colors.white,
    fontSize: 13,
  },
  checkMark: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
});
