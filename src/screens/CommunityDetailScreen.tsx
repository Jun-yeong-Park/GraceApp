import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  FlatList,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray } from 'base64-js';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CommunityTabStackParamList, CommunityPost, CommunityPhoto } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { COMMUNITIES, getCommunityName, CommunityItem } from './CommunityScreen';
import { checkContentFilter, fetchBlockedIds, fetchHiddenContentIds, showModerationMenu } from '../utils/moderation';

type Props = NativeStackScreenProps<CommunityTabStackParamList, 'CommunityDetail'>;
type Tab = 'posts' | 'photos';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = Math.floor((SCREEN_WIDTH - 4) / 3); // 3열 그리드

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return lang === 'en' ? `${days}d ago` : lang === 'es' ? `hace ${days}d` : `${days}일 전`;
  if (hours > 0) return lang === 'en' ? `${hours}h ago` : lang === 'es' ? `hace ${hours}h` : `${hours}시간 전`;
  if (mins > 0) return lang === 'en' ? `${mins}m ago` : lang === 'es' ? `hace ${mins}m` : `${mins}분 전`;
  return lang === 'en' ? 'Just now' : lang === 'es' ? 'Ahora' : '방금 전';
}

async function uploadPhoto(uri: string, bucket: string, folder: string): Promise<string | null> {
  try {
    const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().replace(/\?.*$/, '');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const mimeType = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const bytes = toByteArray(base64);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (error) { return null; }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl ?? null;
  } catch {
    return null;
  }
}

const UI = {
  tabPosts:   { ko: '게시물',     en: 'Posts',    es: 'Publicaciones' },
  tabPhotos:  { ko: '사진 게시판', en: 'Photos',   es: 'Fotos'         },
  uploadPhoto:{ ko: '사진 올리기', en: 'Add Photo', es: 'Subir Foto'   },
  caption:    { ko: '내용 (선택)', en: 'Caption (optional)', es: 'Descripción (opcional)' },
  noPhotos:   { ko: '아직 사진이 없어요.\n모임 사진을 올려보세요!', en: 'No photos yet.\nShare your gathering photos!', es: '¡Aún no hay fotos.\nComparte las fotos de tu reunión!' },
  loginRequired: { ko: '로그인 후 사진을 올릴 수 있습니다.', en: 'Sign in to upload photos.', es: 'Inicia sesión para subir fotos.' },
  deletePhoto:   { ko: '이 사진을 삭제하시겠습니까?', en: 'Delete this photo?', es: '¿Eliminar esta foto?' },
};

function lu(key: keyof typeof UI, lang: string): string {
  const l: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
  return UI[key][l];
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function CommunityDetailScreen({ navigation, route }: Props) {
  const { communityId } = route.params;
  const { t, lang } = useLanguage();
  const { user, displayName } = useAuth();

  const community = COMMUNITIES.find((c) => c.id === communityId) as CommunityItem;
  const communityColor = community?.color ?? Colors.primary;

  // 탭
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  // 게시물 상태
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshingPosts, setRefreshingPosts] = useState(false);

  // 사진 상태
  const [photos, setPhotos] = useState<CommunityPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [refreshingPhotos, setRefreshingPhotos] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<CommunityPhoto | null>(null);

  // 게시물 모달
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // 사진 업로드 모달
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedPhotoUris, setSelectedPhotoUris] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [photoAuthorName, setPhotoAuthorName] = useState('');

  // 차단된 유저 · 숨김 처리된 콘텐츠 목록 (App Store 1.2 — 차단 시 즉시 피드에서 제거)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const reloadBlocked = useCallback(async () => {
    if (!user) { setBlockedIds(new Set()); return; }
    const s = await fetchBlockedIds(user.id);
    setBlockedIds(s);
  }, [user]);
  const reloadHidden = useCallback(async () => {
    setHiddenIds(await fetchHiddenContentIds());
  }, []);
  useEffect(() => { reloadBlocked(); }, [reloadBlocked]);
  useEffect(() => { reloadHidden(); }, [reloadHidden]);

  const lng: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  // ── 데이터 로드 ──────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setPosts(data as CommunityPost[]);
        if (data.length > 0) {
          const ids = (data as any[]).map((p) => p.id);
          const { data: cData } = await supabase
            .from('post_comments')
            .select('post_id')
            .in('post_id', ids);
          if (cData) {
            const counts: Record<string, number> = {};
            (cData as any[]).forEach((r) => { counts[r.post_id] = (counts[r.post_id] ?? 0) + 1; });
            setCommentCounts(counts);
          }
        }
      }
    } catch {
      const msg = lng === 'ko' ? '모임을 불러오지 못했습니다.'
        : lng === 'es' ? 'No se pudieron cargar las reuniones.'
        : 'Failed to load gatherings.';
      Alert.alert('', msg);
    }
    setLoadingPosts(false);
    setRefreshingPosts(false);
  }, [communityId, lng]);

  const fetchPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const { data, error } = await supabase
        .from('community_photos')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setPhotos(data as CommunityPhoto[]);
    } catch {
      const msg = lng === 'ko' ? '사진을 불러오지 못했습니다.'
        : lng === 'es' ? 'No se pudieron cargar las fotos.'
        : 'Failed to load photos.';
      Alert.alert('', msg);
    }
    setLoadingPhotos(false);
    setRefreshingPhotos(false);
  }, [communityId, lng]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { if (activeTab === 'photos') fetchPhotos(); }, [activeTab, fetchPhotos]);

  // ── 게시물 모달 ───────────────────────────────────────────────────────────────
  function openPostModal() {
    if (!user) { Alert.alert('', t('communityLoginRequired')); return; }
    setAuthorName(displayName ?? '');
    setTitle(''); setEventDate(null); setLocation(''); setDescription(''); setSelectedImages([]);
    setPostModalVisible(true);
  }

  async function pickPostImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('', t('permissionRequired')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.8 });
    if (!result.canceled) setSelectedImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
  }

  async function submitPost() {
    if (!title.trim()) { Alert.alert('', t('communityTitleError')); return; }
    if (!authorName.trim()) { Alert.alert('', t('communityAuthorError')); return; }
    // 날짜는 선택사항. picker 로 선택된 경우에만 YYYY-MM-DD 로 저장
    const normalizedDate: string | null = eventDate
      ? `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`
      : null;
    // 부적절 표현 차단 (제목 + 내용 + 장소)
    if (checkContentFilter(`${title} ${description} ${location}`, lng)) return;
    setSubmittingPost(true);
    let photoUrls: string[] = [];
    if (selectedImages.length > 0) {
      const results = await Promise.all(selectedImages.map((uri) => uploadPhoto(uri, 'community-photos', communityId)));
      photoUrls = results.filter((u): u is string => u !== null);
    }
    const { error } = await supabase.from('community_posts').insert({
      community_id: communityId, title: title.trim(),
      location: location.trim() || null, event_date: normalizedDate,
      description: description.trim() || null,
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
      author_id: user?.id ?? null, author_name: authorName.trim(),
    });
    setSubmittingPost(false);
    if (error) {
      const msg = lng === 'ko' ? '모임 등록에 실패했습니다. 다시 시도해 주세요.'
        : lng === 'es' ? 'No se pudo publicar la reunión. Intenta de nuevo.'
        : 'Failed to post gathering. Please try again.';
      Alert.alert('', msg);
    }
    else { setPostModalVisible(false); setSelectedImages([]); fetchPosts(); }
  }

  function handleDeletePost(post: CommunityPost) {
    Alert.alert('', t('communityDeleteConfirm'), [
      { text: t('cancelBtn'), style: 'cancel' },
      {
        text: t('communityDeleteBtn'), style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('community_posts').delete().eq('id', post.id);
          if (error) {
            const msg = lng === 'ko' ? '삭제에 실패했습니다.'
              : lng === 'es' ? 'No se pudo eliminar.'
              : 'Failed to delete.';
            Alert.alert('', msg);
            return;
          }
          fetchPosts();
        },
      },
    ]);
  }

  // ── 사진 게시판 ──────────────────────────────────────────────────────────────
  function openPhotoModal() {
    if (!user) { Alert.alert('', lu('loginRequired', lang)); return; }
    setPhotoAuthorName(displayName ?? user.email?.split('@')[0] ?? '');
    setSelectedPhotoUris([]); setCaption('');
    setPhotoModalVisible(true);
  }

  async function pickBoardPhotos() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('', t('permissionRequired')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      setSelectedPhotoUris(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 10));
    }
  }

  async function submitPhoto() {
    if (selectedPhotoUris.length === 0) { Alert.alert('', t('photoSelectError')); return; }
    if (!photoAuthorName.trim()) { Alert.alert('', t('communityAuthorError')); return; }
    if (checkContentFilter(caption, lng)) return;
    setUploadingPhoto(true);
    const urls = await Promise.all(
      selectedPhotoUris.map(uri => uploadPhoto(uri, 'community-photos', `${communityId}/board`))
    );
    const validUrls = urls.filter((u): u is string => u !== null);
    if (validUrls.length === 0) {
      Alert.alert(t('uploadFailedTitle'), t('uploadFailedMsg'));
      setUploadingPhoto(false);
      return;
    }
    const rows = validUrls.map(url => ({
      community_id: communityId,
      author_id: user?.id ?? null,
      author_name: photoAuthorName.trim(),
      photo_url: url,
      caption: caption.trim() || null,
    }));
    const { error } = await supabase.from('community_photos').insert(rows);
    setUploadingPhoto(false);
    if (error) {
      const msg = lng === 'ko' ? '사진 업로드에 실패했습니다.'
        : lng === 'es' ? 'No se pudo subir la foto.'
        : 'Failed to upload photo.';
      Alert.alert('', msg);
    }
    else { setPhotoModalVisible(false); fetchPhotos(); }
  }

  function handleDeletePhoto(photo: CommunityPhoto) {
    Alert.alert('', lu('deletePhoto', lang), [
      { text: t('cancelBtn'), style: 'cancel' },
      {
        text: t('deleteLabel'), style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('community_photos').delete().eq('id', photo.id);
          if (error) {
            const msg = lng === 'ko' ? '삭제에 실패했습니다.'
              : lng === 'es' ? 'No se pudo eliminar.'
              : 'Failed to delete.';
            Alert.alert('', msg);
            return;
          }
          setFullScreenPhoto(null);
          setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        },
      },
    ]);
  }

  // ── 렌더링 ────────────────────────────────────────────────────────────────────
  if (!community) return null;

  // 차단된 유저 · 숨김 처리된 콘텐츠 제외 (App Store 1.2)
  const visiblePosts  = posts.filter(
    (p) => !(p.author_id && blockedIds.has(p.author_id)) && !hiddenIds.has(p.id)
  );
  const visiblePhotos = photos.filter(
    (p) => !(p.author_id && blockedIds.has(p.author_id)) && !hiddenIds.has(p.id)
  );

  function onPressAdd() {
    if (activeTab === 'posts') openPostModal();
    else openPhotoModal();
  }

  function openModerationForPost(post: CommunityPost) {
    if (!user) { Alert.alert('', t('communityLoginRequired')); return; }
    if (post.author_id === user.id) return; // 본인 게시물은 관리 메뉴 미표시
    showModerationMenu({
      lang: lng,
      reporterId: user.id,
      targetUserId: post.author_id ?? null,
      targetUserName: post.author_name,
      contentType: 'post',
      contentId: post.id,
      onBlocked: () => reloadBlocked(),
      onHidden: () => reloadHidden(),
    });
  }

  function openModerationForPhoto(photo: CommunityPhoto) {
    if (!user) { Alert.alert('', t('communityLoginRequired')); return; }
    if (photo.author_id === user.id) return; // 본인 사진은 관리 메뉴 미표시
    showModerationMenu({
      lang: lng,
      reporterId: user.id,
      targetUserId: photo.author_id,
      targetUserName: photo.author_name,
      contentType: 'photo',
      contentId: photo.id,
      onBlocked: () => { reloadBlocked(); setFullScreenPhoto(null); },
      onHidden: () => { reloadHidden(); setFullScreenPhoto(null); },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 헤더 ── */}
      <View style={[styles.header, { backgroundColor: communityColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{community.emoji}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{getCommunityName(community, lang)}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('CommunityChat', { communityId })} hitSlop={6}>
            <Text style={styles.iconBtnText}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onPressAdd} hitSlop={6}>
            <Text style={styles.iconBtnPlus}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 탭 바 ── */}
      <View style={styles.tabBar}>
        {(['posts', 'photos'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && { color: communityColor }]}>
              {tab === 'posts' ? lu('tabPosts', lang) : lu('tabPhotos', lang)}
            </Text>
            {activeTab === tab && <View style={[styles.tabIndicator, { backgroundColor: communityColor }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 게시물 탭 ── */}
      {activeTab === 'posts' && (
        loadingPosts ? <ActivityIndicator color={communityColor} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={visiblePosts}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshingPosts} onRefresh={() => { setRefreshingPosts(true); fetchPosts(); }} tintColor={communityColor} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>{community.emoji}</Text>
                <Text style={styles.emptyTitle}>{t('communityEmpty')}</Text>
                <Text style={styles.emptySub}>{t('communityEmptySub')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                lang={lang}
                userId={user?.id}
                commentCount={commentCounts[item.id] ?? 0}
                communityColor={communityColor}
                onPress={() => navigation.navigate('CommunityPostDetail', { post: item, communityId })}
                onDelete={() => handleDeletePost(item)}
                onReport={() => openModerationForPost(item)}
              />
            )}
          />
        )
      )}

      {/* ── 사진 게시판 탭 ── */}
      {activeTab === 'photos' && (
        loadingPhotos ? <ActivityIndicator color={communityColor} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={visiblePhotos}
            keyExtractor={(item) => item.id}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.photoGrid}
            refreshControl={<RefreshControl refreshing={refreshingPhotos} onRefresh={() => { setRefreshingPhotos(true); fetchPhotos(); }} tintColor={communityColor} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📷</Text>
                <Text style={styles.emptyTitle}>{lu('noPhotos', lang).split('\n')[0]}</Text>
                <Text style={styles.emptySub}>{lu('noPhotos', lang).split('\n')[1]}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.gridItem}
                onPress={() => setFullScreenPhoto(item)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: item.photo_url }} style={styles.gridPhoto} />
                <View style={styles.gridAuthorBadge}>
                  <Text style={styles.gridAuthorText} numberOfLines={1}>{item.author_name}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      )}

      {/* ── 게시물 올리기 모달 ── */}
      <Modal visible={postModalVisible} animationType="slide" transparent onRequestClose={() => setPostModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('communityAddPost')}</Text>
              <TouchableOpacity onPress={() => setPostModalVisible(false)} hitSlop={8}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t('communityPostAuthor')} *</Text>
              <TextInput style={styles.input} placeholder={t('communityPostAuthorPlaceholder')} placeholderTextColor={Colors.text.light} value={authorName} onChangeText={setAuthorName} />
              <Text style={styles.fieldLabel}>{t('communityPostTitle')} *</Text>
              <TextInput style={styles.input} placeholder={t('communityPostTitlePlaceholder')} placeholderTextColor={Colors.text.light} value={title} onChangeText={setTitle} />
              <Text style={styles.fieldLabel}>{t('communityPostDate')}</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[styles.dateBtn, eventDate && { borderColor: communityColor }]}
                  onPress={() => setDatePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateBtnIcon}>📅</Text>
                  <Text style={[styles.dateBtnText, !eventDate && styles.dateBtnPlaceholder]}>
                    {eventDate
                      ? eventDate.toLocaleDateString(
                          lng === 'ko' ? 'ko-KR' : lng === 'es' ? 'es-ES' : 'en-US',
                          { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }
                        )
                      : (lng === 'ko' ? '날짜 선택 (선택사항)' : lng === 'es' ? 'Seleccionar fecha (opcional)' : 'Pick a date (optional)')}
                  </Text>
                </TouchableOpacity>
                {eventDate && (
                  <TouchableOpacity style={styles.dateClearBtn} onPress={() => setEventDate(null)} hitSlop={8}>
                    <Text style={styles.dateClearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {datePickerVisible && (
                <DateTimePicker
                  value={eventDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event: DateTimePickerEvent, selected?: Date) => {
                    // Android: dismiss on any event; iOS inline: keep open until user taps done outside
                    if (Platform.OS !== 'ios') setDatePickerVisible(false);
                    if (event.type === 'set' && selected) setEventDate(selected);
                    else if (event.type === 'dismissed') setDatePickerVisible(false);
                  }}
                />
              )}
              {Platform.OS === 'ios' && datePickerVisible && (
                <TouchableOpacity
                  style={[styles.dateDoneBtn, { backgroundColor: communityColor }]}
                  onPress={() => setDatePickerVisible(false)}
                >
                  <Text style={styles.dateDoneBtnText}>
                    {lng === 'ko' ? '완료' : lng === 'es' ? 'Listo' : 'Done'}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.fieldLabel}>{t('communityPostLocation')}</Text>
              <TextInput style={styles.input} placeholder={t('communityPostLocationPlaceholder')} placeholderTextColor={Colors.text.light} value={location} onChangeText={setLocation} />
              <Text style={styles.fieldLabel}>{t('communityPostDesc')}</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder={t('communityPostDescPlaceholder')} placeholderTextColor={Colors.text.light} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />
              <Text style={styles.fieldLabel}>{t('communityPostPhotos')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {selectedImages.map((uri) => (
                  <View key={uri} style={styles.photoThumb}>
                    <Image source={{ uri }} style={styles.photoThumbImg} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => setSelectedImages((p) => p.filter((u) => u !== uri))}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {selectedImages.length < 5 && (
                  <TouchableOpacity style={styles.photoAddBtn} onPress={pickPostImages}>
                    <Text style={styles.photoAddIcon}>+</Text>
                    <Text style={styles.photoAddLabel}>{selectedImages.length}/5</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: communityColor }, (!title.trim() || !authorName.trim() || submittingPost) && styles.submitBtnDisabled]}
                onPress={submitPost} disabled={!title.trim() || !authorName.trim() || submittingPost}
              >
                {submittingPost ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>{t('communityPostSubmit')}</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 사진 업로드 모달 ── */}
      <Modal visible={photoModalVisible} animationType="slide" transparent onRequestClose={() => setPhotoModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{lu('uploadPhoto', lang)}</Text>
              <TouchableOpacity onPress={() => setPhotoModalVisible(false)} hitSlop={8}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* 이름 */}
              <Text style={styles.fieldLabel}>{lang === 'es' ? 'Nombre *' : lang === 'ko' ? '이름 *' : 'Name *'}</Text>
              <TextInput style={styles.input} value={photoAuthorName} onChangeText={setPhotoAuthorName} placeholderTextColor={Colors.text.light} placeholder={lang === 'es' ? 'Nombre' : lang === 'ko' ? '이름' : 'Name'} />

              {/* 사진 선택 (다중) */}
              <Text style={styles.fieldLabel}>
                {lang === 'ko' ? `사진 * (최대 10장, ${selectedPhotoUris.length}/10)` : `Photos * (max 10, ${selectedPhotoUris.length}/10)`}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {selectedPhotoUris.map((uri, idx) => (
                  <View key={uri + idx} style={styles.photoThumb}>
                    <Image source={{ uri }} style={styles.photoThumbImg} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setSelectedPhotoUris(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {selectedPhotoUris.length < 10 && (
                  <TouchableOpacity style={styles.photoAddBtn} onPress={pickBoardPhotos} activeOpacity={0.8}>
                    <Text style={styles.photoAddIcon}>+</Text>
                    <Text style={styles.photoAddLabel}>{lang === 'es' ? 'Agregar' : lang === 'ko' ? '추가' : 'Add'}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              {/* 캡션 */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{lu('caption', lang)}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={lang === 'es' ? 'Escribe algo sobre esta foto…' : lang === 'ko' ? '이 사진에 대한 설명을 입력하세요…' : 'Write something about this photo…'}
                placeholderTextColor={Colors.text.light}
                value={caption}
                onChangeText={setCaption}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: communityColor }, (selectedPhotoUris.length === 0 || !photoAuthorName.trim() || uploadingPhoto) && styles.submitBtnDisabled]}
                onPress={submitPhoto} disabled={selectedPhotoUris.length === 0 || !photoAuthorName.trim() || uploadingPhoto}
              >
                {uploadingPhoto ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>{lang === 'ko' ? '올리기' : lang === 'es' ? 'Publicar' : 'Upload'}</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 사진 전체화면 뷰어 ── */}
      <Modal visible={!!fullScreenPhoto} animationType="fade" transparent={false} onRequestClose={() => setFullScreenPhoto(null)}>
        {fullScreenPhoto && (
          <View style={styles.fullScreenWrap}>
            <Image source={{ uri: fullScreenPhoto.photo_url }} style={styles.fullScreenImage} resizeMode="contain" />
            {/* 닫기 버튼 */}
            <TouchableOpacity style={styles.fullScreenClose} onPress={() => setFullScreenPhoto(null)}>
              <Text style={styles.fullScreenCloseText}>✕</Text>
            </TouchableOpacity>
            {/* 하단 정보 */}
            <View style={styles.fullScreenInfo}>
              <View style={[styles.fullScreenAvatar, { backgroundColor: communityColor }]}>
                <Text style={styles.fullScreenAvatarText}>{fullScreenPhoto.author_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fullScreenAuthor}>{fullScreenPhoto.author_name}</Text>
                <Text style={styles.fullScreenTime}>{timeAgo(fullScreenPhoto.created_at, lang)}</Text>
                {fullScreenPhoto.caption ? <Text style={styles.fullScreenCaption}>{fullScreenPhoto.caption}</Text> : null}
              </View>
              {user?.id === fullScreenPhoto.author_id ? (
                <TouchableOpacity style={styles.fullScreenDelete} onPress={() => handleDeletePhoto(fullScreenPhoto)}>
                  <Text style={styles.fullScreenDeleteText}>🗑️</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.fullScreenDelete} onPress={() => openModerationForPhoto(fullScreenPhoto)}>
                  <Text style={styles.fullScreenDeleteText}>⋯</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ── PostCard 컴포넌트 ──────────────────────────────────────────────────────────
interface PostCardProps {
  post: CommunityPost;
  lang: string;
  userId?: string;
  commentCount: number;
  communityColor: string;
  onPress: () => void;
  onDelete: () => void;
  onReport: () => void;
}

function PostCard({ post, lang, userId, commentCount, communityColor, onPress, onDelete, onReport }: PostCardProps) {
  const isOwner = userId && post.author_id === userId;
  const photos = post.photo_urls ?? [];
  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.avatar, { backgroundColor: communityColor }]}>
          <Text style={cardStyles.avatarText}>{post.author_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={cardStyles.authorInfo}>
          <Text style={cardStyles.authorName}>{post.author_name}</Text>
          <Text style={cardStyles.timeAgo}>{timeAgo(post.created_at, lang)}</Text>
        </View>
        {isOwner ? (
          <TouchableOpacity onPress={onDelete} style={cardStyles.deleteBtn} hitSlop={8}>
            <Text style={cardStyles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onReport} style={cardStyles.deleteBtn} hitSlop={8}>
            <Text style={cardStyles.deleteBtnText}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={cardStyles.title}>{post.title}</Text>
      <View style={cardStyles.chipRow}>
        {post.event_date ? <View style={cardStyles.chip}><Text style={cardStyles.chipIcon}>📅</Text><Text style={cardStyles.chipText}>{post.event_date}</Text></View> : null}
        {post.location ? <View style={cardStyles.chip}><Text style={cardStyles.chipIcon}>📍</Text><Text style={cardStyles.chipText}>{post.location}</Text></View> : null}
      </View>
      {post.description ? <Text style={cardStyles.description} numberOfLines={3}>{post.description}</Text> : null}
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cardStyles.photoScroll}>
          {photos.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={[cardStyles.photo, idx < photos.length - 1 && { marginRight: 8 }]} />
          ))}
        </ScrollView>
      )}
      <View style={cardStyles.footer}>
        <View style={cardStyles.commentChip}>
          <Text style={cardStyles.commentIcon}>💬</Text>
          <Text style={[cardStyles.commentCount, { color: communityColor }]}>
            {commentCount > 0 ? commentCount : (lang === 'en' ? 'Comment' : lang === 'es' ? 'Comentar' : '댓글')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  headerBtn: { width: 36, alignItems: 'center' },
  backArrow: { fontSize: 30, color: Colors.white, lineHeight: 32 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.white, flexShrink: 1 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 18 },
  iconBtnPlus: { fontSize: 24, color: Colors.white, lineHeight: 28, fontWeight: '300' },

  // 탭 바
  tabBar: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabBtnActive: {},
  tabBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  tabIndicator: { position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 3, borderRadius: 2 },

  // 리스트
  list: { padding: 16, paddingBottom: 110 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, color: Colors.text.secondary, textAlign: 'center', marginTop: 4 },

  // 사진 그리드
  photoGrid: { paddingBottom: 110, flexGrow: 1 },
  gridItem: { width: PHOTO_SIZE, height: PHOTO_SIZE, margin: 0.5, position: 'relative' },
  gridPhoto: { width: '100%', height: '100%' },
  gridAuthorBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 4, paddingVertical: 3,
  },
  gridAuthorText: { color: Colors.white, fontSize: 9, fontWeight: '600' },

  // 사진 전체화면
  fullScreenWrap: { flex: 1, backgroundColor: '#000' },
  fullScreenImage: { flex: 1, width: '100%' },
  fullScreenClose: {
    position: 'absolute', top: 52, right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  fullScreenCloseText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  fullScreenInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'rgba(0,0,0,0.75)', padding: 16, paddingBottom: 36,
  },
  fullScreenAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fullScreenAvatarText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  fullScreenAuthor: { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 2 },
  fullScreenTime: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  fullScreenCaption: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 19 },
  fullScreenDelete: { padding: 6 },
  fullScreenDeleteText: { fontSize: 20 },

  // 사진 업로드 모달
  selectedPhotoWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
  selectedPhotoPreview: { width: '100%', height: 220 },
  changePhotoBtn: { backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 10, alignItems: 'center' },
  changePhotoBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  photoPickerPlaceholder: {
    height: 140, backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  photoPickerIcon: { fontSize: 32 },
  photoPickerLabel: { fontSize: 14, color: Colors.text.secondary, fontWeight: '600' },

  // 공통 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 16, maxHeight: '92%' },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },
  modalClose: { fontSize: 18, color: Colors.text.secondary },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.text.secondary, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 13, fontSize: 15, color: Colors.text.primary, backgroundColor: Colors.background, marginBottom: 16 },
  textArea: { height: 90, paddingTop: 13 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 13, backgroundColor: Colors.background },
  dateBtnIcon: { fontSize: 16 },
  dateBtnText: { fontSize: 15, color: Colors.text.primary, flex: 1 },
  dateBtnPlaceholder: { color: Colors.text.light },
  dateClearBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  dateClearIcon: { fontSize: 12, color: Colors.text.secondary, fontWeight: '700' },
  dateDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, marginBottom: 12, marginTop: 4 },
  dateDoneBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  photoRow: { marginBottom: 20 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 8, position: 'relative', overflow: 'visible' },
  photoThumbImg: { width: 80, height: 80, borderRadius: 10 },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  photoRemoveText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  photoAddBtn: { width: 80, height: 80, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  photoAddIcon: { fontSize: 24, color: Colors.text.light, lineHeight: 28 },
  photoAddLabel: { fontSize: 10, color: Colors.text.light, marginTop: 2 },
  submitBtn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});

const cardStyles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 14, fontWeight: '700', color: Colors.text.primary },
  timeAgo: { fontSize: 12, color: Colors.text.light, marginTop: 1 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 14, color: Colors.text.light },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text.primary, marginBottom: 10, lineHeight: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  chipIcon: { fontSize: 13 },
  chipText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' },
  description: { fontSize: 14, color: Colors.text.secondary, lineHeight: 21, marginBottom: 12 },
  photoScroll: { marginTop: 4, marginBottom: 12 },
  photo: { width: 160, height: 160, borderRadius: 12 },
  footer: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 10 },
  commentChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  commentIcon: { fontSize: 14 },
  commentCount: { fontSize: 13, fontWeight: '600' },
});
