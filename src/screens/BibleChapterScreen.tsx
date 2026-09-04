import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../utils/colors';
import { BIBLE_BOOKS, BOOK_ABBR } from '../data/bibleBooks';
import { BibleStackParamList } from '../types';
import { useBibleProgress } from '../hooks/useBibleProgress';
import { useLanguage } from '../context/LanguageContext';

const FONT_SIZE_KEY = '@grace_bible_fontsize';
const BOOKMARKS_KEY = '@grace_bible_bookmarks';

// ── 오프라인 성경 데이터 ──────────────────────────────────────────────────────
import gaeyeokData   from '../../bible.json';           // 개역개정  (키: 창1:1)
import newRevData    from '../../new_rev_flat.json';    // 새번역    (키: 1:1:1)
import easyKorData   from '../../easy_korean_flat.json';// 쉬운성경  (키: 1:1:1)
import modernData    from '../../modern_flat.json';     // 현대인성경(키: 1:1:1)
import nivData       from '../../niv_flat.json';        // NIV       (키: 1:1:1)
import esvData       from '../../esv_flat.json';        // ESV       (키: 1:1:1)
import nkjvData      from '../../nkjv_flat.json';       // NKJV      (키: 1:1:1)
import rvData        from '../../rv_flat.json';         // Reina-Valera (키: 1:1:1)

type FlatBible = Record<string, string>;

const GAEYEOK: FlatBible  = gaeyeokData  as FlatBible;
const NEW_REV: FlatBible  = newRevData   as FlatBible;
const EASY_KOR: FlatBible = easyKorData  as FlatBible;
const MODERN: FlatBible   = modernData   as FlatBible;
const NIV: FlatBible      = nivData      as FlatBible;
const ESV: FlatBible      = esvData      as FlatBible;
const NKJV: FlatBible     = nkjvData     as FlatBible;
const RV: FlatBible       = rvData       as FlatBible;

type Props = NativeStackScreenProps<BibleStackParamList, 'BibleChapter'>;

interface Verse {
  verse: number;
  text: string;
}

// ── 번역본 정의 ───────────────────────────────────────────────────────────────
type TransLang = 'ko' | 'en' | 'es';

interface Translation {
  id: string;
  label: string;
  lang: TransLang;
  data: FlatBible;
  keyStyle: 'abbr' | 'numeric'; // abbr = 창1:1, numeric = 1:1:1
}

const TRANSLATIONS: Translation[] = [
  // 한국어
  { id: 'gaeyeok',  label: '개역개정',    lang: 'ko', data: GAEYEOK,  keyStyle: 'abbr'    },
  { id: 'new_rev',  label: '새번역',      lang: 'ko', data: NEW_REV,  keyStyle: 'numeric' },
  { id: 'easy_kor', label: '쉬운성경',    lang: 'ko', data: EASY_KOR, keyStyle: 'numeric' },
  { id: 'modern',   label: '현대인성경',  lang: 'ko', data: MODERN,   keyStyle: 'numeric' },
  // 영어
  { id: 'niv',      label: 'NIV',         lang: 'en', data: NIV,      keyStyle: 'numeric' },
  { id: 'esv',      label: 'ESV',         lang: 'en', data: ESV,      keyStyle: 'numeric' },
  { id: 'nkjv',     label: 'NKJV',        lang: 'en', data: NKJV,     keyStyle: 'numeric' },
  // 스페인어
  { id: 'rv',       label: 'Reina-Valera', lang: 'es', data: RV,       keyStyle: 'numeric' },
];


// ── UI 문자열 ─────────────────────────────────────────────────────────────────
const UI: Record<string, Record<string, string>> = {
  markRead:   { ko: '읽음으로 표시',      en: 'Mark as Read',   es: 'Marcar leído' },
  markUnread: { ko: '읽지 않음으로 표시', en: 'Mark as Unread', es: 'Desmarcar'    },
  chapter:    { ko: '장',                 en: 'Chapter',        es: 'Capítulo'     },
  prev:       { ko: '이전',              en: 'Prev',           es: 'Ant.'         },
  next:       { ko: '다음',              en: 'Next',           es: 'Sig.'         },
  playAll:    { ko: '전체 듣기',          en: 'Play All',       es: 'Reproducir'   },
  stop:       { ko: '정지',              en: 'Stop',           es: 'Detener'      },
};

// TTS 언어 코드 매핑
const TTS_LANG: Record<TransLang, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  es: 'es-ES',
};

function lu(key: string, lang: string) {
  return UI[key]?.[lang] ?? UI[key]?.['ko'] ?? '';
}

// ── 오프라인 데이터 로드 ──────────────────────────────────────────────────────
function loadChapter(translation: Translation, bookNum: number, chapter: number): Verse[] {
  const verses: Verse[] = [];

  if (translation.keyStyle === 'abbr') {
    // 개역개정: 창1:1 형식
    const abbr = BOOK_ABBR[bookNum];
    if (!abbr) return [];
    const prefix = `${abbr}${chapter}:`;
    for (const key of Object.keys(translation.data)) {
      if (key.startsWith(prefix)) {
        const verseNum = parseInt(key.slice(prefix.length), 10);
        if (!isNaN(verseNum)) {
          verses.push({ verse: verseNum, text: (translation.data[key] ?? '').trim() });
        }
      }
    }
  } else {
    // 나머지: 책번호:장:절 형식
    const prefix = `${bookNum}:${chapter}:`;
    for (const key of Object.keys(translation.data)) {
      if (key.startsWith(prefix)) {
        const verseNum = parseInt(key.slice(prefix.length), 10);
        if (!isNaN(verseNum)) {
          verses.push({ verse: verseNum, text: (translation.data[key] ?? '').trim() });
        }
      }
    }
  }

  verses.sort((a, b) => a.verse - b.verse);
  return verses;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function BibleChapterScreen({ navigation, route }: Props) {
  const { bookNum, chapter, translationId } = route.params;
  const { lang: appLang } = useLanguage();
  const { isRead, toggleRead } = useBibleProgress();

  const [selectedId, setSelectedId] = useState<string>(translationId ?? 'gaeyeok');
  const [speakingVerse, setSpeakingVerse] = useState<number | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const playingAllRef = useRef(false);
  const verseLayoutsRef = useRef<Record<number, number>>({});
  const scrollRef = useRef<ScrollView>(null);
  const transScrollRef = useRef<ScrollView>(null);

  // ── 글자 크기, 북마크, 검색 ─────────────────────────────────────────────────
  const [fontSize, setFontSize] = useState(17);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(FONT_SIZE_KEY)
      .then(v => { if (v) setFontSize(Number(v)); })
      .catch(() => {});
    AsyncStorage.getItem(BOOKMARKS_KEY)
      .then(v => { if (v) setBookmarks(new Set(JSON.parse(v))); })
      .catch(() => {});
  }, []);

  function changeFontSize(delta: number) {
    const next = Math.max(12, Math.min(28, fontSize + delta));
    setFontSize(next);
    AsyncStorage.setItem(FONT_SIZE_KEY, String(next));
  }

  function toggleBookmark(verseNum: number) {
    const key = `${bookNum}:${chapter}:${verseNum}`;
    const next = new Set(bookmarks);
    if (next.has(key)) next.delete(key); else next.add(key);
    setBookmarks(next);
    AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...next]));
  }

  function isBookmarked(verseNum: number) {
    return bookmarks.has(`${bookNum}:${chapter}:${verseNum}`);
  }

  const translation = TRANSLATIONS.find(t => t.id === selectedId)!;
  const book = BIBLE_BOOKS.find(b => b.num === bookNum)!;
  const bookName = book.name[translation.lang === 'en' ? 'en' : 'ko'];
  const totalChapters = book.chapters;
  const read = isRead(bookNum, chapter);

  const verses = useMemo(
    () => loadChapter(translation, bookNum, chapter),
    [selectedId, bookNum, chapter],
  );

  const displayedVerses = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return verses;
    return verses.filter(v => v.text.toLowerCase().includes(q.toLowerCase()));
  }, [verses, searchQuery]);

  const stopSpeech = useCallback(() => {
    playingAllRef.current = false;
    setIsPlayingAll(false);
    setSpeakingVerse(null);
    Speech.stop();
  }, []);

  // 번역 바뀌거나 챕터 이동 시 TTS 중지
  useEffect(() => {
    stopSpeech();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [bookNum, chapter, selectedId]);

  // 언마운트 시 TTS 중지
  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  // 단일 절 읽기
  const speakVerse = useCallback((verse: Verse) => {
    if (speakingVerse === verse.verse && !isPlayingAll) {
      stopSpeech();
      return;
    }
    stopSpeech();
    setSpeakingVerse(verse.verse);
    Speech.speak(verse.text, {
      language: TTS_LANG[translation.lang],
      rate: 0.9,
      onDone: () => setSpeakingVerse(null),
      onError: () => setSpeakingVerse(null),
      onStopped: () => setSpeakingVerse(null),
    });
  }, [speakingVerse, isPlayingAll, translation.lang, stopSpeech]);

  // 전체 장 순차 읽기
  const playAll = useCallback(async () => {
    if (isPlayingAll) {
      stopSpeech();
      return;
    }
    playingAllRef.current = true;
    setIsPlayingAll(true);

    const speakNext = (index: number) => {
      if (!playingAllRef.current || index >= verses.length) {
        playingAllRef.current = false;
        setIsPlayingAll(false);
        setSpeakingVerse(null);
        return;
      }
      const v = verses[index];
      setSpeakingVerse(v.verse);
      const y = verseLayoutsRef.current[v.verse];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
      }
      Speech.speak(v.text, {
        language: TTS_LANG[translation.lang],
        rate: 0.9,
        onDone: () => speakNext(index + 1),
        onError: () => speakNext(index + 1),
        onStopped: () => {
          if (!playingAllRef.current) {
            setSpeakingVerse(null);
          }
        },
      });
    };

    speakNext(0);
  }, [isPlayingAll, verses, translation.lang, stopSpeech]);

  function goChapter(delta: number) {
    const next = chapter + delta;
    if (next < 1 || next > totalChapters) return;
    navigation.replace('BibleChapter', { bookNum, chapter: next, translationId: selectedId });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerBook} numberOfLines={1}>{bookName}</Text>
            <Text style={styles.headerChapter}>
              {lu('chapter', appLang)} {chapter} / {totalChapters}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={playAll}
              style={[styles.playAllBtn, isPlayingAll && styles.playAllBtnActive]}
              hitSlop={8}
            >
              <Text style={[styles.playAllIcon, isPlayingAll && styles.playAllIconActive]}>
                {isPlayingAll ? '⏹' : '▶'}
              </Text>
              <Text style={[styles.playAllLabel, isPlayingAll && styles.playAllLabelActive]}>
                {isPlayingAll ? lu('stop', appLang) : lu('playAll', appLang)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSearchMode(s => !s); setSearchQuery(''); }}
              style={[styles.iconBtn, searchMode && styles.iconBtnActive]}
              hitSlop={8}
            >
              <Text style={{ fontSize: 16 }}>🔍</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 글자 크기 + 검색 바 */}
        <View style={styles.toolRow}>
          <View style={styles.fontSizeRow}>
            <TouchableOpacity onPress={() => changeFontSize(-1)} style={styles.fontBtn} hitSlop={6}>
              <Text style={styles.fontBtnText}>A−</Text>
            </TouchableOpacity>
            <Text style={styles.fontSizeLabel}>{fontSize}</Text>
            <TouchableOpacity onPress={() => changeFontSize(1)} style={styles.fontBtn} hitSlop={6}>
              <Text style={styles.fontBtnText}>A+</Text>
            </TouchableOpacity>
          </View>
          {searchMode && (
            <TextInput
              style={styles.searchInput}
              placeholder={appLang === 'ko' ? '구절 검색...' : appLang === 'es' ? 'Buscar versículo...' : 'Search verses...'}
              placeholderTextColor={Colors.text.light}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              clearButtonMode="while-editing"
            />
          )}
        </View>

        {/* 번역 선택 탭 */}
        <ScrollView
          ref={transScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.transTabs}
        >
          {TRANSLATIONS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.transTab, selectedId === t.id && styles.transTabActive]}
              onPress={() => setSelectedId(t.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.transTabText, selectedId === t.id && styles.transTabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── 본문 ─────────────────────────────────────────────── */}
      {verses.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {searchMode && searchQuery.trim() !== '' && (
            <Text style={styles.searchResultLabel}>
              {displayedVerses.length}개 결과 ({chapter}장)
            </Text>
          )}
          {displayedVerses.map(v => {
            const isSpeaking = speakingVerse === v.verse;
            const bm = isBookmarked(v.verse);
            return (
              <View
                key={v.verse}
                style={[styles.verseRow, isSpeaking && styles.verseRowHighlight, bm && styles.verseRowBookmarked]}
                onLayout={e => {
                  verseLayoutsRef.current[v.verse] = e.nativeEvent.layout.y;
                }}
              >
                <Text style={styles.verseNum}>{v.verse}</Text>
                <Text style={[styles.verseText, { fontSize, lineHeight: fontSize * 1.75 }, isSpeaking && styles.verseTextHighlight]}>
                  {v.text}
                </Text>
                <View style={styles.verseActions}>
                  <TouchableOpacity onPress={() => toggleBookmark(v.verse)} hitSlop={6}>
                    <Text style={[styles.bookmarkIcon, bm && styles.bookmarkIconActive]}>
                      {bm ? '🔖' : '☆'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => speakVerse(v)} hitSlop={6}>
                    <Text style={[styles.speakIcon, isSpeaking && styles.speakIconActive]}>
                      {isSpeaking ? '🔊' : '🔈'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {displayedVerses.length === 0 && searchQuery.trim() !== '' && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>검색 결과가 없습니다.</Text>
            </View>
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* ── 하단 바 ──────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navBtn, chapter <= 1 && styles.navBtnDisabled]}
          onPress={() => goChapter(-1)}
          disabled={chapter <= 1}
        >
          <Text style={[styles.navBtnText, chapter <= 1 && styles.navBtnTextDisabled]}>
            ‹ {lu('prev', appLang)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.readBtn, read && styles.readBtnDone]}
          onPress={() => toggleRead(bookNum, chapter)}
          activeOpacity={0.8}
        >
          <Text style={[styles.readBtnText, read && styles.readBtnTextDone]}>
            {read ? `✓ ${lu('markUnread', appLang)}` : `○ ${lu('markRead', appLang)}`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, chapter >= totalChapters && styles.navBtnDisabled]}
          onPress={() => goChapter(1)}
          disabled={chapter >= totalChapters}
        >
          <Text style={[styles.navBtnText, chapter >= totalChapters && styles.navBtnTextDisabled]}>
            {lu('next', appLang)} ›
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { width: 36 },
  backText: { fontSize: 28, color: Colors.primary, lineHeight: 30 },

  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    minWidth: 60,
    justifyContent: 'center',
  },
  playAllBtnActive: {
    backgroundColor: Colors.primary,
  },
  playAllIcon: {
    fontSize: 11,
    color: Colors.primary,
  },
  playAllIconActive: {
    color: Colors.white,
  },
  playAllLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  playAllLabelActive: {
    color: Colors.white,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBook: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  headerChapter: { fontSize: 12, color: Colors.text.secondary, marginTop: 1 },

  transTabs: {
    paddingVertical: 8,
    gap: 6,
  },
  transTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  transTabActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  transTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  transTabTextActive: {
    color: Colors.white,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  verseRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
    borderRadius: 8,
    paddingVertical: 2,
    paddingRight: 2,
  },
  verseRowHighlight: {
    backgroundColor: Colors.primary + '18',
  },
  // ── 헤더 툴
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    padding: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
  },
  iconBtnActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fontSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fontBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  fontBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  fontSizeLabel: { fontSize: 12, color: Colors.text.secondary, minWidth: 20, textAlign: 'center' },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 14,
    color: Colors.text.primary, backgroundColor: Colors.background,
  },
  searchResultLabel: {
    fontSize: 12, color: Colors.text.secondary, paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 4,
  },
  noResults: { alignItems: 'center', paddingVertical: 32 },
  noResultsText: { fontSize: 14, color: Colors.text.light },

  // ── 절
  verseNum: {
    width: 30,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.secondary,
    marginTop: Platform.OS === 'ios' ? 3 : 4,
    flexShrink: 0,
  },
  verseText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 30,
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  verseTextHighlight: {
    color: Colors.primary,
    fontWeight: '600',
  },
  verseRowBookmarked: {
    backgroundColor: Colors.secondary + '15',
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  verseActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingTop: Platform.OS === 'ios' ? 5 : 6,
    paddingLeft: 6,
  },
  bookmarkIcon: { fontSize: 15, opacity: 0.4 },
  bookmarkIconActive: { opacity: 1 },
  speakIcon: {
    fontSize: 16,
    opacity: 0.4,
  },
  speakIconActive: {
    opacity: 1,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  navBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  navBtnTextDisabled: { color: Colors.text.light },
  readBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center',
  },
  readBtnDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  readBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  readBtnTextDone: { color: Colors.white },

});
