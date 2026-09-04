import { Alert, AlertButton } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

export type ContentType = 'post' | 'photo' | 'comment' | 'message' | 'prayer';

// 차단/검열 키워드 (욕설·혐오·성적 표현 — 영/한/스 공통, 가벼운 워드 리스트)
const BLOCKED_WORDS: string[] = [
  // EN
  'fuck', 'fucker', 'fucking', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy',
  'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'rape', 'pedo',
  // KO
  '시발', '씨발', '씨팔', '시팔', 'ㅅㅂ', '병신', 'ㅄ', 'ㅂㅅ', '존나', '좆', '개새끼', '새끼야',
  '미친년', '미친놈', '꺼져', '죽어', '쳐죽', '엿먹', '닥쳐',
  // ES
  'mierda', 'puta', 'puto', 'cabron', 'cabrón', 'pendejo', 'coño', 'joder',
  'maricon', 'maricón', 'verga',
];

const REPORT_REASONS: { key: string; label: { ko: string; en: string; es: string } }[] = [
  { key: 'spam',       label: { ko: '스팸/광고',         en: 'Spam or ads',           es: 'Spam o publicidad' } },
  { key: 'hate',       label: { ko: '혐오/차별 발언',    en: 'Hate speech',           es: 'Discurso de odio' } },
  { key: 'harassment', label: { ko: '괴롭힘/욕설',       en: 'Harassment or abuse',   es: 'Acoso o abuso' } },
  { key: 'sexual',     label: { ko: '음란물/성적 표현',  en: 'Sexual content',        es: 'Contenido sexual' } },
  { key: 'violence',   label: { ko: '폭력/위험',         en: 'Violence or danger',    es: 'Violencia o peligro' } },
  { key: 'other',      label: { ko: '기타',              en: 'Other',                 es: 'Otro' } },
];

/** 욕설/혐오 키워드 검사 — true 면 차단 */
export function containsBlockedWords(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

/** 필터링 키워드가 포함되면 Alert 표시 + true 반환 (차단) */
export function checkContentFilter(text: string, lang: 'ko' | 'en' | 'es' = 'ko'): boolean {
  if (!containsBlockedWords(text)) return false;
  const msg = {
    ko: '부적절한 표현이 포함되어 있어 등록할 수 없습니다.',
    en: 'Your content contains inappropriate language and cannot be posted.',
    es: 'Tu contenido contiene lenguaje inapropiado y no se puede publicar.',
  }[lang];
  Alert.alert('', msg);
  return true;
}

/** 콘텐츠 신고 (Supabase content_reports 테이블에 저장) */
export async function submitReport(params: {
  reporterId: string;
  contentType: ContentType;
  contentId: string;
  reportedUserId: string | null;
  reason: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: params.reporterId,
    content_type: params.contentType,
    content_id: params.contentId,
    reported_user_id: params.reportedUserId,
    reason: params.reason,
    status: 'pending',
  });
  return { error: error?.message ?? null };
}

/** 신고 사유 선택 Alert 띄우기 */
export function promptReport(params: {
  lang: 'ko' | 'en' | 'es';
  reporterId: string;
  contentType: ContentType;
  contentId: string;
  reportedUserId: string | null;
  onDone?: () => void;
}) {
  const T = {
    title:   { ko: '신고하기',         en: 'Report',            es: 'Reportar' },
    msg:     { ko: '신고 사유를 선택해 주세요.', en: 'Select a reason for reporting.', es: 'Selecciona un motivo para reportar.' },
    cancel:  { ko: '취소',             en: 'Cancel',            es: 'Cancelar' },
    success: { ko: '신고가 접수되었습니다.\n24시간 내에 검토 후 조치됩니다.', en: 'Report received.\nWe will review and act within 24 hours.', es: 'Reporte recibido.\nRevisaremos y actuaremos dentro de 24 horas.' },
    fail:    { ko: '신고 접수에 실패했습니다.', en: 'Failed to submit report.', es: 'No se pudo enviar el reporte.' },
  };

  const buttons: AlertButton[] = REPORT_REASONS.map((r) => ({
    text: r.label[params.lang],
    onPress: async () => {
      const { error } = await submitReport({
        reporterId: params.reporterId,
        contentType: params.contentType,
        contentId: params.contentId,
        reportedUserId: params.reportedUserId,
        reason: r.key,
      });
      Alert.alert('', error ? T.fail[params.lang] : T.success[params.lang]);
      if (!error && params.onDone) params.onDone();
    },
  }));
  buttons.push({ text: T.cancel[params.lang], style: 'cancel' });

  Alert.alert(T.title[params.lang], T.msg[params.lang], buttons);
}

/** 유저 차단 (blocked_users 에 저장 + 자동 신고 1건 생성) */
export async function blockUser(params: {
  blockerId: string;
  blockedUserId: string;
  contentType: ContentType;
  contentId: string;
}): Promise<{ error: string | null }> {
  const { error: blockErr } = await supabase
    .from('blocked_users')
    .upsert(
      { blocker_id: params.blockerId, blocked_id: params.blockedUserId },
      { onConflict: 'blocker_id,blocked_id' }
    );
  if (blockErr) return { error: blockErr.message };

  // 자동 신고 (개발자/관리자에게 알림)
  await supabase.from('content_reports').insert({
    reporter_id: params.blockerId,
    content_type: params.contentType,
    content_id: params.contentId,
    reported_user_id: params.blockedUserId,
    reason: 'blocked_by_user',
    status: 'pending',
  });
  return { error: null };
}

/** 차단 확인 + 실행 */
export function promptBlock(params: {
  lang: 'ko' | 'en' | 'es';
  blockerId: string;
  blockedUserId: string;
  blockedUserName: string;
  contentType: ContentType;
  contentId: string;
  onDone?: () => void;
}) {
  const T = {
    title:   { ko: '사용자 차단',                                en: 'Block User',                                    es: 'Bloquear usuario' },
    msg:     { ko: `${params.blockedUserName} 님을 차단하시겠습니까?\n차단하면 이 사용자의 모든 게시물·댓글·채팅이 즉시 숨겨집니다.`, en: `Block ${params.blockedUserName}?\nAll their posts, comments, and chats will be hidden from you immediately.`, es: `¿Bloquear a ${params.blockedUserName}?\nSus publicaciones, comentarios y mensajes se ocultarán inmediatamente.` },
    cancel:  { ko: '취소',                                       en: 'Cancel',                                        es: 'Cancelar' },
    ok:      { ko: '차단',                                       en: 'Block',                                         es: 'Bloquear' },
    success: { ko: '차단되었습니다.\n신고는 24시간 내에 검토됩니다.', en: 'Blocked.\nReport will be reviewed within 24 hours.', es: 'Bloqueado.\nEl reporte será revisado dentro de 24 horas.' },
    fail:    { ko: '차단에 실패했습니다.',                       en: 'Failed to block user.',                         es: 'No se pudo bloquear.' },
  };
  Alert.alert(T.title[params.lang], T.msg[params.lang], [
    { text: T.cancel[params.lang], style: 'cancel' },
    {
      text: T.ok[params.lang],
      style: 'destructive',
      onPress: async () => {
        const { error } = await blockUser({
          blockerId: params.blockerId,
          blockedUserId: params.blockedUserId,
          contentType: params.contentType,
          contentId: params.contentId,
        });
        Alert.alert('', error ? T.fail[params.lang] : T.success[params.lang]);
        if (!error && params.onDone) params.onDone();
      },
    },
  ]);
}

/** 내가 차단한 유저 ID 목록 */
export async function fetchBlockedIds(blockerId: string): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', blockerId);
    return new Set((data ?? []).map((r: any) => r.blocked_id));
  } catch {
    return new Set();
  }
}

// ── 차단 목록 조회 & 해제 ─────────────────────────────────────────────────────
export interface BlockedUserRow {
  id: string;
  blocked_id: string;
  blocked_name: string | null;
  created_at: string;
}

/** 내가 차단한 유저 상세 (이름 포함) */
export async function fetchBlockedUsersDetailed(blockerId: string): Promise<BlockedUserRow[]> {
  const { data } = await supabase
    .from('blocked_users')
    .select('id, blocked_id, created_at, profiles:blocked_id(full_name)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    blocked_id: r.blocked_id,
    blocked_name: r.profiles?.full_name ?? null,
    created_at: r.created_at,
  }));
}

/** 차단 해제 */
export async function unblockUser(blockerId: string, blockedId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  return { error: error?.message ?? null };
}

// ── 관리자 전용 RPCs (supabase_apple_1_2_compliance.sql 에 정의) ───────────────
export interface PendingReport {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  content_type: ContentType;
  content_id: string;
  reported_user_id: string | null;
  reported_user_name: string | null;
  reported_user_banned: boolean | null;
  reason: string;
  status: 'pending' | 'reviewed' | 'removed';
  created_at: string;
  admin_notes: string | null;
  content_preview: string | null;
}

/** 관리자: 미처리 신고 목록 (v_pending_reports 뷰) */
export async function fetchPendingReports(): Promise<PendingReport[]> {
  const { data } = await supabase
    .from('v_pending_reports')
    .select('*')
    .eq('status', 'pending');
  return (data ?? []) as PendingReport[];
}

/** 관리자: 신고 확인 완료 처리 */
export async function markReportReviewed(reportId: string, notes: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_mark_report_reviewed', {
    p_report_id: reportId,
    p_notes: notes,
  });
  return { error: error?.message ?? null };
}

/** 관리자: 신고된 콘텐츠 삭제 + 관련 신고 일괄 종결 */
export async function deleteReportedContent(reportId: string, contentType: ContentType, contentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_delete_reported_content', {
    p_report_id: reportId,
    p_content_type: contentType,
    p_content_id: contentId,
  });
  return { error: error?.message ?? null };
}

/** 관리자: 유저 정지 */
export async function banUser(targetId: string, reason: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_ban_user', {
    target_id: targetId,
    reason,
  });
  return { error: error?.message ?? null };
}

/** 관리자: 유저 정지 해제 */
export async function unbanUser(targetId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_unban_user', { target_id: targetId });
  return { error: error?.message ?? null };
}

// ── 콘텐츠 단위 숨김 (작성자 ID 를 알 수 없거나 익명일 때) ────────────────────
// AsyncStorage 에 저장 → 이 기기에서 즉시 숨김 + 서버에도 신고 접수
const HIDDEN_CONTENT_KEY = 'hidden_content_ids_v1';

async function readHiddenIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(HIDDEN_CONTENT_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

async function writeHiddenIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(HIDDEN_CONTENT_KEY, JSON.stringify(Array.from(ids)));
  } catch { /* ignore */ }
}

/** 이 기기에서 숨겨진 콘텐츠 ID 목록 */
export async function fetchHiddenContentIds(): Promise<Set<string>> {
  return readHiddenIds();
}

/** 콘텐츠 하나를 숨김 처리 (+ 서버에 신고) */
export async function hideContent(params: {
  reporterId: string;
  contentType: ContentType;
  contentId: string;
  reportedUserId: string | null;
}): Promise<{ error: string | null }> {
  const ids = await readHiddenIds();
  ids.add(params.contentId);
  await writeHiddenIds(ids);
  await supabase.from('content_reports').insert({
    reporter_id: params.reporterId,
    content_type: params.contentType,
    content_id: params.contentId,
    reported_user_id: params.reportedUserId,
    reason: 'hidden_by_user',
    status: 'pending',
  });
  return { error: null };
}

/** 콘텐츠 숨김 확인 다이얼로그 */
function promptHideContent(params: {
  lang: 'ko' | 'en' | 'es';
  reporterId: string;
  contentType: ContentType;
  contentId: string;
  reportedUserId: string | null;
  onDone?: () => void;
}) {
  const T = {
    title:   { ko: '콘텐츠 숨기기', en: 'Hide Content',           es: 'Ocultar contenido' },
    msg:     { ko: '이 콘텐츠를 숨기고 관리자에게 신고할까요?\n즉시 화면에서 사라집니다.', en: 'Hide this content and notify the moderators?\nIt will disappear from your view immediately.', es: '¿Ocultar este contenido y notificar a los moderadores?\nDesaparecerá inmediatamente de tu vista.' },
    cancel:  { ko: '취소',           en: 'Cancel',                 es: 'Cancelar' },
    ok:      { ko: '숨기기',         en: 'Hide',                   es: 'Ocultar' },
    success: { ko: '숨김 처리되었습니다.', en: 'Hidden.',           es: 'Ocultado.' },
  };
  Alert.alert(T.title[params.lang], T.msg[params.lang], [
    { text: T.cancel[params.lang], style: 'cancel' },
    {
      text: T.ok[params.lang],
      style: 'destructive',
      onPress: async () => {
        await hideContent({
          reporterId: params.reporterId,
          contentType: params.contentType,
          contentId: params.contentId,
          reportedUserId: params.reportedUserId,
        });
        Alert.alert('', T.success[params.lang]);
        if (params.onDone) params.onDone();
      },
    },
  ]);
}

/** "..." 메뉴: 신고/차단 액션 시트
 *  - 다른 유저 콘텐츠: 신고 + 차단 (+ 취소)
 *  - 작성자 미상 콘텐츠: 신고 + 이 콘텐츠 숨기기 (+ 취소)
 *  - 본인 콘텐츠: 아예 열지 말 것 (호출부에서 확인)
 */
export function showModerationMenu(params: {
  lang: 'ko' | 'en' | 'es';
  reporterId: string;
  targetUserId: string | null;
  targetUserName: string;
  contentType: ContentType;
  contentId: string;
  onBlocked?: () => void;
  onReported?: () => void;
  onHidden?: () => void;
  extraButtons?: AlertButton[];
}) {
  const T = {
    title:   { ko: '관리',     en: 'Manage',  es: 'Gestionar' },
    msg:     { ko: '원하는 작업을 선택해 주세요.', en: 'Choose an action.', es: 'Elige una acción.' },
    report:  { ko: '🚨 신고하기',  en: '🚨 Report',   es: '🚨 Reportar' },
    block:   { ko: '🚫 사용자 차단', en: '🚫 Block user', es: '🚫 Bloquear usuario' },
    hide:    { ko: '🙈 이 콘텐츠 숨기기', en: '🙈 Hide this content', es: '🙈 Ocultar este contenido' },
    cancel:  { ko: '취소',     en: 'Cancel',  es: 'Cancelar' },
  };
  const buttons: AlertButton[] = [
    ...(params.extraButtons ?? []),
    {
      text: T.report[params.lang],
      onPress: () => promptReport({
        lang: params.lang,
        reporterId: params.reporterId,
        contentType: params.contentType,
        contentId: params.contentId,
        reportedUserId: params.targetUserId,
        onDone: params.onReported,
      }),
    },
  ];
  if (params.targetUserId && params.targetUserId !== params.reporterId) {
    // 다른 유저 콘텐츠 → 유저 차단
    buttons.push({
      text: T.block[params.lang],
      style: 'destructive',
      onPress: () => promptBlock({
        lang: params.lang,
        blockerId: params.reporterId,
        blockedUserId: params.targetUserId!,
        blockedUserName: params.targetUserName,
        contentType: params.contentType,
        contentId: params.contentId,
        onDone: params.onBlocked,
      }),
    });
  } else if (params.targetUserId !== params.reporterId) {
    // 작성자 미상 → 콘텐츠 단위 숨김 (Apple 1.2 준수: 항상 차단 수단 제공)
    buttons.push({
      text: T.hide[params.lang],
      style: 'destructive',
      onPress: () => promptHideContent({
        lang: params.lang,
        reporterId: params.reporterId,
        contentType: params.contentType,
        contentId: params.contentId,
        reportedUserId: params.targetUserId,
        onDone: params.onHidden ?? params.onBlocked,
      }),
    });
  }
  buttons.push({ text: T.cancel[params.lang], style: 'cancel' });
  Alert.alert(T.title[params.lang], T.msg[params.lang], buttons);
}
