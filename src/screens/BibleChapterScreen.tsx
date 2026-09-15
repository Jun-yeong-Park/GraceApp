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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../utils/colors';
import { BIBLE_BOOKS, BOOK_ABBR } from '../data/bibleBooks';
import { BibleStackParamList } from '../types';
import { useBibleProgress } from '../hooks/useBibleProgress';
import { useLanguage } from '../context/LanguageContext';

const FONT_SIZE_KEY = '@grace_bible_fontsize';
const BOOKMARKS_KEY = '@grace_bible_bookmarks';
const TTS_RATE_KEY  = '@grace_bible_tts_rate';
const TTS_VOICE_KEY = '@grace_bible_tts_voice_'; // + 언어코드 (ko/en/es)
const TTS_RATES = [0.75, 0.9, 1.0, 1.25, 1.5];

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
  voice:      { ko: '목소리',             en: 'Voice',          es: 'Voz'          },
  voiceTitle: { ko: '읽어주는 목소리',     en: 'Reading Voice',  es: 'Voz de lectura' },
  speed:      { ko: '속도',               en: 'Speed',          es: 'Velocidad'    },
  systemDefault: { ko: '기기 기본 목소리', en: 'Device default voice', es: 'Voz predeterminada' },
  enhanced:   { ko: '고품질',             en: 'Enhanced',       es: 'Mejorada'     },
  moreVoices: { ko: '더 많은 목소리는 iOS 설정 → 손쉬운 사용 → 콘텐츠 말하기 → 음성에서 내려받을 수 있습니다.',
                en: 'Download more voices in iOS Settings → Accessibility → Spoken Content → Voices.',
                es: 'Descarga más voces en Ajustes → Accesibilidad → Contenido hablado → Voces.' },
  preview:    { ko: '미리 듣기',          en: 'Preview',        es: 'Escuchar'     },
  done:       { ko: '완료',               en: 'Done',           es: 'Listo'        },
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

  // ── TTS 속도 · 목소리 ───────────────────────────────────────────────────────
  const [ttsRate, setTtsRate] = useState(0.9);
  const [voiceModal, setVoiceModal] = useState(false);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  // 언어별 선택 목소리 identifier (없으면 기기 기본)
  const [voiceByLang, setVoiceByLang] = useState<Record<string, string | undefined>>({});
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(FONT_SIZE_KEY)
      .then(v => { if (v) setFontSize(Number(v)); })
      .catch(() => {});
    AsyncStorage.getItem(BOOKMARKS_KEY)
      .then(v => { if (v) setBookmarks(new Set(JSON.parse(v))); })
      .catch(() => {});
    AsyncStorage.getItem(TTS_RATE_KEY)
      .then(v => { const n = Number(v); if (v && TTS_RATES.includes(n)) setTtsRate(n); })
      .catch(() => {});
    Promise.all((['ko', 'en', 'es'] as const).map(l => AsyncStorage.getItem(TTS_VOICE_KEY + l)))
      .then(([ko, en, es]) => setVoiceByLang({ ko: ko ?? undefined, en: en ?? undefined, es: es ?? undefined }))
      .catch(() => {});
    Speech.getAvailableVoicesAsync().then(setVoices).catch(() => {});
  }, []);

  function cycleRate() {
    const next = TTS_RATES[(TTS_RATES.indexOf(ttsRate) + 1) % TTS_RATES.length];
    setTtsRate(next);
    AsyncStorage.setItem(TTS_RATE_KEY, String(next));
  }

  function selectVoice(langCode: string, identifier: string | undefined) {
    setVoiceByLang(prev => ({ ...prev, [langCode]: identifier }));
    if (identifier) AsyncStorage.setItem(TTS_VOICE_KEY + langCode, identifier);
    else AsyncStorage.removeItem(TTS_VOICE_KEY + langCode);
  }

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

  // expo-speech 는 기본(ambient) 오디오 세션을 쓰기 때문에 iOS 무음 스위치가
  // 켜져 있으면 소리가 전혀 나지 않는다. 읽기 시작 전에 재생(playback) 세션으로
  // 바꿔 무음 모드에서도 들리게 한다. 실패해도 읽기는 그대로 진행.
  async function prepareAudioSession() {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
    } catch { /* ignore */ }
  }

  // 단일 절 읽기
  const speakVerse = useCallback(async (verse: Verse) => {
    if (speakingVerse === verse.verse && !isPlayingAll) {
      stopSpeech();
      return;
    }
    stopSpeech();
    await prepareAudioSession();
    setSpeakingVerse(verse.verse);
    Speech.speak(verse.text, {
      language: TTS_LANG[translation.lang],
      voice: voiceByLang[translation.lang],
      rate: ttsRate,
      onDone: () => setSpeakingVerse(null),
      onError: () => setSpeakingVerse(null),
      onStopped: () => setSpeakingVerse(null),
    });
  }, [speakingVerse, isPlayingAll, translation.lang, stopSpeech, ttsRate, voiceByLang]);

  // 전체 장 순차 읽기
  const playAll = useCallback(async () => {
    if (isPlayingAll) {
      stopSpeech();
      return;
    }
    await prepareAudioSession();
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
        voice: voiceByLang[translation.lang],
        rate: ttsRate,
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
  }, [isPlayingAll, verses, translation.lang, stopSpeech, ttsRate, voiceByLang]);

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
            <TouchableOpacity onPress={cycleRate} style={[styles.fontBtn, { marginLeft: 6 }]} hitSlop={6}>
              <Text style={styles.fontBtnText}>{ttsRate}×</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setVoiceModal(true)} style={styles.fontBtn} hitSlop={6}>
              <Text style={styles.fontBtnText}>🔊 {lu('voice', appLang)}</Text>
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

      {/* ── 목소리 · 속도 선택 모달 ── */}
      <Modal visible={voiceModal} animationType="slide" transparent onRequestClose={() => setVoiceModal(false)}>
        <View style={styles.voiceOverlay}>
          <View style={styles.voiceSheet}>
            <View style={styles.voiceHeader}>
              <Text style={styles.voiceTitle}>{lu('voiceTitle', appLang)}</Text>
              <TouchableOpacity onPress={() => { Speech.stop(); setVoiceModal(false); }} hitSlop={8}>
                <Text style={styles.voiceDone}>{lu('done', appLang)}</Text>
              </TouchableOpacity>
            </View>

            {/* 속도 */}
            <Text style={styles.voiceSection}>{lu('speed', appLang)}</Text>
            <View style={styles.rateRow}>
              {TTS_RATES.map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => { setTtsRate(r); AsyncStorage.setItem(TTS_RATE_KEY, String(r)); }}
                  style={[styles.rateChip, ttsRate === r && styles.rateChipActive]}
                >
                  <Text style={[styles.rateChipText, ttsRate === r && styles.rateChipTextActive]}>{r}×</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 목소리 — 현재 번역본 언어에 맞는 것만 */}
            <Text style={styles.voiceSection}>
              {lu('voice', appLang)} · {translation.label}
            </Text>
            {(() => {
              const langCode = translation.lang;
              const list = voices
                .filter(v => (v.language ?? '').toLowerCase().startsWith(langCode))
                .sort((a, b) => (a.quality === 'Enhanced' ? -1 : 1) - (b.quality === 'Enhanced' ? -1 : 1) || a.name.localeCompare(b.name));
              const selected = voiceByLang[langCode];
              const sample = verses[0]?.text.slice(0, 60) ?? 'Hello';
              const preview = (id?: string) => {
                Speech.stop();
                Speech.speak(sample, { language: TTS_LANG[langCode], voice: id, rate: ttsRate });
              };
              const row = (id: string | undefined, name: string, sub?: string) => (
                <TouchableOpacity
                  key={id ?? '__default'}
                  style={[styles.voiceRow, selected === id && styles.voiceRowActive]}
                  onPress={() => { selectVoice(langCode, id); preview(id); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.voiceName, selected === id && styles.voiceNameActive]}>{name}</Text>
                    {sub ? <Text style={styles.voiceSub}>{sub}</Text> : null}
                  </View>
                  <Text style={styles.voiceCheck}>{selected === id ? '✓' : ''}</Text>
                </TouchableOpacity>
              );
              return (
                <FlatList
                  data={list}
                  keyExtractor={v => v.identifier}
                  style={{ maxHeight: 320 }}
                  ListHeaderComponent={row(undefined, lu('systemDefault', appLang))}
                  renderItem={({ item }) => row(
                    item.identifier,
                    item.name,
                    [item.quality === 'Enhanced' ? lu('enhanced', appLang) : null, item.language].filter(Boolean).join(' · '),
                  )}
                  ListFooterComponent={<Text style={styles.voiceHint}>{lu('moreVoices', appLang)}</Text>}
                />
              );
            })()}
          </View>
        </View>
      </Modal>

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

  // 목소리·속도 모달
  voiceOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  voiceSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  voiceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  voiceTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  voiceDone: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  voiceSection: { fontSize: 12, fontWeight: '700', color: Colors.text.secondary, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  rateRow: { flexDirection: 'row', gap: 8 },
  rateChip: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.background },
  rateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rateChipText: { fontSize: 13, fontWeight: '700', color: Colors.text.secondary },
  rateChipTextActive: { color: Colors.white },
  voiceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  voiceRowActive: { backgroundColor: Colors.primary + '12' },
  voiceName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  voiceNameActive: { color: Colors.primary },
  voiceSub: { fontSize: 12, color: Colors.text.light, marginTop: 2 },
  voiceCheck: { fontSize: 16, fontWeight: '800', color: Colors.primary, width: 20, textAlign: 'right' },
  voiceHint: { fontSize: 12, color: Colors.text.light, lineHeight: 17, marginTop: 10, paddingHorizontal: 4 },
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
