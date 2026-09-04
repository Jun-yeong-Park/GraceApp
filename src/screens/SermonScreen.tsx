import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Linking,
  Dimensions,
  ScrollView,
  BackHandler,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubeIframe from 'react-native-youtube-iframe';
import { Colors } from '../utils/colors';
import { Sermon } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../i18n/translations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_HEIGHT = Math.round(SCREEN_WIDTH * (9 / 16));

interface SermonItem extends Sermon {
  thumbnail_color: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}

const DUMMY_SERMONS: SermonItem[] = [
  {
    id: '1',
    title: '부활의 능력으로 살아가라',
    titleKey: 'sermon1Title',
    preacher: '김은혜 목사',
    date: '2026-04-12',
    scripture: '요한복음 11:25-26',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: '부활절을 맞이하여 부활의 주님이 우리에게 주시는 능력과 소망에 대해 살펴봅니다.',
    descKey: 'sermon1Desc',
    created_at: '2026-04-12T12:00:00Z',
    thumbnail_color: '#1E3A5F',
  },
  {
    id: '2',
    title: '왕으로 오신 예수님',
    titleKey: 'sermon2Title',
    preacher: '김은혜 목사',
    date: '2026-04-05',
    scripture: '마태복음 21:1-11',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: '종려주일을 맞이하여 나귀를 타고 예루살렘에 입성하시는 예수님의 모습을 통해 진정한 왕의 의미를 생각해 봅니다.',
    descKey: 'sermon2Desc',
    created_at: '2026-04-05T12:00:00Z',
    thumbnail_color: '#2C5282',
  },
  {
    id: '3',
    title: '선하신 목자의 인도하심',
    titleKey: 'sermon3Title',
    preacher: '김은혜 목사',
    date: '2026-03-29',
    scripture: '시편 23:1-6',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: '시편 23편을 통해 선하신 목자이신 하나님의 인도하심과 보호하심을 묵상합니다.',
    descKey: 'sermon3Desc',
    created_at: '2026-03-29T12:00:00Z',
    thumbnail_color: '#1A365D',
  },
  {
    id: '4',
    title: '모든 것이 합력하여 선을 이루느니라',
    titleKey: 'sermon4Title',
    preacher: '김은혜 목사',
    date: '2026-03-22',
    scripture: '로마서 8:28-39',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: '로마서 8장 말씀을 통해 하나님을 사랑하는 자들에게 모든 것이 합력하여 선을 이룬다는 위대한 약속을 살펴봅니다.',
    descKey: 'sermon4Desc',
    created_at: '2026-03-22T12:00:00Z',
    thumbnail_color: '#243B55',
  },
];

function extractVideoId(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : '';
}

export default function SermonScreen() {
  const [selectedSermon, setSelectedSermon] = useState<SermonItem | null>(null);
  const [playing, setPlaying] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const closePlayer = useCallback(() => {
    setPlaying(false);
    setSelectedSermon(null);
  }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedSermon !== null) {
        closePlayer();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [selectedSermon, closePlayer]);

  const openYouTube = (url: string) => Linking.openURL(url);
  const closeButtonTop = Platform.OS === 'ios' ? insets.top + 8 : 12;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('sermonTitle')}</Text>
        <Text style={styles.headerSub}>{t('sermonSubtitle')}</Text>
      </View>

      <FlatList
        data={DUMMY_SERMONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              setSelectedSermon(item);
              setPlaying(false);
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.thumbnail, { backgroundColor: item.thumbnail_color }]}>
              <View style={styles.playCircle}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
              <View style={styles.youtubeBadge}>
                <Text style={styles.youtubeBadgeText}>YouTube</Text>
              </View>
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle} numberOfLines={2}>{t(item.titleKey)}</Text>
              <Text style={styles.itemMeta}>{item.preacher} · {item.date}</Text>
              <Text style={styles.itemScripture}>{item.scripture}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={selectedSermon !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={closePlayer}
        statusBarTranslucent={false}
      >
        <View style={styles.modalRoot}>
          {selectedSermon && (
            <>
              <View style={styles.playerWrapper}>
                <YoutubeIframe
                  height={PLAYER_HEIGHT}
                  width={SCREEN_WIDTH}
                  videoId={extractVideoId(selectedSermon.youtube_url ?? '')}
                  play={playing}
                  onChangeState={(state: string) => {
                    if (state === 'ended') setPlaying(false);
                  }}
                  webViewProps={{
                    allowsFullscreenVideo: false,
                    allowsInlineMediaPlayback: true,
                    mediaPlaybackRequiresUserAction: false,
                  }}
                />

                <TouchableOpacity
                  style={[styles.floatingClose, { top: closeButtonTop }]}
                  onPress={closePlayer}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.8}
                >
                  <View style={styles.floatingCloseInner}>
                    <Text style={styles.floatingCloseText}>✕</Text>
                  </View>
                </TouchableOpacity>

                {!playing && (
                  <Pressable
                    style={styles.playOverlay}
                    onPress={() => setPlaying(true)}
                  >
                    <View style={styles.playOverlayCircle}>
                      <Text style={styles.playOverlayIcon}>▶</Text>
                    </View>
                  </Pressable>
                )}
              </View>

              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.scriptureTag}>
                  <Text style={styles.scriptureTagText}>{selectedSermon.scripture}</Text>
                </View>
                <Text style={styles.detailTitle}>{t(selectedSermon.titleKey)}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>{t('sermonPreacher')}</Text>
                    <Text style={styles.metaValue}>{selectedSermon.preacher}</Text>
                  </View>
                  <View style={styles.metaSep} />
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>{t('sermonDate')}</Text>
                    <Text style={styles.metaValue}>{selectedSermon.date}</Text>
                  </View>
                </View>

                <View style={styles.divider} />
                <Text style={styles.descLabel}>{t('sermonSummary')}</Text>
                <Text style={styles.descText}>{t(selectedSermon.descKey)}</Text>

                <TouchableOpacity
                  style={styles.youtubeButton}
                  onPress={() => openYouTube(selectedSermon.youtube_url ?? '')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.youtubeButtonText}>{t('sermonOpenYoutube')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.bottomClose} onPress={closePlayer}>
                  <Text style={styles.bottomCloseText}>{t('sermonClose')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  thumbnail: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(197,168,79,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: Colors.white,
    fontSize: 14,
    marginLeft: 2,
  },
  youtubeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  youtubeBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  itemContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 5,
    lineHeight: 20,
  },
  itemMeta: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  itemScripture: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: '600',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  playerWrapper: {
    width: SCREEN_WIDTH,
    height: PLAYER_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  floatingClose: {
    position: 'absolute',
    right: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  floatingCloseInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  floatingCloseText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 17,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  playOverlayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(197,168,79,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlayIcon: {
    color: Colors.white,
    fontSize: 26,
    marginLeft: 4,
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    padding: 20,
    paddingBottom: 32,
  },
  scriptureTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDF6E8',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  scriptureTagText: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 14,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaSep: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  descLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  descText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 26,
    marginBottom: 20,
  },
  youtubeButton: {
    flexDirection: 'row',
    backgroundColor: '#FF0000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  youtubeButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  bottomClose: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bottomCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
});
