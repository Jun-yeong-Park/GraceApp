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
import { COMMUNITIES, getCommunityName } from './CommunityScreen';
import { checkContentFilter, fetchBlockedIds, fetchHiddenContentIds, showModerationMenu } from '../utils/moderation';

type Props = NativeStackScreenProps<CommunityTabStackParamList, 'CommunityChat'>;

interface Message {
  id: string;
  community_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

function formatTime(dateStr: string, lang: string = 'en'): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const hour = h % 12 === 0 ? 12 : h % 12;
  const amEn = h < 12 ? 'AM' : 'PM';
  if (lang === 'ko') {
    const ampmKo = h < 12 ? '오전' : '오후';
    return `${ampmKo} ${hour}:${m}`;
  }
  return `${hour}:${m} ${amEn}`;
}

function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  if (lang === 'en') {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } else if (lang === 'es') {
    return d.toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

const UI = {
  chat:          { ko: '채팅',           en: 'Chat',              es: 'Chat'               },
  placeholder:   { ko: '메시지 입력…',   en: 'Message…',          es: 'Mensaje…'           },
  loginRequired: { ko: '채팅은 로그인 후 이용할 수 있습니다.', en: 'Sign in to chat.', es: 'Inicia sesión para chatear.' },
  noMessages:    { ko: '첫 메시지를 보내보세요! 👋', en: 'Send the first message! 👋', es: '¡Envía el primer mensaje! 👋' },
};

function lu(key: keyof typeof UI, lang: string): string {
  const l: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
  return UI[key][l];
}

export default function CommunityChatScreen({ navigation, route }: Props) {
  const { communityId } = route.params;
  const { lang } = useLanguage();
  const { user } = useAuth();

  const community = COMMUNITIES.find((c) => c.id === communityId);
  const communityColor = community?.color ?? Colors.primary;
  const communityName = community ? getCommunityName(community, lang) : '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  const lng: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  useEffect(() => {
    if (!user) { setBlockedIds(new Set()); return; }
    fetchBlockedIds(user.id).then(setBlockedIds);
  }, [user]);

  useEffect(() => {
    fetchHiddenContentIds().then(setHiddenIds);
  }, []);

  useEffect(() => {
    // 초기 메시지 로드 (최신 100개, 오름차순으로 표시)
    supabase
      .from('community_messages')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (data) setMessages(data as Message[]);
        if (error) {
          const msg = lang === 'ko' ? '메시지를 불러오지 못했습니다.'
            : lang === 'es' ? 'No se pudieron cargar los mensajes.'
            : 'Failed to load messages.';
          Alert.alert('', msg);
        }
        setLoading(false);
      }, () => setLoading(false));

    // 실시간 구독
    const channel = supabase
      .channel(`chat:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: `community_id=eq.${communityId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [communityId]);

  async function sendMessage() {
    if (!user) {
      Alert.alert('', lu('loginRequired', lang));
      return;
    }
    const content = text.trim();
    if (!content) return;
    if (checkContentFilter(content, lng)) return;
    setSending(true);
    const authorName =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      '익명';
    const { error } = await supabase.from('community_messages').insert({
      community_id: communityId,
      author_id: user.id,
      author_name: authorName,
      content,
    });
    setSending(false);
    if (error) {
      const msg = lang === 'ko' ? '메시지 전송에 실패했습니다. 다시 시도해 주세요.'
        : lang === 'es' ? 'No se pudo enviar el mensaje. Intenta de nuevo.'
        : 'Failed to send message. Please try again.';
      Alert.alert('', msg);
      return; // 실패 시 입력창의 내용을 유지해서 사용자가 다시 전송할 수 있게 함
    }
    setText('');
  }

  // 차단된 유저 · 숨김 처리된 메시지 제외 (App Store 1.2)
  const visibleMessages = messages.filter(
    (m) => !(m.author_id && blockedIds.has(m.author_id)) && !hiddenIds.has(m.id)
  );

  // 날짜 구분선이 필요한지 확인
  function needsDateSeparator(index: number): boolean {
    if (index === 0) return true;
    return !isSameDay(visibleMessages[index].created_at, visibleMessages[index - 1].created_at);
  }

  function moderateMessage(msg: Message) {
    if (!user || msg.author_id === user.id) return;
    showModerationMenu({
      lang: lng,
      reporterId: user.id,
      targetUserId: msg.author_id,
      targetUserName: msg.author_name,
      contentType: 'message',
      contentId: msg.id,
      onBlocked: () => {
        if (user) fetchBlockedIds(user.id).then(setBlockedIds);
      },
      onHidden: () => fetchHiddenContentIds().then(setHiddenIds),
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: communityColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {community && <Text style={styles.headerEmoji}>{community.emoji}</Text>}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {communityName} {lu('chat', lang)}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={communityColor} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{lu('noMessages', lang)}</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMe = user?.id === item.author_id;
              const showDate = needsDateSeparator(index);
              // 연속 메시지 여부 (같은 사람이 1분 이내 연속 전송)
              const prevMsg = index > 0 ? visibleMessages[index - 1] : null;
              const isContinuous =
                !showDate &&
                prevMsg &&
                prevMsg.author_id === item.author_id &&
                new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000;

              return (
                <>
                  {showDate && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>{formatDate(item.created_at, lang)}</Text>
                    </View>
                  )}
                  <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther, isContinuous && styles.msgRowContinuous]}>
                    {/* 상대방 아바타 */}
                    {!isMe && !isContinuous && (
                      <View style={[styles.avatar, { backgroundColor: communityColor }]}>
                        <Text style={styles.avatarText}>{item.author_name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    {!isMe && isContinuous && <View style={styles.avatarSpacer} />}

                    <View style={[styles.msgColumn, isMe && styles.msgColumnMe]}>
                      {/* 이름 (상대방만, 첫 메시지만) */}
                      {!isMe && !isContinuous && (
                        <Text style={styles.msgAuthor}>{item.author_name}</Text>
                      )}
                      <View style={styles.msgBubbleRow}>
                        {/* 내 메시지 타임스탬프 (왼쪽) */}
                        {isMe && (
                          <Text style={styles.msgTime}>{formatTime(item.created_at, lang)}</Text>
                        )}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onLongPress={() => moderateMessage(item)}
                          disabled={isMe}
                          style={[styles.bubble, isMe ? [styles.bubbleMe, { backgroundColor: communityColor }] : styles.bubbleOther]}
                        >
                          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                            {item.content}
                          </Text>
                        </TouchableOpacity>
                        {/* 상대 타임스탬프 + 신고 버튼 (오른쪽) */}
                        {!isMe && (
                          <>
                            <Text style={styles.msgTime}>{formatTime(item.created_at, lang)}</Text>
                            <TouchableOpacity onPress={() => moderateMessage(item)} hitSlop={10} style={styles.msgMoreBtn}>
                              <Text style={styles.msgMoreText}>⋯</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </>
              );
            }}
          />
        )}

        {/* 메시지 입력 */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={user ? lu('placeholder', lang) : lu('loginRequired', lang)}
            placeholderTextColor={Colors.text.light}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            editable={!!user}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: communityColor },
              (!text.trim() || sending || !user) && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={!text.trim() || sending || !user}
          >
            {sending
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={styles.sendIcon}>▶</Text>
            }
          </TouchableOpacity>
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
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerEmoji: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white, flexShrink: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, flexGrow: 1 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 15, color: Colors.text.secondary, textAlign: 'center' },

  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: Colors.text.light,
    backgroundColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: '600',
    overflow: 'hidden',
  },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgRowContinuous: { marginBottom: 2 },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  avatarText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  avatarSpacer: { width: 40 },

  msgColumn: { maxWidth: '72%' },
  msgColumnMe: { alignItems: 'flex-end' },

  msgAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 3,
    marginLeft: 4,
  },

  msgBubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleText: { fontSize: 15, color: Colors.text.primary, lineHeight: 21 },
  bubbleTextMe: { color: Colors.white },

  msgTime: {
    fontSize: 10,
    color: Colors.text.light,
    marginBottom: 2,
  },
  msgMoreBtn: { paddingHorizontal: 4, marginBottom: 2 },
  msgMoreText: { fontSize: 16, color: Colors.text.light, fontWeight: '700', lineHeight: 18 },

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
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
    maxHeight: 110,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: Colors.white, fontSize: 14, marginLeft: 2 },
});
