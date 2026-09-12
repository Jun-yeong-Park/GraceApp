import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommunityTabStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import Icon from '../components/Icon';
import { COMMUNITIES, getCommunityName } from './CommunityScreen';
import { checkContentFilter, fetchBlockedIds, fetchHiddenContentIds, showModerationMenu } from '../utils/moderation';

type Props = NativeStackScreenProps<CommunityTabStackParamList, 'CommunityPostDetail'>;

interface Comment {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

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

const UI = {
  comments:    { ko: '댓글',        en: 'Comments',     es: 'Comentarios'  },
  addComment:  { ko: '댓글 쓰기…',  en: 'Write a comment…', es: 'Escribir un comentario…' },
  send:        { ko: '등록',        en: 'Post',         es: 'Publicar'     },
  noComments:  { ko: '첫 댓글을 남겨보세요!', en: 'Be the first to comment!', es: '¡Sé el primero en comentar!' },
  loginToComment: { ko: '댓글은 로그인 후 작성할 수 있습니다.', en: 'Sign in to leave a comment.', es: 'Inicia sesión para comentar.' },
  deleteComment:  { ko: '댓글을 삭제하시겠습니까?', en: 'Delete this comment?', es: '¿Eliminar este comentario?' },
};

function lu(key: keyof typeof UI, lang: string): string {
  const l: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
  return UI[key][l];
}

export default function CommunityPostDetailScreen({ navigation, route }: Props) {
  const { post, communityId } = route.params;
  const { lang, t } = useLanguage();
  const { user, displayName } = useAuth();

  const community = COMMUNITIES.find((c) => c.id === communityId);
  const communityColor = community?.color ?? Colors.primary;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const lng: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  useEffect(() => {
    if (!user) { setBlockedIds(new Set()); return; }
    fetchBlockedIds(user.id).then(setBlockedIds);
  }, [user]);

  useEffect(() => {
    fetchHiddenContentIds().then(setHiddenIds);
  }, []);

  useEffect(() => {
    fetchComments();

    // 실시간 댓글 구독
    const channel = supabase
      .channel(`comments:${post.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'post_comments',
        filter: `post_id=eq.${post.id}`,
      }, (payload) => {
        appendComment(payload.new as Comment);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'post_comments',
        filter: `post_id=eq.${post.id}`,
      }, (payload) => {
        setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  // Realtime 이 꺼져 있어도 내가 쓴 댓글은 바로 보여야 하므로, 저장 응답과
  // Realtime 이벤트 양쪽에서 호출한다. 같은 id 는 한 번만 추가.
  function appendComment(c: Comment) {
    setComments((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
  }

  async function fetchComments() {
    const { data } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (data) setComments(data as Comment[]);
    setLoadingComments(false);
  }

  async function sendComment() {
    if (!user) { Alert.alert('', lu('loginToComment', lang)); return; }
    if (!commentText.trim()) return;
    if (checkContentFilter(commentText, lng)) return;
    setSending(true);
    // 프로필 이름(더보기 → 이름 변경에서 수정한 값) 우선, 없으면 가입 시 이름 → 이메일 앞부분
    const authorName = displayName || (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || t('anonymous');
    const { data, error } = await supabase.from('post_comments').insert({
      post_id: post.id,
      author_id: user.id,
      author_name: authorName,
      content: commentText.trim(),
    }).select().single();
    setSending(false);
    if (error) {
      Alert.alert('', lang === 'ko' ? '댓글 등록에 실패했습니다. 다시 시도해주세요.' : lang === 'es' ? 'Error al publicar el comentario.' : 'Failed to post comment. Please try again.');
    } else {
      if (data) appendComment(data as Comment);
      setCommentText('');
    }
  }

  function deleteComment(comment: Comment) {
    Alert.alert('', lu('deleteComment', lang), [
      { text: t('cancelBtn'), style: 'cancel' },
      {
        text: t('deleteLabel'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('post_comments').delete().eq('id', comment.id);
          if (error) {
            const msg = lang === 'ko' ? '댓글 삭제에 실패했습니다.'
              : lang === 'es' ? 'No se pudo eliminar el comentario.'
              : 'Failed to delete comment.';
            Alert.alert('', msg);
          }
        },
      },
    ]);
  }

  // 차단된 유저 · 숨김 처리된 댓글 제외 (App Store 1.2)
  const visibleComments = comments.filter(
    (c) => !(c.author_id && blockedIds.has(c.author_id)) && !hiddenIds.has(c.id)
  );

  // 게시글 자체 신고/차단 (Apple 1.2 — 상세 화면에서도 신고 수단 노출)
  function moderatePost() {
    if (!user) { Alert.alert('', lu('loginToComment', lang)); return; }
    showModerationMenu({
      lang: lng,
      reporterId: user.id,
      targetUserId: post.author_id ?? null,
      targetUserName: post.author_name,
      contentType: 'post',
      contentId: post.id,
      onBlocked: () => navigation.goBack(),
      onHidden: () => navigation.goBack(),
    });
  }

  function moderateComment(comment: Comment) {
    if (!user) { Alert.alert('', lu('loginToComment', lang)); return; }
    if (comment.author_id === user.id) return; // 본인 댓글은 관리 메뉴 미표시
    showModerationMenu({
      lang: lng,
      reporterId: user.id,
      targetUserId: comment.author_id,
      targetUserName: comment.author_name,
      contentType: 'comment',
      contentId: comment.id,
      onBlocked: () => { if (user) fetchBlockedIds(user.id).then(setBlockedIds); },
      onHidden: () => fetchHiddenContentIds().then(setHiddenIds),
    });
  }

  const photos = post.photo_urls ?? [];
  const isMyPost = !!user && post.author_id === user.id;

  // 게시글을 헤더 컴포넌트로 사용
  const PostContent = (
    <View style={styles.postWrap}>
      {/* 작성자 */}
      <View style={styles.authorRow}>
        <View style={[styles.avatar, { backgroundColor: communityColor }]}>
          <Text style={styles.avatarText}>{post.author_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.authorName}>{post.author_name}</Text>
          <Text style={styles.timeAgo}>{timeAgo(post.created_at, lang)}</Text>
        </View>
      </View>

      {/* 제목 */}
      <Text style={styles.postTitle}>{post.title}</Text>

      {/* 날짜/장소 칩 */}
      <View style={styles.chipRow}>
        {post.event_date ? (
          <View style={styles.chip}>
            <Icon name="ui-calendar" size={13} tintColor={Colors.text.secondary} />
            <Text style={styles.chipText}>{post.event_date}</Text>
          </View>
        ) : null}
        {post.location ? (
          <View style={styles.chip}>
            <Icon name="ui-pin" size={13} tintColor={Colors.text.secondary} />
            <Text style={styles.chipText}>{post.location}</Text>
          </View>
        ) : null}
      </View>

      {/* 내용 */}
      {post.description ? <Text style={styles.postDesc}>{post.description}</Text> : null}

      {/* 사진 */}
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {photos.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={[styles.photo, idx < photos.length - 1 && { marginRight: 10 }]} />
          ))}
        </ScrollView>
      )}

      {/* 댓글 구분선 */}
      <View style={styles.commentDivider}>
        <Text style={styles.commentDividerText}>
          {lu('comments', lang)} {comments.length > 0 ? `(${comments.length})` : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: communityColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{post.title}</Text>
        {isMyPost ? (
          <View style={styles.backBtn} />
        ) : (
          <TouchableOpacity onPress={moderatePost} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.headerMore}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* 게시글 + 댓글 목록 */}
        {loadingComments ? (
          <View style={{ flex: 1 }}>
            {PostContent}
            <ActivityIndicator color={communityColor} style={{ marginTop: 20 }} />
          </View>
        ) : (
          <FlatList
            data={visibleComments}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={PostContent}
            ListEmptyComponent={
              <Text style={styles.noComments}>{lu('noComments', lang)}</Text>
            }
            renderItem={({ item }) => {
              const isMe = user && item.author_id === user.id;
              return (
                <View style={styles.commentRow}>
                  <View style={[styles.commentAvatar, { backgroundColor: communityColor + '28' }]}>
                    <Text style={[styles.commentAvatarText, { color: communityColor }]}>
                      {item.author_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBubble}>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentAuthor}>{item.author_name}</Text>
                      <Text style={styles.commentTime}>{timeAgo(item.created_at, lang)}</Text>
                      {isMe ? (
                        <TouchableOpacity onPress={() => deleteComment(item)} hitSlop={6}>
                          <Text style={styles.commentDelete}>✕</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => moderateComment(item)} hitSlop={6}>
                          <Text style={styles.commentDelete}>⋯</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.commentContent}>{item.content}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* 댓글 입력 */}
        <View style={styles.inputBar}>
          {user ? (
            <>
              <TextInput
                ref={inputRef}
                style={styles.commentInput}
                placeholder={lu('addComment', lang)}
                placeholderTextColor={Colors.text.light}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: communityColor }, (!commentText.trim() || sending) && styles.sendBtnDisabled]}
                onPress={sendComment}
                disabled={!commentText.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.sendBtnText}>{lu('send', lang)}</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.loginPrompt}
              onPress={() => Alert.alert('', lu('loginToComment', lang))}
            >
              <Text style={styles.loginPromptText}>{lu('loginToComment', lang)}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { width: 36, alignItems: 'center' },
  backArrow: { fontSize: 30, color: Colors.white, lineHeight: 32 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.white, textAlign: 'center' },
  headerMore: { fontSize: 26, color: Colors.white, lineHeight: 30, fontWeight: '700' },

  listContent: { paddingBottom: 16 },

  // 게시글
  postWrap: {
    backgroundColor: Colors.white,
    padding: 20,
    marginBottom: 8,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.white, fontSize: 17, fontWeight: '800' },
  authorName: { fontSize: 14, fontWeight: '700', color: Colors.text.primary },
  timeAgo: { fontSize: 12, color: Colors.text.light, marginTop: 1 },
  postTitle: { fontSize: 19, fontWeight: '800', color: Colors.text.primary, marginBottom: 12, lineHeight: 26 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  chipText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' },
  postDesc: { fontSize: 15, color: Colors.text.secondary, lineHeight: 23, marginBottom: 14 },
  photoScroll: { marginBottom: 14 },
  photo: { width: 220, height: 220, borderRadius: 12 },
  commentDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
    marginTop: 4,
  },
  commentDividerText: { fontSize: 13, fontWeight: '700', color: Colors.text.secondary },

  // 댓글
  noComments: { textAlign: 'center', color: Colors.text.light, fontSize: 14, marginTop: 20, marginBottom: 20 },
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  commentAvatarText: { fontSize: 13, fontWeight: '800' },
  commentBubble: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  commentTime: { fontSize: 11, color: Colors.text.light, flex: 1 },
  commentDelete: { fontSize: 12, color: Colors.text.light },
  commentContent: { fontSize: 14, color: Colors.text.primary, lineHeight: 20 },

  // 댓글 입력바
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
    maxHeight: 100,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  loginPrompt: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginPromptText: { fontSize: 13, color: Colors.text.light },
});
