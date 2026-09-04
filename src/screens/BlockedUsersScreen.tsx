import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreTabParamList } from '../types';
import { Colors } from '../utils/colors';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchBlockedUsersDetailed, unblockUser, BlockedUserRow } from '../utils/moderation';

type Props = NativeStackScreenProps<MoreTabParamList, 'BlockedUsers'>;
type L = 'ko' | 'en' | 'es';

const T = {
  title:      { ko: '차단한 사용자', en: 'Blocked Users',   es: 'Usuarios Bloqueados' },
  empty:      { ko: '차단한 사용자가 없습니다.', en: 'You have not blocked anyone.', es: 'No has bloqueado a nadie.' },
  emptySub:   { ko: '게시글/댓글의 "…" 메뉴에서 사용자를 차단할 수 있습니다.', en: 'You can block users from the "…" menu on any post or comment.', es: 'Puede bloquear usuarios desde el menú "…" en cualquier publicación o comentario.' },
  unblock:    { ko: '차단 해제', en: 'Unblock', es: 'Desbloquear' },
  unblockTitle: { ko: '차단 해제', en: 'Unblock user', es: 'Desbloquear usuario' },
  unblockMsg: { ko: '이 사용자의 게시글과 댓글이 다시 표시됩니다.', en: 'This user\'s posts and comments will be visible again.', es: 'Las publicaciones y comentarios de este usuario volverán a ser visibles.' },
  unblockOk:  { ko: '해제',  en: 'Unblock', es: 'Desbloquear' },
  cancel:     { ko: '취소',  en: 'Cancel',  es: 'Cancelar' },
  err:        { ko: '차단 해제에 실패했습니다.', en: 'Failed to unblock.', es: 'Error al desbloquear.' },
  unknown:    { ko: '(이름 없음)', en: '(no name)', es: '(sin nombre)' },
  blockedOn:  { ko: '차단일', en: 'Blocked on', es: 'Bloqueado el' },
};

export default function BlockedUsersScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const l: L = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  const [rows, setRows] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const data = await fetchBlockedUsersDetailed(user.id);
    setRows(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function confirmUnblock(row: BlockedUserRow) {
    const name = row.blocked_name ?? T.unknown[l];
    Alert.alert(
      `${T.unblockTitle[l]}: ${name}`,
      T.unblockMsg[l],
      [
        { text: T.cancel[l], style: 'cancel' },
        {
          text: T.unblockOk[l],
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const { error } = await unblockUser(user.id, row.blocked_id);
            if (error) { Alert.alert('', T.err[l]); return; }
            setRows(prev => prev.filter(r => r.id !== row.id));
          },
        },
      ]
    );
  }

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(l === 'ko' ? 'ko-KR' : l === 'es' ? 'es-ES' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch { return iso.slice(0, 10); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{T.title[l]}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🚫</Text>
          <Text style={styles.emptyText}>{T.empty[l]}</Text>
          <Text style={styles.emptySub}>{T.emptySub[l]}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.blocked_name?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.blocked_name ?? T.unknown[l]}</Text>
                <Text style={styles.date}>{T.blockedOn[l]}: {fmtDate(item.created_at)}</Text>
              </View>
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => confirmUnblock(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.unblockText}>{T.unblock[l]}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backArrow: { fontSize: 30, color: Colors.primary, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.primary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyEmoji: { fontSize: 48, marginBottom: 6 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, textAlign: 'center' },
  emptySub: { fontSize: 13, color: Colors.text.secondary, textAlign: 'center', lineHeight: 20 },

  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 12,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  date: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.primary,
  },
  unblockText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
