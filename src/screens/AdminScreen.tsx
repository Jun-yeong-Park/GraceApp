import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList, PrayerRequest, VisitRequest, Announcement, Bulletin, WorshipOrderItem, Profile, UserRole, Member } from '../types';
import { Colors } from '../utils/colors';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { parseBibleRef, lookupGaeyeok, lookupNIV, lookupRVR1960, normalizeRef, normalizeRefEn, normalizeRefEs } from '../utils/bibleRef';
import {
  fetchPendingReports,
  markReportReviewed,
  deleteReportedContent,
  banUser,
  PendingReport,
} from '../utils/moderation';
import Icon, { IconName } from '../components/Icon';

type Props = NativeStackScreenProps<MoreStackParamList, 'Admin'>;
type AdminTab = 'moderation' | 'approvals' | 'prayer' | 'visit' | 'announcements' | 'bulletins' | 'members' | 'settings' | 'events';

interface PendingUser { id: string; email: string; full_name: string | null; created_at: string }

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  created_at?: string;
}

const PASTOR_COLOR = '#7C3AED';
const DEACON_COLOR = '#0369A1';
const MEMBER_COLOR = '#374151';

const ROLE_LABELS: Record<UserRole, { ko: string; en: string; es: string; badge_ko: string; badge_en: string; badge_es: string; color: string }> = {
  pastor:  { ko: '목사/전도사', en: 'Pastor/Minister', es: 'Pastor/Ministro', badge_ko: '목사', badge_en: 'Pastor', badge_es: 'Pastor', color: PASTOR_COLOR },
  deacon:  { ko: '집사/장로',  en: 'Deacon/Elder',    es: 'Diácono/Anciano', badge_ko: '집사', badge_en: 'Deacon', badge_es: 'Diácono', color: DEACON_COLOR },
  member:  { ko: '성도',       en: 'Member',          es: 'Miembro',         badge_ko: '성도', badge_en: 'Member', badge_es: 'Miembro', color: MEMBER_COLOR },
};

function roleLabel(role: UserRole, lang: 'ko' | 'en' | 'es'): string {
  const info = ROLE_LABELS[role];
  return lang === 'en' ? info.en : lang === 'es' ? info.es : info.ko;
}
function roleBadge(role: UserRole, lang: 'ko' | 'en' | 'es'): string {
  const info = ROLE_LABELS[role];
  return lang === 'en' ? info.badge_en : lang === 'es' ? info.badge_es : info.badge_ko;
}

const VISIT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
  completed: { bg: '#D1FAE5', text: '#065F46' },
};

const VISIT_STATUS_LABELS: Record<string, { ko: string; en: string; es: string }> = {
  pending:   { ko: '접수됨', en: 'Received',  es: 'Recibido' },
  confirmed: { ko: '확정됨', en: 'Confirmed', es: 'Confirmado' },
  completed: { ko: '완료됨', en: 'Completed', es: 'Completado' },
};

function visitStatusLabel(status: string, lang: 'ko' | 'en' | 'es'): string {
  const info = VISIT_STATUS_LABELS[status];
  if (!info) return status;
  return lang === 'en' ? info.en : lang === 'es' ? info.es : info.ko;
}

export default function AdminScreen({ navigation }: Props) {
  const { isPastor, user } = useAuth();
  const { lang } = useLanguage();
  const [tab, setTab] = useState<AdminTab>('prayer');

  // ── Prayer ─────────────────────────────────────────────────────────────────
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [prayerLoading, setPrayerLoading] = useState(false);

  // ── Visits ─────────────────────────────────────────────────────────────────
  const [visits, setVisits] = useState<VisitRequest[]>([]);
  const [visitLoading, setVisitLoading] = useState(false);

  // ── Announcements ──────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annModal, setAnnModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annKo, setAnnKo] = useState('');
  const [annEn, setAnnEn] = useState('');
  const [annEs, setAnnEs] = useState('');
  const [annBodyKo, setAnnBodyKo] = useState('');
  const [annBodyEn, setAnnBodyEn] = useState('');
  const [annBodyEs, setAnnBodyEs] = useState('');
  const [annSaving, setAnnSaving] = useState(false);
  const [annLangExpanded, setAnnLangExpanded] = useState(false);

  // ── Bulletins ──────────────────────────────────────────────────────────────
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [bulletinLoading, setBulletinLoading] = useState(false);
  const [bulletinModal, setBulletinModal] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);
  const [bulletinTitle, setBulletinTitle] = useState('');
  const [bulletinDate, setBulletinDate] = useState('');
  const [worshipOrder, setWorshipOrder] = useState<WorshipOrderItem[]>([]);
  const [bulletinAnns, setBulletinAnns] = useState<string[]>([]);
  const [bulletinPrayer, setBulletinPrayer] = useState('');
  const [bulletinSaving, setBulletinSaving] = useState(false);

  // ── Members ────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<Profile[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // ── Events (Calendar) ──────────────────────────────────────────────────────
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evTime, setEvTime] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evSaving, setEvSaving] = useState(false);

  // ── Directory (요람 추가) ──────────────────────────────────────────────────
  const [directoryMembers, setDirectoryMembers] = useState<Set<string>>(new Set());
  const [dirModal, setDirModal] = useState(false);
  const [dirTarget, setDirTarget] = useState<Profile | null>(null);
  const [dirPhone, setDirPhone] = useState('');
  const [dirBirthday, setDirBirthday] = useState('');
  const [dirPhotoUrl, setDirPhotoUrl] = useState('');
  const [dirSaving, setDirSaving] = useState(false);

  // ── App Settings ───────────────────────────────────────────────────────────
  const [verseKo, setVerseKo] = useState('');
  const [verseEn, setVerseEn] = useState('');
  const [verseEs, setVerseEs] = useState('');
  const [verseRef, setVerseRef] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [verseLookupLoading, setVerseLookupLoading] = useState(false);

  // ── Moderation (Apple 1.2) ─────────────────────────────────────────────────
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // ── Pending sign-ups (email confirm ON → pastor approves in-app) ──────────
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);

  // ── Offering Settings ──────────────────────────────────────────────────────
  const [offeringUrl, setOfferingUrl] = useState('');
  const [offeringZelle, setOfferingZelle] = useState('');
  const [offeringVenmo, setOfferingVenmo] = useState('');
  const [offeringCashApp, setOfferingCashApp] = useState('');
  const [offeringSaving, setOfferingSaving] = useState(false);

  // ── Latest sermon (Worship tab) ────────────────────────────────────────────
  const [sermonUrl, setSermonUrl] = useState('');
  const [sermonSaving, setSermonSaving] = useState(false);

  useEffect(() => {
    if (!isPastor) return;
    if (tab === 'moderation') fetchReports();
    if (tab === 'approvals') fetchPending();
    if (tab === 'prayer') fetchPrayers();
    if (tab === 'visit') fetchVisits();
    if (tab === 'announcements') fetchAnnouncements();
    if (tab === 'bulletins') fetchBulletins();
    if (tab === 'members') { fetchMembers(); fetchDirectoryMembers(); }
    if (tab === 'settings') fetchSettings();
    if (tab === 'events') fetchEvents();
  }, [tab, isPastor]);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const data = await fetchPendingReports();
      setReports(data);
    } catch { /* ignore */ }
    setReportsLoading(false);
  }, []);

  async function handleMarkReviewed(r: PendingReport) {
    Alert.alert(
      lang === 'en' ? 'Mark as reviewed?' : lang === 'es' ? '¿Marcar como revisado?' : '검토 완료로 표시할까요?',
      lang === 'en' ? 'The report will be closed without deleting the content.' : lang === 'es' ? 'El reporte se cerrará sin eliminar el contenido.' : '콘텐츠는 삭제하지 않고 신고만 종결됩니다.',
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        {
          text: lang === 'en' ? 'Mark reviewed' : lang === 'es' ? 'Marcar revisado' : '검토 완료',
          onPress: async () => {
            const { error } = await markReportReviewed(r.id, '');
            if (error) { Alert.alert('', error); return; }
            setReports(prev => prev.filter(x => x.id !== r.id));
          },
        },
      ]
    );
  }

  async function handleDeleteContent(r: PendingReport) {
    Alert.alert(
      lang === 'en' ? 'Delete this content?' : lang === 'es' ? '¿Eliminar este contenido?' : '이 콘텐츠를 삭제할까요?',
      lang === 'en' ? 'The content will be permanently removed and all related reports will be closed.' : lang === 'es' ? 'El contenido se eliminará permanentemente y todos los reportes relacionados se cerrarán.' : '콘텐츠가 영구 삭제되고 관련된 모든 신고가 종결됩니다.',
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        {
          text: lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteReportedContent(r.id, r.content_type, r.content_id);
            if (error) { Alert.alert('', error); return; }
            setReports(prev => prev.filter(x => x.content_id !== r.content_id));
          },
        },
      ]
    );
  }

  async function handleBanUser(r: PendingReport) {
    if (!r.reported_user_id) return;
    const name = r.reported_user_name ?? r.reported_user_id.slice(0, 8);
    Alert.alert(
      lang === 'en' ? `Ban ${name}?` : lang === 'es' ? `¿Banear a ${name}?` : `${name} 정지할까요?`,
      lang === 'en' ? 'The user will be signed out and blocked from posting, commenting, or messaging.' : lang === 'es' ? 'El usuario será desconectado y no podrá publicar, comentar ni enviar mensajes.' : '해당 유저는 로그아웃되고 게시글·댓글·메시지 작성이 차단됩니다.',
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        {
          text: lang === 'en' ? 'Ban' : lang === 'es' ? 'Banear' : '정지',
          style: 'destructive',
          onPress: async () => {
            const reason = `Report ${r.id.slice(0, 8)} — reason: ${r.reason}`;
            const { error } = await banUser(r.reported_user_id!, reason);
            if (error) { Alert.alert('', error); return; }
            // Refresh reports so the "banned" badge appears
            fetchReports();
            Alert.alert('✓', lang === 'en' ? 'User banned.' : lang === 'es' ? 'Usuario baneado.' : '유저가 정지되었습니다.');
          },
        },
      ]
    );
  }

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const fetchPrayers = useCallback(async () => {
    setPrayerLoading(true);
    try {
      const { data } = await supabase
        .from('prayer_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setPrayers(data as PrayerRequest[]);
    } catch { /* ignore */ }
    setPrayerLoading(false);
  }, []);

  const fetchVisits = useCallback(async () => {
    setVisitLoading(true);
    try {
      const { data } = await supabase
        .from('visit_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setVisits(data as VisitRequest[]);
    } catch { /* ignore */ }
    setVisitLoading(false);
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setAnnLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAnnouncements(data as Announcement[]);
    setAnnLoading(false);
  }, []);

  const fetchPending = useCallback(async () => {
    setPendingLoading(true);
    const { data } = await supabase.rpc('admin_list_pending_users');
    setPending((data ?? []) as PendingUser[]);
    setPendingLoading(false);
  }, []);

  // 배지 숫자용 — 탭 진입 전에도 대기 인원을 보여준다
  useEffect(() => { if (isPastor) fetchPending(); }, [isPastor, fetchPending]);

  async function approveUser(u: PendingUser) {
    setPendingBusy(u.id);
    const { error } = await supabase.rpc('admin_approve_user', { target_id: u.id });
    setPendingBusy(null);
    if (error) { Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message); return; }
    setPending(prev => prev.filter(p => p.id !== u.id));
    fetchMembers();
  }

  function rejectUser(u: PendingUser) {
    Alert.alert(
      lang === 'en' ? 'Reject sign-up?' : lang === 'es' ? '¿Rechazar registro?' : '가입을 거절할까요?',
      lang === 'en' ? `${u.email} will be deleted and can sign up again later.` : lang === 'es' ? `${u.email} será eliminado y podrá registrarse de nuevo.` : `${u.email} 계정이 삭제됩니다. 나중에 다시 가입할 수 있습니다.`,
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        { text: lang === 'en' ? 'Reject' : lang === 'es' ? 'Rechazar' : '거절', style: 'destructive', onPress: async () => {
          setPendingBusy(u.id);
          const { error } = await supabase.rpc('admin_reject_user', { target_id: u.id });
          setPendingBusy(null);
          if (error) { Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message); return; }
          setPending(prev => prev.filter(p => p.id !== u.id));
        }},
      ]
    );
  }

  const fetchMembers = useCallback(async () => {
    setMemberLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, created_at')
        .order('created_at', { ascending: true });
      if (data) {
        const sorted = [...data].sort((a, b) => {
          const order: Record<string, number> = { pastor: 0, deacon: 1, member: 2 };
          return (order[a.role ?? 'member'] ?? 2) - (order[b.role ?? 'member'] ?? 2);
        });
        setMembers(sorted as Profile[]);
      }
    } catch { /* ignore */ }
    setMemberLoading(false);
  }, []);

  const fetchDirectoryMembers = useCallback(async () => {
    const { data } = await supabase.from('members').select('id');
    if (data) setDirectoryMembers(new Set(data.map((m: any) => m.id)));
  }, []);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      if (data) setEvents(data as CalendarEvent[]);
    } catch { /* table may not exist yet */ }
    finally { setEventsLoading(false); }
  }, []);

  async function saveEvent() {
    if (!evTitle.trim() || !evDate.trim()) {
      Alert.alert('', lang === 'en' ? 'Please enter title and date.' : lang === 'es' ? 'Por favor ingrese título y fecha.' : '제목과 날짜를 입력해 주세요.');
      return;
    }
    setEvSaving(true);
    const { error } = await supabase.from('events').insert({
      title: evTitle.trim(),
      date: evDate.trim(),
      time: evTime.trim() || null,
      location: evLocation.trim() || null,
      description: evDesc.trim() || null,
    });
    setEvSaving(false);
    if (error) Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message);
    else {
      setEventModal(false);
      setEvTitle(''); setEvDate(''); setEvTime(''); setEvLocation(''); setEvDesc('');
      fetchEvents();
    }
  }

  async function deleteEvent(id: string) {
    Alert.alert(
      lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제',
      lang === 'en' ? 'Delete this event?' : lang === 'es' ? '¿Eliminar este evento?' : '이 일정을 삭제하시겠습니까?',
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        { text: lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제', style: 'destructive', onPress: async () => {
          await supabase.from('events').delete().eq('id', id);
          fetchEvents();
        }},
      ]
    );
  }

  async function addToDirectory() {
    if (!dirTarget) return;
    setDirSaving(true);
    const { error } = await supabase.from('members').insert({
      id: dirTarget.id,
      name: dirTarget.full_name,
      email: dirTarget.email ?? null,
      phone: dirPhone.trim() || null,
      birthday: dirBirthday.trim() || null,
      photo_url: dirPhotoUrl.trim() || null,
    });
    setDirSaving(false);
    if (error) {
      if (error.code === '23505') Alert.alert('', lang === 'en' ? 'This member is already in the directory.' : lang === 'es' ? 'Este miembro ya está en el directorio.' : '이미 요람에 추가된 성도입니다.');
      else Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message);
    } else {
      setDirModal(false);
      setDirTarget(null); setDirPhone(''); setDirBirthday(''); setDirPhotoUrl('');
      fetchDirectoryMembers();
      Alert.alert('✓', lang === 'en' ? `${dirTarget.full_name} has been added to the directory.` : lang === 'es' ? `${dirTarget.full_name} ha sido añadido al directorio.` : `${dirTarget.full_name}을(를) 요람에 추가했습니다.`);
    }
  }

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['weekly_verse', 'offering_url', 'offering_zelle', 'offering_venmo', 'offering_cash_app', 'latest_sermon_url']);

    if (data) {
      const map: Record<string, string> = {};
      data.forEach((row) => { map[row.key] = row.value ?? ''; });

      if (map['weekly_verse']) {
        try {
          const v = JSON.parse(map['weekly_verse']);
          setVerseKo(v.ko ?? '');
          setVerseEn(v.en ?? '');
          setVerseEs(v.es ?? '');
          setVerseRef(v.ref ?? '');
        } catch { /* ignore */ }
      }
      setOfferingUrl(map['offering_url'] ?? '');
      setOfferingZelle(map['offering_zelle'] ?? '');
      setOfferingVenmo(map['offering_venmo'] ?? '');
      setOfferingCashApp(map['offering_cash_app'] ?? '');
      setSermonUrl(map['latest_sermon_url'] ?? '');
    }
    setSettingsLoading(false);
  }, []);

  const fetchBulletins = useCallback(async () => {
    setBulletinLoading(true);
    const { data } = await supabase
      .from('bulletins')
      .select('*')
      .order('date', { ascending: false });
    if (data) setBulletins(data as Bulletin[]);
    setBulletinLoading(false);
  }, []);

  // ── Bulletin actions ────────────────────────────────────────────────────────
  function openBulletinModal(item?: Bulletin) {
    if (item) {
      setEditingBulletin(item);
      setBulletinTitle(item.title);
      setBulletinDate(item.date);
      setWorshipOrder(item.worship_order ?? []);
      setBulletinAnns(item.announcements ?? []);
      setBulletinPrayer(item.prayer_requests ?? '');
    } else {
      setEditingBulletin(null);
      setBulletinTitle('');
      setBulletinDate('');
      setWorshipOrder([
        { role: lang === 'en' ? 'MC' : lang === 'es' ? 'Presentador' : '사회', content: '' },
        { role: lang === 'en' ? 'Praise' : lang === 'es' ? 'Alabanza' : '찬양', content: '' },
        { role: lang === 'en' ? 'Prayer' : lang === 'es' ? 'Oración' : '기도', content: '' },
        { role: lang === 'en' ? 'Scripture Reading' : lang === 'es' ? 'Lectura Bíblica' : '성경봉독', content: '' },
        { role: lang === 'en' ? 'Sermon' : lang === 'es' ? 'Sermón' : '설교', content: '' },
        { role: lang === 'en' ? 'Offering' : lang === 'es' ? 'Ofrenda' : '헌금', content: '' },
        { role: lang === 'en' ? 'Benediction' : lang === 'es' ? 'Bendición' : '축도', content: '' },
      ]);
      setBulletinAnns(['']);
      setBulletinPrayer('');
    }
    setBulletinModal(true);
  }

  function updateWorshipItem(index: number, field: 'role' | 'content', value: string) {
    setWorshipOrder(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }
  function addWorshipItem() {
    setWorshipOrder(prev => [...prev, { role: '', content: '' }]);
  }
  function removeWorshipItem(index: number) {
    setWorshipOrder(prev => prev.filter((_, i) => i !== index));
  }

  function updateAnnItem(index: number, value: string) {
    setBulletinAnns(prev => prev.map((item, i) => i === index ? value : item));
  }
  function addAnnItem() {
    setBulletinAnns(prev => [...prev, '']);
  }
  function removeAnnItem(index: number) {
    setBulletinAnns(prev => prev.filter((_, i) => i !== index));
  }

  async function saveBulletin() {
    if (!bulletinTitle.trim()) { Alert.alert('', lang === 'en' ? 'Please enter the bulletin title.' : lang === 'es' ? 'Por favor ingrese el título del boletín.' : '주보 제목을 입력해 주세요.'); return; }
    if (!bulletinDate.trim()) { Alert.alert('', lang === 'en' ? 'Please enter the date. (e.g. 2026-04-20)' : lang === 'es' ? 'Por favor ingrese la fecha. (ej. 2026-04-20)' : '날짜를 입력해 주세요. (예: 2026-04-20)'); return; }
    setBulletinSaving(true);

    const payload = {
      title: bulletinTitle.trim(),
      date: bulletinDate.trim(),
      worship_order: worshipOrder.filter(w => w.role.trim() || w.content.trim()),
      announcements: bulletinAnns.map(a => a.trim()).filter(Boolean),
      prayer_requests: bulletinPrayer.trim(),
    };

    if (editingBulletin) {
      const { data, error } = await supabase
        .from('bulletins').update(payload).eq('id', editingBulletin.id).select().single();
      if (error) { setBulletinSaving(false); Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', lang === 'en' ? 'Failed to save.' : lang === 'es' ? 'Error al guardar.' : '저장에 실패했습니다.'); return; }
      if (data) setBulletins(prev => prev.map(b => b.id === editingBulletin.id ? data as Bulletin : b));
    } else {
      const { data, error } = await supabase
        .from('bulletins').insert(payload).select().single();
      if (error) { setBulletinSaving(false); Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', lang === 'en' ? 'Failed to save.' : lang === 'es' ? 'Error al guardar.' : '저장에 실패했습니다.'); return; }
      if (data) setBulletins(prev => [data as Bulletin, ...prev]);
    }

    setBulletinSaving(false);
    setBulletinModal(false);
  }

  async function deleteBulletin(item: Bulletin) {
    Alert.alert(
      lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제',
      lang === 'en' ? `Delete "${item.title}"?` : lang === 'es' ? `¿Eliminar "${item.title}"?` : `"${item.title}"을 삭제하시겠습니까?`,
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        {
          text: lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제', style: 'destructive',
          onPress: async () => {
            await supabase.from('bulletins').delete().eq('id', item.id);
            setBulletins(prev => prev.filter(b => b.id !== item.id));
          },
        },
      ]
    );
  }

  // ── Prayer actions ─────────────────────────────────────────────────────────
  async function deletePrayer(id: string) {
    Alert.alert(
      lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제',
      lang === 'en' ? 'Delete this prayer request?' : lang === 'es' ? '¿Eliminar esta petición de oración?' : '이 기도요청을 삭제하시겠습니까?',
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        {
          text: lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('prayer_requests').delete().eq('id', id);
            if (error) { Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message); return; }
            setPrayers(prev => prev.filter(p => p.id !== id));
          },
        },
      ]
    );
  }

  // ── Visit actions ──────────────────────────────────────────────────────────
  async function updateVisitStatus(id: string, status: 'pending' | 'confirmed' | 'completed') {
    const { error } = await supabase.from('visit_requests').update({ status }).eq('id', id);
    if (error) { Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message); return; }
    setVisits(prev => prev.map(v => v.id === id ? { ...v, status } : v));
  }

  async function deleteVisit(id: string) {
    Alert.alert(
      lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제',
      lang === 'en' ? 'Delete this visit request?' : lang === 'es' ? '¿Eliminar esta solicitud de visita?' : '이 심방요청을 삭제하시겠습니까?',
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        {
          text: lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('visit_requests').delete().eq('id', id);
            if (error) { Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message); return; }
            setVisits(prev => prev.filter(v => v.id !== id));
          },
        },
      ]
    );
  }

  // ── Announcement actions ───────────────────────────────────────────────────
  function openAnnModal(ann?: Announcement) {
    if (ann) {
      setEditingAnn(ann);
      setAnnKo(ann.title_ko); setAnnEn(ann.title_en ?? ''); setAnnEs(ann.title_es ?? '');
      setAnnBodyKo(ann.body_ko); setAnnBodyEn(ann.body_en ?? ''); setAnnBodyEs(ann.body_es ?? '');
      setAnnLangExpanded(!!(ann.title_en || ann.title_es));
    } else {
      setEditingAnn(null);
      setAnnKo(''); setAnnEn(''); setAnnEs('');
      setAnnBodyKo(''); setAnnBodyEn(''); setAnnBodyEs('');
      setAnnLangExpanded(false);
    }
    setAnnModal(true);
  }

  async function saveAnnouncement() {
    if (!annKo.trim()) { Alert.alert('', lang === 'en' ? 'Please enter the Korean title.' : lang === 'es' ? 'Por favor ingrese el título en coreano.' : '한국어 제목을 입력해 주세요.'); return; }
    setAnnSaving(true);
    const payload = {
      title_ko: annKo.trim(), title_en: annEn.trim(), title_es: annEs.trim(),
      body_ko: annBodyKo.trim(), body_en: annBodyEn.trim(), body_es: annBodyEs.trim(),
    };
    if (editingAnn) {
      const { data, error } = await supabase.from('announcements').update(payload).eq('id', editingAnn.id).select().single();
      if (error) { setAnnSaving(false); Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message); return; }
      if (data) setAnnouncements(prev => prev.map(a => a.id === editingAnn.id ? data as Announcement : a));
    } else {
      const { data, error } = await supabase.from('announcements').insert(payload).select().single();
      if (error) { setAnnSaving(false); Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message); return; }
      if (data) setAnnouncements(prev => [data as Announcement, ...prev]);
    }
    setAnnSaving(false);
    setAnnModal(false);
    Alert.alert('✓', editingAnn
      ? (lang === 'en' ? 'Announcement updated.' : lang === 'es' ? 'Aviso actualizado.' : '공지사항이 수정되었습니다.')
      : (lang === 'en' ? 'Announcement added.' : lang === 'es' ? 'Aviso añadido.' : '공지사항이 추가되었습니다.'));
  }

  async function deleteAnnouncement(id: string) {
    Alert.alert(
      lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제',
      lang === 'en' ? 'Delete this announcement?' : lang === 'es' ? '¿Eliminar este aviso?' : '이 공지사항을 삭제하시겠습니까?',
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        {
          text: lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제', style: 'destructive',
          onPress: async () => {
            await supabase.from('announcements').delete().eq('id', id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
          },
        },
      ]
    );
  }

  // ── Member role change ─────────────────────────────────────────────────────
  function changeRole(member: Profile) {
    if (member.id === user?.id) {
      Alert.alert('', lang === 'en' ? 'You cannot change your own role.' : lang === 'es' ? 'No puede cambiar su propio rol.' : '자신의 역할은 변경할 수 없습니다.');
      return;
    }
    const currentLabel = roleLabel(member.role ?? 'member', lang);
    Alert.alert(
      `${member.full_name}`,
      lang === 'en' ? `Current role: ${currentLabel}\nChange role?` : lang === 'es' ? `Rol actual: ${currentLabel}\n¿Cambiar el rol?` : `현재 역할: ${currentLabel}\n역할을 변경하시겠습니까?`,
      [
        { text: lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소', style: 'cancel' },
        {
          text: lang === 'en' ? 'Pastor/Minister' : lang === 'es' ? 'Pastor/Ministro' : '목사/전도사',
          onPress: () => updateRole(member.id, 'pastor'),
        },
        {
          text: lang === 'en' ? 'Deacon/Elder' : lang === 'es' ? 'Diácono/Anciano' : '집사/장로',
          onPress: () => updateRole(member.id, 'deacon'),
        },
        {
          text: lang === 'en' ? 'Member' : lang === 'es' ? 'Miembro' : '성도',
          onPress: () => updateRole(member.id, 'member'),
        },
      ]
    );
  }

  async function updateRole(memberId: string, newRole: UserRole) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, is_admin: newRole === 'pastor' })
      .eq('id', memberId);
    if (error) {
      Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', lang === 'en' ? 'Failed to change role.' : lang === 'es' ? 'Error al cambiar rol.' : '역할 변경에 실패했습니다.');
      return;
    }
    setMembers(prev => {
      const updated = prev.map(m => m.id === memberId ? { ...m, role: newRole } : m);
      return [...updated].sort((a, b) => {
        const order: Record<string, number> = { pastor: 0, deacon: 1, member: 2 };
        return (order[a.role ?? 'member'] ?? 2) - (order[b.role ?? 'member'] ?? 2);
      });
    });
  }

  // ── 성경 구절 자동 채우기 ─────────────────────────────────────────────────────
  async function autoFillVerse() {
    const ref = parseBibleRef(verseRef);
    if (!ref) {
      Alert.alert(
        lang === 'en' ? 'Reference not recognized' : lang === 'es' ? 'Referencia no reconocida' : '구절 인식 실패',
        lang === 'en' ? 'e.g. John 3:16 or 요한복음 3:16\nRanges are supported: Romans 8:28-30' : lang === 'es' ? 'ej. John 3:16 o 요한복음 3:16\nSe admiten rangos: Romans 8:28-30' : '예) 요한복음 3:16  또는  John 3:16\n구절 범위도 가능합니다: 로마서 8:28-30'
      );
      return;
    }
    setVerseLookupLoading(true);
    const ko = lookupGaeyeok(ref);
    const en = lookupNIV(ref);
    const es = lookupRVR1960(ref);
    if (ko) setVerseKo(ko);
    if (en) setVerseEn(en);
    if (es) setVerseEs(es);
    setVerseRef(normalizeRef(ref));
    setVerseLookupLoading(false);
    if (!ko && !en) Alert.alert(
      lang === 'en' ? 'Verse not found' : lang === 'es' ? 'Versículo no encontrado' : '구절을 찾을 수 없습니다',
      lang === 'en' ? `"${verseRef}" — please check the book name and chapter:verse.` : lang === 'es' ? `"${verseRef}" — verifique el nombre del libro y capítulo:versículo.` : `"${verseRef}" — 책 이름과 장:절을 확인해 주세요.`
    );
  }

  // ── Settings save ──────────────────────────────────────────────────────────
  async function saveSettings() {
    if (!verseKo.trim()) { Alert.alert('', lang === 'en' ? 'Please enter the Korean verse text.' : lang === 'es' ? 'Por favor ingrese el versículo en coreano.' : '한국어 말씀을 입력해 주세요.'); return; }
    setSettingsSaving(true);
    const parsedRef = parseBibleRef(verseRef);
    const refEn = parsedRef ? normalizeRefEn(parsedRef) : '';
    const refEs = parsedRef ? normalizeRefEs(parsedRef) : '';
    const { error } = await supabase.from('app_settings').upsert({
      key: 'weekly_verse',
      value: JSON.stringify({ ko: verseKo.trim(), en: verseEn.trim(), es: verseEs.trim(), ref: verseRef.trim(), ref_en: refEn, ref_es: refEs }),
    }, { onConflict: 'key' });
    setSettingsSaving(false);
    if (error) Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', lang === 'en' ? `Save failed: ${error.message}` : lang === 'es' ? `Error al guardar: ${error.message}` : `저장 실패: ${error.message}`);
    else Alert.alert(
      lang === 'en' ? '✓ Saved' : lang === 'es' ? '✓ Guardado' : '✓ 저장 완료',
      lang === 'en' ? 'This week\'s verse has been updated.\nIt will appear on the home screen immediately.' : lang === 'es' ? 'El versículo de esta semana ha sido actualizado.\nAparecerá en la pantalla de inicio inmediatamente.' : '이번주 말씀이 업데이트되었습니다.\n홈 화면에 바로 반영됩니다.'
    );
  }

  async function saveSermonUrl() {
    const v = sermonUrl.trim();
    if (v && !/(?:v=|\/live\/|\/shorts\/|\/embed\/|youtu\.be\/)[A-Za-z0-9_-]{11}/.test(v)) {
      Alert.alert('', lang === 'en' ? 'Please paste a YouTube video link.' : lang === 'es' ? 'Pegue un enlace de video de YouTube.' : 'YouTube 영상 링크를 붙여넣어 주세요.');
      return;
    }
    setSermonSaving(true);
    const { error } = await supabase.from('app_settings').upsert({ key: 'latest_sermon_url', value: v }, { onConflict: 'key' });
    setSermonSaving(false);
    if (error) Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', error.message);
    else Alert.alert(
      lang === 'en' ? '✓ Saved' : lang === 'es' ? '✓ Guardado' : '✓ 저장 완료',
      lang === 'en' ? 'The Worship tab now shows this video.' : lang === 'es' ? 'La pestaña Culto ahora muestra este video.' : '예배 탭에 이 영상이 표시됩니다.'
    );
  }

  async function saveOfferingSettings() {
    setOfferingSaving(true);
    const rows = [
      { key: 'offering_url',      value: offeringUrl.trim() },
      { key: 'offering_zelle',    value: offeringZelle.trim() },
      { key: 'offering_venmo',    value: offeringVenmo.trim() },
      { key: 'offering_cash_app', value: offeringCashApp.trim() },
    ];
    const results = await Promise.all(rows.map(row => supabase.from('app_settings').upsert(row, { onConflict: 'key' })));
    setOfferingSaving(false);
    const err = results.find(r => r.error);
    if (err?.error) Alert.alert(lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류', lang === 'en' ? `Save failed: ${err.error.message}` : lang === 'es' ? `Error al guardar: ${err.error.message}` : `저장 실패: ${err.error.message}`);
    else Alert.alert(
      lang === 'en' ? '✓ Saved' : lang === 'es' ? '✓ Guardado' : '✓ 저장 완료',
      lang === 'en' ? 'Offering settings have been updated.' : lang === 'es' ? 'La configuración de ofrendas ha sido actualizada.' : '헌금 설정이 업데이트되었습니다.'
    );
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }

  // ── Access denied ──────────────────────────────────────────────────────────
  if (!isPastor) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{lang === 'en' ? 'Admin' : lang === 'es' ? 'Administrador' : '관리자'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.denied}>
          <Text style={styles.deniedEmoji}>🔒</Text>
          <Text style={styles.deniedTitle}>{lang === 'en' ? 'Pastors Only' : lang === 'es' ? 'Solo Pastores' : '목회자 전용'}</Text>
          <Text style={styles.deniedDesc}>
            {lang === 'en' ? 'This page is only accessible to pastors and ministers.' : lang === 'es' ? 'Esta página solo es accesible para pastores y ministros.' : '이 페이지는 목사 및 전도사만 접근할 수 있습니다.'}{'\n'}
            {lang === 'en' ? 'Please contact the senior pastor.' : lang === 'es' ? 'Por favor contacte al pastor principal.' : '담임목사에게 문의하세요.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter(m =>
        m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email?.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : members;

  const TABS: { key: AdminTab; label: string; emoji: string; icon?: IconName; badge?: number }[] = [
    { key: 'moderation',    label: lang === 'en' ? 'Moderation'    : lang === 'es' ? 'Moderación'   : '신고관리', emoji: '🛡️', icon: 'admin-moderation', badge: reports.length || undefined },
    { key: 'approvals',     label: lang === 'en' ? 'Approvals'     : lang === 'es' ? 'Aprobaciones' : '가입승인', emoji: '✅', badge: pending.length || undefined },
    { key: 'prayer',        label: lang === 'en' ? 'Prayer'        : lang === 'es' ? 'Oración'      : '기도요청', emoji: '🙏', icon: 'admin-prayer' },
    { key: 'visit',         label: lang === 'en' ? 'Visits'        : lang === 'es' ? 'Visitas'      : '심방요청', emoji: '🏠', icon: 'admin-visits' },
    { key: 'announcements', label: lang === 'en' ? 'Announcements' : lang === 'es' ? 'Avisos'       : '공지사항', emoji: '📢', icon: 'admin-announce' },
    { key: 'bulletins',     label: lang === 'en' ? 'Bulletins'     : lang === 'es' ? 'Boletines'    : '주보관리', emoji: '📋', icon: 'admin-bulletins' },
    { key: 'events',        label: lang === 'en' ? 'Events'        : lang === 'es' ? 'Eventos'      : '일정관리', emoji: '📅', icon: 'admin-events' },
    { key: 'members',       label: lang === 'en' ? 'Members'       : lang === 'es' ? 'Miembros'     : '회원관리', emoji: '👥', icon: 'admin-members' },
    { key: 'settings',      label: lang === 'en' ? 'Settings'      : lang === 'es' ? 'Ajustes'      : '앱설정',   emoji: '⚙️', icon: 'admin-settings' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{lang === 'en' ? 'Admin Panel' : lang === 'es' ? 'Panel de Administración' : '관리자 패널'}</Text>
          <View style={styles.pastorBadge}>
            <Text style={styles.pastorBadgeText}>{lang === 'en' ? 'Pastors Only' : lang === 'es' ? 'Solo Pastores' : '목회자 전용'}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* 탭 바 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarWrap}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.tabBtn, tab === item.key && styles.tabBtnActive]}
            onPress={() => setTab(item.key)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {item.icon
                ? <Icon name={item.icon} size={20} tintColor={tab === item.key ? Colors.primary : Colors.text.light} />
                : <Text style={styles.tabEmoji}>{item.emoji}</Text>}
              {item.badge ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── 신고관리 (Moderation) 탭 ─────────────────────────────────────────── */}
      {tab === 'moderation' && (
        reportsLoading ? <LoadingView /> : (
          <FlatList
            data={reports}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            refreshing={reportsLoading}
            onRefresh={fetchReports}
            renderItem={({ item }) => {
              const typeLabel: Record<string, string> = {
                post:    lang === 'en' ? 'Post'    : lang === 'es' ? 'Publicación' : '게시글',
                photo:   lang === 'en' ? 'Photo'   : lang === 'es' ? 'Foto'        : '사진',
                comment: lang === 'en' ? 'Comment' : lang === 'es' ? 'Comentario'  : '댓글',
                message: lang === 'en' ? 'Chat'    : lang === 'es' ? 'Chat'        : '채팅',
                prayer:  lang === 'en' ? 'Prayer'  : lang === 'es' ? 'Oración'     : '기도요청',
              };
              const reasonLabel: Record<string, string> = {
                spam:              lang === 'en' ? 'Spam'              : lang === 'es' ? 'Spam'                    : '스팸',
                hate:              lang === 'en' ? 'Hate speech'       : lang === 'es' ? 'Discurso de odio'        : '혐오',
                harassment:        lang === 'en' ? 'Harassment'        : lang === 'es' ? 'Acoso'                   : '괴롭힘',
                sexual:            lang === 'en' ? 'Sexual content'    : lang === 'es' ? 'Contenido sexual'        : '음란',
                violence:          lang === 'en' ? 'Violence'          : lang === 'es' ? 'Violencia'               : '폭력',
                other:             lang === 'en' ? 'Other'             : lang === 'es' ? 'Otro'                    : '기타',
                blocked_by_user:   lang === 'en' ? 'User was blocked'  : lang === 'es' ? 'Bloqueo de usuario'      : '유저 차단됨',
                hidden_by_user:    lang === 'en' ? 'Hidden by user'    : lang === 'es' ? 'Ocultado por usuario'    : '숨김 처리됨',
              };
              return (
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <View style={styles.modTypeBadge}>
                      <Text style={styles.modTypeBadgeText}>{typeLabel[item.content_type] ?? item.content_type}</Text>
                    </View>
                    <View style={styles.modReasonBadge}>
                      <Text style={styles.modReasonBadgeText}>{reasonLabel[item.reason] ?? item.reason}</Text>
                    </View>
                    {item.reported_user_banned ? (
                      <View style={styles.modBannedBadge}>
                        <Text style={styles.modBannedBadgeText}>{lang === 'en' ? 'Banned' : lang === 'es' ? 'Baneado' : '정지됨'}</Text>
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }} />
                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  </View>

                  {item.content_preview ? (
                    <View style={styles.modPreview}>
                      <Text style={styles.modPreviewText} numberOfLines={4}>
                        {item.content_preview}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.modPreview}>
                      <Text style={[styles.modPreviewText, { fontStyle: 'italic', color: Colors.text.light }]}>
                        {lang === 'en' ? '(content unavailable — already deleted)' : lang === 'es' ? '(contenido no disponible — ya eliminado)' : '(콘텐츠 없음 — 이미 삭제됨)'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modMeta}>
                    <Text style={styles.modMetaText}>
                      {lang === 'en' ? 'Reporter: ' : lang === 'es' ? 'Reportero: ' : '신고자: '}
                      <Text style={{ fontWeight: '700' }}>{item.reporter_name ?? item.reporter_id.slice(0, 8)}</Text>
                    </Text>
                    {item.reported_user_id ? (
                      <Text style={styles.modMetaText}>
                        {lang === 'en' ? 'Author: ' : lang === 'es' ? 'Autor: ' : '작성자: '}
                        <Text style={{ fontWeight: '700' }}>{item.reported_user_name ?? item.reported_user_id.slice(0, 8)}</Text>
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.modActions}>
                    <TouchableOpacity style={styles.modActionSoft} onPress={() => handleMarkReviewed(item)}>
                      <Text style={styles.modActionSoftText}>{lang === 'en' ? '✓ Reviewed' : lang === 'es' ? '✓ Revisado' : '✓ 검토완료'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modActionDanger} onPress={() => handleDeleteContent(item)}>
                      <Text style={styles.modActionDangerText}>{lang === 'en' ? '🗑 Remove content' : lang === 'es' ? '🗑 Eliminar' : '🗑 콘텐츠 삭제'}</Text>
                    </TouchableOpacity>
                    {item.reported_user_id && !item.reported_user_banned ? (
                      <TouchableOpacity style={styles.modActionBan} onPress={() => handleBanUser(item)}>
                        <Text style={styles.modActionBanText}>{lang === 'en' ? '🚫 Ban user' : lang === 'es' ? '🚫 Banear' : '🚫 유저정지'}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyView
                emoji="🛡️"
                text={lang === 'en' ? 'No pending reports. All caught up!' : lang === 'es' ? 'No hay reportes pendientes. ¡Todo al día!' : '대기 중인 신고가 없습니다. 모두 처리 완료!'}
              />
            }
          />
        )
      )}

      {/* ── 기도요청 탭 ──────────────────────────────────────────────────────── */}
      {/* ── 가입승인 (Approvals) 탭 ─────────────────────────────────────────── */}
      {tab === 'approvals' && (
        pendingLoading ? <LoadingView /> : (
          <FlatList
            data={pending}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            refreshing={pendingLoading}
            onRefresh={fetchPending}
            ListHeaderComponent={
              <Text style={styles.settingsHint}>
                {lang === 'en' ? 'New sign-ups wait here until a pastor approves them. Approved members can sign in right away.'
                 : lang === 'es' ? 'Los nuevos registros esperan aquí hasta que un pastor los apruebe. Los aprobados pueden iniciar sesión de inmediato.'
                 : '새로 가입한 분들은 목회자가 승인하기 전까지 여기서 대기합니다. 승인하면 바로 로그인할 수 있습니다.'}
              </Text>
            }
            ListEmptyComponent={<EmptyView emoji="✅" text={lang === 'en' ? 'No sign-ups waiting for approval.' : lang === 'es' ? 'No hay registros pendientes.' : '승인 대기 중인 가입이 없습니다.'} />}
            renderItem={({ item }) => {
              const busy = pendingBusy === item.id;
              return (
                <View style={styles.card}>
                  <View style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: Colors.secondary + '30' }]}>
                      <Text style={[styles.memberAvatarText, { color: '#92400E' }]}>{(item.full_name ?? item.email ?? '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{item.full_name ?? (lang === 'en' ? '(no name)' : lang === 'es' ? '(sin nombre)' : '(이름 없음)')}</Text>
                      <Text style={styles.memberEmail}>{item.email}</Text>
                      <Text style={styles.memberJoined}>{lang === 'en' ? 'Requested: ' : lang === 'es' ? 'Solicitado: ' : '신청일: '}{formatDate(item.created_at)}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                      style={[styles.saveBtn, { flex: 1, marginTop: 0, backgroundColor: '#059669' }, busy && styles.saveBtnDisabled]}
                      onPress={() => approveUser(item)} disabled={busy}
                    >
                      {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>{lang === 'en' ? '✓ Approve' : lang === 'es' ? '✓ Aprobar' : '✓ 승인'}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, { flex: 1, marginTop: 0, backgroundColor: '#DC2626' }, busy && styles.saveBtnDisabled]}
                      onPress={() => rejectUser(item)} disabled={busy}
                    >
                      <Text style={styles.saveBtnText}>{lang === 'en' ? 'Reject' : lang === 'es' ? 'Rechazar' : '거절'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )
      )}

      {tab === 'prayer' && (
        prayerLoading ? <LoadingView /> : (
          <FlatList
            data={prayers}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardName}>{item.author_name}</Text>
                    {item.is_anonymous && <AnonBadge lang={lang} />}
                  </View>
                  <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={styles.cardBody}>{item.content}</Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deletePrayer(item.id)}>
                  <Text style={styles.deleteBtnText}>{lang === 'en' ? '🗑 Delete' : lang === 'es' ? '🗑 Eliminar' : '🗑 삭제'}</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<EmptyView emoji="🙏" text={lang === 'en' ? 'No prayer requests.' : lang === 'es' ? 'No hay peticiones de oración.' : '기도요청이 없습니다.'} />}
          />
        )
      )}

      {/* ── 심방요청 탭 ──────────────────────────────────────────────────────── */}
      {tab === 'visit' && (
        visitLoading ? <LoadingView /> : (
          <FlatList
            data={visits}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const status = item.status ?? 'pending';
              const statusColors = VISIT_STATUS_COLORS[status];
              const statusLabel = visitStatusLabel(status, lang);
              return (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>{statusLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.visitMeta}>
                    <Text style={styles.visitMetaText}>📅 {item.date}</Text>
                    <Text style={styles.visitMetaText}>🕐 {item.time}</Text>
                    {item.phone ? <Text style={styles.visitMetaText}>📞 {item.phone}</Text> : null}
                  </View>
                  {item.note ? <Text style={styles.cardBody}>{item.note}</Text> : null}
                  <View style={styles.statusRow}>
                    {(['pending', 'confirmed', 'completed'] as const).map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusBtn, status === s && styles.statusBtnActive]}
                        onPress={() => updateVisitStatus(item.id, s)}
                      >
                        <Text style={[styles.statusBtnText, status === s && styles.statusBtnTextActive]}>
                          {visitStatusLabel(s, lang)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteVisit(item.id)}>
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<EmptyView emoji="🏠" text={lang === 'en' ? 'No visit requests.' : lang === 'es' ? 'No hay solicitudes de visita.' : '심방요청이 없습니다.'} />}
          />
        )
      )}

      {/* ── 공지사항 탭 ──────────────────────────────────────────────────────── */}
      {tab === 'announcements' && (
        <>
          <View style={styles.addRow}>
            <TouchableOpacity style={styles.addBtn} onPress={() => openAnnModal()}>
              <Text style={styles.addBtnText}>{lang === 'en' ? '+ Add Announcement' : lang === 'es' ? '+ Añadir Aviso' : '+ 공지사항 추가'}</Text>
            </TouchableOpacity>
          </View>
          {annLoading ? <LoadingView /> : (
            <FlatList
              data={announcements}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const primaryTitle = lang === 'en' ? (item.title_en || item.title_ko) : lang === 'es' ? (item.title_es || item.title_ko) : (item.title_ko || item.title_en);
                const secondaryTitle = lang === 'en' ? (item.title_ko && item.title_ko !== primaryTitle ? item.title_ko : null) : lang === 'es' ? (item.title_ko && item.title_ko !== primaryTitle ? item.title_ko : null) : (item.title_en && item.title_en !== primaryTitle ? item.title_en : null);
                const primaryBody = lang === 'en' ? (item.body_en || item.body_ko) : lang === 'es' ? (item.body_es || item.body_ko) : (item.body_ko || item.body_en);
                return (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName} numberOfLines={1}>{primaryTitle}</Text>
                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  {secondaryTitle ? <Text style={styles.cardSub} numberOfLines={1}>{secondaryTitle}</Text> : null}
                  {primaryBody ? <Text style={styles.cardBody} numberOfLines={2}>{primaryBody}</Text> : null}
                  <View style={styles.annActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openAnnModal(item)}>
                      <Text style={styles.editBtnText}>{lang === 'en' ? '✏️ Edit' : lang === 'es' ? '✏️ Editar' : '✏️ 수정'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteAnnouncement(item.id)}>
                      <Text style={styles.deleteBtnText}>{lang === 'en' ? '🗑 Delete' : lang === 'es' ? '🗑 Eliminar' : '🗑 삭제'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                );
              }}
              ListEmptyComponent={<EmptyView emoji="📢" text={lang === 'en' ? 'No announcements.' : lang === 'es' ? 'No hay avisos.' : '공지사항이 없습니다.'} />}
            />
          )}
        </>
      )}

      {/* ── 주보 관리 탭 ─────────────────────────────────────────────────────── */}
      {tab === 'bulletins' && (
        <>
          <View style={styles.addRow}>
            <TouchableOpacity style={styles.addBtn} onPress={() => openBulletinModal()}>
              <Text style={styles.addBtnText}>{lang === 'en' ? '+ Add Bulletin' : lang === 'es' ? '+ Añadir Boletín' : '+ 주보 추가'}</Text>
            </TouchableOpacity>
          </View>
          {bulletinLoading ? <LoadingView /> : (
            <FlatList
              data={bulletins}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const sections = [
                  (item.worship_order?.length > 0)   && (lang === 'en' ? 'Order of Worship' : lang === 'es' ? 'Orden de Culto' : '예배순서'),
                  (item.announcements?.length > 0)    && (lang === 'en' ? 'Announcements' : lang === 'es' ? 'Avisos' : '공지사항'),
                  (!!item.prayer_requests?.trim())    && (lang === 'en' ? 'Prayer Requests' : lang === 'es' ? 'Peticiones de Oración' : '기도제목'),
                ].filter(Boolean) as string[];
                return (
                  <View style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardName} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.cardDate}>{item.date}</Text>
                    </View>
                    {sections.length > 0 && (
                      <View style={styles.sectionBadges}>
                        {sections.map(s => (
                          <View key={s} style={styles.sectionBadge}>
                            <Text style={styles.sectionBadgeText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={styles.annActions}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openBulletinModal(item)}>
                        <Text style={styles.editBtnText}>{lang === 'en' ? '✏️ Edit' : lang === 'es' ? '✏️ Editar' : '✏️ 수정'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteBulletin(item)}>
                        <Text style={styles.deleteBtnText}>{lang === 'en' ? '🗑 Delete' : lang === 'es' ? '🗑 Eliminar' : '🗑 삭제'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={<EmptyView emoji="📋" text={lang === 'en' ? 'No bulletins registered.' : lang === 'es' ? 'No hay boletines registrados.' : '등록된 주보가 없습니다.'} />}
            />
          )}
        </>
      )}

      {/* ── 회원 관리 탭 ─────────────────────────────────────────────────────── */}
      {tab === 'members' && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder={lang === 'en' ? 'Search by name or email...' : lang === 'es' ? 'Buscar por nombre o correo...' : '이름 또는 이메일로 검색...'}
              placeholderTextColor={Colors.text.light}
              value={memberSearch}
              onChangeText={setMemberSearch}
              clearButtonMode="while-editing"
            />
          </View>

          <View style={styles.roleStats}>
            {(['pastor', 'deacon', 'member'] as UserRole[]).map(r => {
              const count = members.filter(m => (m.role ?? 'member') === r).length;
              const info = ROLE_LABELS[r];
              return (
                <View key={r} style={[styles.roleStatItem, { borderColor: info.color + '30' }]}>
                  <Text style={[styles.roleStatCount, { color: info.color }]}>{count}</Text>
                  <Text style={styles.roleStatLabel}>{roleBadge(r, lang)}</Text>
                </View>
              );
            })}
            <View style={[styles.roleStatItem, { borderColor: Colors.border }]}>
              <Text style={[styles.roleStatCount, { color: Colors.text.secondary }]}>{members.length}</Text>
              <Text style={styles.roleStatLabel}>{lang === 'en' ? 'Total' : lang === 'es' ? 'Total' : '전체'}</Text>
            </View>
          </View>

          {memberLoading ? <LoadingView /> : (
            <FlatList
              data={filteredMembers}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const roleInfo = ROLE_LABELS[item.role ?? 'member'];
                const isMe = item.id === user?.id;
                return (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => changeRole(item)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.memberRow}>
                      <View style={[styles.memberAvatar, { backgroundColor: roleInfo.color + '18' }]}>
                        <Text style={[styles.memberAvatarText, { color: roleInfo.color }]}>
                          {(item.full_name ?? '?').charAt(0)}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>{item.full_name ?? (lang === 'en' ? '(no name)' : lang === 'es' ? '(sin nombre)' : '(이름 없음)')}</Text>
                          {isMe && <Text style={styles.meLabel}> {lang === 'en' ? 'Me' : lang === 'es' ? 'Yo' : '나'}</Text>}
                        </View>
                        {item.email ? (
                          <Text style={styles.memberEmail}>{item.email}</Text>
                        ) : null}
                        <Text style={styles.memberJoined}>{lang === 'en' ? 'Joined: ' : lang === 'es' ? 'Registrado: ' : '가입일: '}{formatDate(item.created_at)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '18' }]}>
                          <Text style={[styles.roleBadgeText, { color: roleInfo.color }]}>
                            {roleBadge(item.role ?? 'member', lang)}
                          </Text>
                        </View>
                        {directoryMembers.has(item.id) ? (
                          <View style={styles.inDirBadge}>
                            <Text style={styles.inDirBadgeText}>{lang === 'en' ? 'Directory ✓' : lang === 'es' ? 'Directorio ✓' : '요람 ✓'}</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.addDirBtn}
                            onPress={() => { setDirTarget(item); setDirPhone(''); setDirBirthday(''); setDirPhotoUrl(''); setDirModal(true); }}
                          >
                            <Text style={styles.addDirBtnText}>{lang === 'en' ? '+ Add to Directory' : lang === 'es' ? '+ Añadir al Directorio' : '+ 요람 추가'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<EmptyView emoji="👥" text={lang === 'en' ? 'No members.' : lang === 'es' ? 'No hay miembros.' : '회원이 없습니다.'} />}
            />
          )}
        </>
      )}

      {/* ── 일정 관리 탭 ─────────────────────────────────────────────────────── */}
      {tab === 'events' && (
        <>
          <View style={styles.tabHeader}>
            <Text style={styles.tabHeaderTitle}>{lang === 'en' ? 'Church Events' : lang === 'es' ? 'Eventos de la Iglesia' : '교회 일정'}</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setEvTitle(''); setEvDate(''); setEvTime(''); setEvLocation(''); setEvDesc(''); setEventModal(true); }}
            >
              <Text style={styles.addBtnText}>{lang === 'en' ? '+ Add Event' : lang === 'es' ? '+ Añadir Evento' : '+ 일정 추가'}</Text>
            </TouchableOpacity>
          </View>
          {eventsLoading ? <LoadingView /> : (
            <FlatList
              data={events}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.eventRow}>
                    <View style={styles.eventDateBadge}>
                      <Text style={styles.eventDateText}>{item.date?.slice(5) ?? ''}</Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                      {item.time ? <Text style={styles.eventMeta}>🕐 {item.time}</Text> : null}
                      {item.location ? <Text style={styles.eventMeta}>📍 {item.location}</Text> : null}
                      {item.description ? <Text style={styles.eventDesc}>{item.description}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => deleteEvent(item.id)} hitSlop={8}>
                      <Icon name="more-delete" size={18} tintColor="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<EmptyView emoji="📅" text={lang === 'en' ? 'No events registered.' : lang === 'es' ? 'No hay eventos registrados.' : '등록된 일정이 없습니다.'} />}
            />
          )}
        </>
      )}

      {/* ── 앱 설정 탭 ───────────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        settingsLoading ? <LoadingView /> : (
          <ScrollView contentContainerStyle={styles.settingsContainer} keyboardShouldPersistTaps="handled">

            {/* ── 이번주 말씀 ── */}
            <Text style={styles.settingsSection}>{lang === 'en' ? '📖 Verse of the Week' : lang === 'es' ? '📖 Versículo de la Semana' : '📖 이번주 말씀'}</Text>
            <Text style={styles.settingsHint}>{lang === 'en' ? 'Saving updates the banner at the top of the home screen.' : lang === 'es' ? 'Al guardar se actualiza el banner en la parte superior de la pantalla de inicio.' : '저장하면 홈 화면 상단 배너에 바로 반영됩니다.'}</Text>
            <View style={styles.settingsCard}>
              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Bible Reference (e.g. John 3:16)' : lang === 'es' ? 'Referencia Bíblica (ej. Juan 3:16)' : '성경 구절 (예: 요한복음 3:16)'}</Text>
              <View style={styles.verseRefRow}>
                <TextInput
                  style={[styles.input, styles.verseRefInput]}
                  placeholder={lang === 'en' ? 'John 3:16 or 요한복음 3:16' : lang === 'es' ? 'Juan 3:16 o 요한복음 3:16' : '요한복음 3:16  또는  John 3:16'}
                  placeholderTextColor={Colors.text.light}
                  value={verseRef} onChangeText={setVerseRef}
                  returnKeyType="done"
                  onSubmitEditing={autoFillVerse}
                />
                <TouchableOpacity
                  style={[styles.autoFillBtn, verseLookupLoading && styles.saveBtnDisabled]}
                  onPress={autoFillVerse}
                  disabled={verseLookupLoading || !verseRef.trim()}
                >
                  {verseLookupLoading
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={styles.autoFillBtnText}>{lang === 'en' ? 'Auto Fill' : lang === 'es' ? 'Autocompletar' : '자동 채우기'}</Text>
                  }
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>{lang === 'en' ? '🇰🇷 Verse Text (Korean) *' : lang === 'es' ? '🇰🇷 Texto del Versículo (Coreano) *' : '🇰🇷 말씀 본문 (한국어) *'}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={lang === 'en' ? 'Enter verse text...' : lang === 'es' ? 'Ingrese el texto del versículo...' : '말씀 본문을 입력하세요...'}
                placeholderTextColor={Colors.text.light}
                value={verseKo} onChangeText={setVerseKo}
                multiline numberOfLines={4} textAlignVertical="top"
              />
              <Text style={styles.fieldLabel}>{lang === 'en' ? '🇺🇸 English (optional)' : lang === 'es' ? '🇺🇸 English (opcional)' : '🇺🇸 English (선택)'}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Verse text (optional)"
                placeholderTextColor={Colors.text.light}
                value={verseEn} onChangeText={setVerseEn}
                multiline numberOfLines={3} textAlignVertical="top"
              />
              <Text style={styles.fieldLabel}>{lang === 'en' ? '🇪🇸 Español (optional)' : lang === 'es' ? '🇪🇸 Español (opcional)' : '🇪🇸 Español (선택)'}</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="Versículo (opcional)"
                placeholderTextColor={Colors.text.light}
                value={verseEs} onChangeText={setVerseEs}
                multiline numberOfLines={3} textAlignVertical="top"
              />
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, settingsSaving && styles.saveBtnDisabled]}
              onPress={saveSettings} disabled={settingsSaving}
            >
              {settingsSaving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.saveBtnText}>{lang === 'en' ? '📖 Save Verse' : lang === 'es' ? '📖 Guardar Versículo' : '📖 말씀 저장하기'}</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 32 }} />

            {/* ── 최근 설교 영상 ── */}
            <Text style={styles.settingsSection}>{lang === 'en' ? '▶ Latest Sermon Video' : lang === 'es' ? '▶ Video del Último Sermón' : '▶ 최근 설교 영상'}</Text>
            <Text style={styles.settingsHint}>{lang === 'en' ? 'YouTube link shown at the top of the Worship tab. Leave blank to use the default.' : lang === 'es' ? 'Enlace de YouTube que se muestra en la pestaña Culto. Déjelo vacío para usar el predeterminado.' : '예배 탭 상단에 표시되는 YouTube 링크입니다. 비워두면 기본 영상이 표시됩니다.'}</Text>
            <View style={styles.settingsCard}>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="https://www.youtube.com/watch?v=..."
                placeholderTextColor={Colors.text.light}
                value={sermonUrl} onChangeText={setSermonUrl}
                autoCapitalize="none" keyboardType="url" autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#DC2626' }, sermonSaving && styles.saveBtnDisabled]}
              onPress={saveSermonUrl} disabled={sermonSaving}
            >
              {sermonSaving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.saveBtnText}>{lang === 'en' ? '▶ Save Sermon Link' : lang === 'es' ? '▶ Guardar Enlace del Sermón' : '▶ 설교 링크 저장하기'}</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 32 }} />

            {/* ── 헌금 설정 ── */}
            <Text style={styles.settingsSection}>{lang === 'en' ? '💝 Online Offering Settings' : lang === 'es' ? '💝 Configuración de Ofrenda en Línea' : '💝 온라인 헌금 설정'}</Text>
            <Text style={styles.settingsHint}>{lang === 'en' ? 'Configure the payment info shown on the offering screen.' : lang === 'es' ? 'Configure la información de pago que se muestra en la pantalla de ofrendas.' : '헌금 화면에 표시되는 결제 정보를 설정합니다.'}</Text>
            <View style={styles.settingsCard}>
              <Text style={styles.fieldLabel}>{lang === 'en' ? '💳 Offering Link URL' : lang === 'es' ? '💳 URL del Enlace de Ofrenda' : '💳 헌금 링크 URL'}</Text>
              <TextInput
                style={styles.input}
                placeholder="https://paypal.me/..."
                placeholderTextColor={Colors.text.light}
                value={offeringUrl} onChangeText={setOfferingUrl}
                autoCapitalize="none" keyboardType="url" autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>{lang === 'en' ? '💸 Zelle (email or phone)' : lang === 'es' ? '💸 Zelle (correo o teléfono)' : '💸 Zelle (이메일 또는 전화번호)'}</Text>
              <TextInput
                style={styles.input}
                placeholder={lang === 'en' ? 'church@email.com or +1-407-000-0000' : lang === 'es' ? 'church@email.com o +1-407-000-0000' : 'church@email.com 또는 +1-407-000-0000'}
                placeholderTextColor={Colors.text.light}
                value={offeringZelle} onChangeText={setOfferingZelle}
                autoCapitalize="none" autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>{lang === 'en' ? '📱 Venmo Username' : lang === 'es' ? '📱 Usuario de Venmo' : '📱 Venmo 아이디'}</Text>
              <TextInput
                style={styles.input}
                placeholder="@gracechurch"
                placeholderTextColor={Colors.text.light}
                value={offeringVenmo} onChangeText={setOfferingVenmo}
                autoCapitalize="none" autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>{lang === 'en' ? '💵 Cash App Username' : lang === 'es' ? '💵 Usuario de Cash App' : '💵 Cash App 아이디'}</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="$gracechurch"
                placeholderTextColor={Colors.text.light}
                value={offeringCashApp} onChangeText={setOfferingCashApp}
                autoCapitalize="none" autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#059669' }, offeringSaving && styles.saveBtnDisabled]}
              onPress={saveOfferingSettings} disabled={offeringSaving}
            >
              {offeringSaving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.saveBtnText}>{lang === 'en' ? '💝 Save Offering Settings' : lang === 'es' ? '💝 Guardar Configuración de Ofrenda' : '💝 헌금 설정 저장하기'}</Text>
              }
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        )
      )}

      {/* ── 주보 편집 모달 ──────────────────────────────────────────────────── */}
      <Modal
        visible={bulletinModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setBulletinModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setBulletinModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingBulletin ? (lang === 'en' ? 'Edit Bulletin' : lang === 'es' ? 'Editar Boletín' : '주보 수정') : (lang === 'en' ? 'Add Bulletin' : lang === 'es' ? 'Añadir Boletín' : '주보 추가')}</Text>
            <View style={{ width: 32 }} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">

              {/* 제목 + 날짜 */}
              <View style={styles.settingsCard}>
                <Text style={styles.fieldLabel}>{lang === 'en' ? 'Bulletin Title *' : lang === 'es' ? 'Título del Boletín *' : '주보 제목 *'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={lang === 'en' ? 'e.g. April 27, 2026 Bulletin' : lang === 'es' ? 'ej. Boletín del 27 de abril de 2026' : '예: 2026년 4월 27일 주보'}
                  placeholderTextColor={Colors.text.light}
                  value={bulletinTitle}
                  onChangeText={setBulletinTitle}
                />
                <Text style={styles.fieldLabel}>{lang === 'en' ? 'Date *' : lang === 'es' ? 'Fecha *' : '날짜 *'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={lang === 'en' ? 'e.g. 2026-04-27' : lang === 'es' ? 'ej. 2026-04-27' : '예: 2026-04-27'}
                  placeholderTextColor={Colors.text.light}
                  value={bulletinDate}
                  onChangeText={setBulletinDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              {/* 예배 순서 */}
              <View style={styles.bulletinSectionHeader}>
                <View style={[styles.bulletinSectionDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.bulletinSectionTitle}>{lang === 'en' ? 'Order of Worship' : lang === 'es' ? 'Orden de Culto' : '예배 순서'}</Text>
              </View>
              <View style={styles.settingsCard}>
                {worshipOrder.map((item, i) => (
                  <View key={i} style={styles.worshipEditRow}>
                    <TextInput
                      style={styles.worshipRoleInput}
                      placeholder={lang === 'en' ? 'Role' : lang === 'es' ? 'Rol' : '역할'}
                      placeholderTextColor={Colors.text.light}
                      value={item.role}
                      onChangeText={v => updateWorshipItem(i, 'role', v)}
                    />
                    <TextInput
                      style={styles.worshipContentInput}
                      placeholder={lang === 'en' ? 'Name / Content' : lang === 'es' ? 'Nombre / Contenido' : '이름 / 내용'}
                      placeholderTextColor={Colors.text.light}
                      value={item.content}
                      onChangeText={v => updateWorshipItem(i, 'content', v)}
                    />
                    <TouchableOpacity onPress={() => removeWorshipItem(i)} hitSlop={8} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addRowBtn} onPress={addWorshipItem}>
                  <Text style={styles.addRowBtnText}>{lang === 'en' ? '+ Add Item' : lang === 'es' ? '+ Añadir Elemento' : '+ 항목 추가'}</Text>
                </TouchableOpacity>
              </View>

              {/* 공지사항 */}
              <View style={styles.bulletinSectionHeader}>
                <View style={[styles.bulletinSectionDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.bulletinSectionTitle}>{lang === 'en' ? 'Announcements' : lang === 'es' ? 'Avisos' : '공지사항'}</Text>
              </View>
              <View style={styles.settingsCard}>
                {bulletinAnns.map((ann, i) => (
                  <View key={i} style={styles.annEditRow}>
                    <TextInput
                      style={styles.annEditInput}
                      placeholder={lang === 'en' ? `Announcement ${i + 1}` : lang === 'es' ? `Aviso ${i + 1}` : `공지 ${i + 1}`}
                      placeholderTextColor={Colors.text.light}
                      value={ann}
                      onChangeText={v => updateAnnItem(i, v)}
                      multiline
                    />
                    <TouchableOpacity onPress={() => removeAnnItem(i)} hitSlop={8} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addRowBtn} onPress={addAnnItem}>
                  <Text style={styles.addRowBtnText}>{lang === 'en' ? '+ Add Announcement' : lang === 'es' ? '+ Añadir Aviso' : '+ 공지 추가'}</Text>
                </TouchableOpacity>
              </View>

              {/* 기도 제목 */}
              <View style={styles.bulletinSectionHeader}>
                <View style={[styles.bulletinSectionDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.bulletinSectionTitle}>{lang === 'en' ? 'Prayer Requests' : lang === 'es' ? 'Peticiones de Oración' : '기도 제목'}</Text>
              </View>
              <View style={styles.settingsCard}>
                <TextInput
                  style={[styles.input, styles.textArea, { marginBottom: 0 }]}
                  placeholder={lang === 'en' ? 'Enter prayer requests...' : lang === 'es' ? 'Ingrese peticiones de oración...' : '기도 제목을 입력하세요...'}
                  placeholderTextColor={Colors.text.light}
                  value={bulletinPrayer}
                  onChangeText={setBulletinPrayer}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: 8 }, bulletinSaving && styles.saveBtnDisabled]}
                onPress={saveBulletin}
                disabled={bulletinSaving}
              >
                {bulletinSaving
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.saveBtnText}>{editingBulletin ? (lang === 'en' ? 'Save Edits' : lang === 'es' ? 'Guardar Cambios' : '수정 저장') : (lang === 'en' ? 'Save Bulletin' : lang === 'es' ? 'Guardar Boletín' : '주보 저장')}</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── 공지사항 편집 모달 ──────────────────────────────────────────────── */}
      <Modal
        visible={annModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setAnnModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAnnModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingAnn ? (lang === 'en' ? 'Edit Announcement' : lang === 'es' ? 'Editar Aviso' : '공지사항 수정') : (lang === 'en' ? 'Add Announcement' : lang === 'es' ? 'Añadir Aviso' : '공지사항 추가')}</Text>
            <View style={{ width: 32 }} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">

              {/* 한국어 (기본) */}
              <View style={styles.settingsCard}>
                <Text style={styles.annLangHeader}>{lang === 'en' ? '🇰🇷 Korean (required)' : lang === 'es' ? '🇰🇷 Coreano (requerido)' : '🇰🇷 한국어 (필수)'}</Text>
                <Text style={styles.fieldLabel}>{lang === 'en' ? 'Title *' : lang === 'es' ? 'Título *' : '제목 *'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={lang === 'en' ? 'Announcement title' : lang === 'es' ? 'Título del aviso' : '공지사항 제목'}
                  placeholderTextColor={Colors.text.light}
                  value={annKo}
                  onChangeText={setAnnKo}
                  autoFocus
                />
                <Text style={styles.fieldLabel}>{lang === 'en' ? 'Body' : lang === 'es' ? 'Contenido' : '내용'}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={lang === 'en' ? 'Announcement body (optional)' : lang === 'es' ? 'Contenido del aviso (opcional)' : '공지사항 내용 (선택)'}
                  placeholderTextColor={Colors.text.light}
                  value={annBodyKo}
                  onChangeText={setAnnBodyKo}
                  multiline numberOfLines={4} textAlignVertical="top"
                />
              </View>

              {/* 다국어 (선택) */}
              <TouchableOpacity
                style={styles.annLangToggle}
                onPress={() => setAnnLangExpanded(v => !v)}
                activeOpacity={0.75}
              >
                <Text style={styles.annLangToggleText}>
                  {annLangExpanded ? '▼' : '▶'} {lang === 'en' ? '🌐 Add translations (optional)' : lang === 'es' ? '🌐 Añadir traducciones (opcional)' : '🌐 다국어 번역 추가 (선택)'}
                </Text>
              </TouchableOpacity>

              {annLangExpanded && (
                <View style={styles.settingsCard}>
                  <Text style={styles.annLangHeader}>{lang === 'en' ? '🇺🇸 English (optional)' : lang === 'es' ? '🇺🇸 English (opcional)' : '🇺🇸 English (선택)'}</Text>
                  <Text style={styles.fieldLabel}>Title</Text>
                  <TextInput style={styles.input} placeholder="Title" placeholderTextColor={Colors.text.light} value={annEn} onChangeText={setAnnEn} />
                  <Text style={styles.fieldLabel}>Body</Text>
                  <TextInput style={[styles.input, styles.textArea]} placeholder="Body" placeholderTextColor={Colors.text.light} value={annBodyEn} onChangeText={setAnnBodyEn} multiline numberOfLines={3} textAlignVertical="top" />

                  <Text style={[styles.annLangHeader, { marginTop: 12 }]}>{lang === 'en' ? '🇪🇸 Español (optional)' : lang === 'es' ? '🇪🇸 Español (opcional)' : '🇪🇸 Español (선택)'}</Text>
                  <Text style={styles.fieldLabel}>Título</Text>
                  <TextInput style={styles.input} placeholder="Título" placeholderTextColor={Colors.text.light} value={annEs} onChangeText={setAnnEs} />
                  <Text style={styles.fieldLabel}>Contenido</Text>
                  <TextInput style={[styles.input, styles.textArea]} placeholder="Contenido" placeholderTextColor={Colors.text.light} value={annBodyEs} onChangeText={setAnnBodyEs} multiline numberOfLines={3} textAlignVertical="top" />
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: 16 }, annSaving && styles.saveBtnDisabled]}
                onPress={saveAnnouncement} disabled={annSaving}
              >
                {annSaving
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.saveBtnText}>{editingAnn ? (lang === 'en' ? '✓ Save Edits' : lang === 'es' ? '✓ Guardar Cambios' : '✓ 수정 저장') : (lang === 'en' ? '✓ Add' : lang === 'es' ? '✓ Añadir' : '✓ 추가하기')}</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── 일정 추가 모달 ── */}
      <Modal visible={eventModal} animationType="slide" transparent onRequestClose={() => setEventModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{lang === 'en' ? 'Add Event' : lang === 'es' ? 'Añadir Evento' : '일정 추가'}</Text>
              <TouchableOpacity onPress={() => setEventModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Title *' : lang === 'es' ? 'Título *' : '제목 *'}</Text>
              <TextInput style={styles.input} placeholder={lang === 'en' ? 'Event title' : lang === 'es' ? 'Título del evento' : '일정 제목'} placeholderTextColor={Colors.text.light} value={evTitle} onChangeText={setEvTitle} />
              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Date * (YYYY-MM-DD)' : lang === 'es' ? 'Fecha * (YYYY-MM-DD)' : '날짜 * (YYYY-MM-DD)'}</Text>
              <TextInput style={styles.input} placeholder="2026-06-15" placeholderTextColor={Colors.text.light} value={evDate} onChangeText={setEvDate} keyboardType="numeric" />
              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Time' : lang === 'es' ? 'Hora' : '시간'}</Text>
              <TextInput style={styles.input} placeholder={lang === 'en' ? '11:00 AM' : lang === 'es' ? '11:00 AM' : '오전 11:00'} placeholderTextColor={Colors.text.light} value={evTime} onChangeText={setEvTime} />
              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Location' : lang === 'es' ? 'Lugar' : '장소'}</Text>
              <TextInput style={styles.input} placeholder={lang === 'en' ? 'Church Sanctuary' : lang === 'es' ? 'Santuario de la Iglesia' : '교회 본당'} placeholderTextColor={Colors.text.light} value={evLocation} onChangeText={setEvLocation} />
              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Description' : lang === 'es' ? 'Descripción' : '설명'}</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder={lang === 'en' ? 'Event description' : lang === 'es' ? 'Descripción del evento' : '일정 설명'} placeholderTextColor={Colors.text.light} value={evDesc} onChangeText={setEvDesc} multiline numberOfLines={3} textAlignVertical="top" />
              <TouchableOpacity
                style={[styles.saveBtn, evSaving && { opacity: 0.5 }]}
                onPress={saveEvent}
                disabled={evSaving}
              >
                <Text style={styles.saveBtnText}>{evSaving ? (lang === 'en' ? 'Saving...' : lang === 'es' ? 'Guardando...' : '저장 중...') : (lang === 'en' ? 'Save' : lang === 'es' ? 'Guardar' : '저장')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 요람 추가 모달 ── */}
      <Modal visible={dirModal} animationType="slide" transparent onRequestClose={() => setDirModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{lang === 'en' ? 'Add to Directory' : lang === 'es' ? 'Añadir al Directorio' : '요람에 추가'}</Text>
              <TouchableOpacity onPress={() => setDirModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {dirTarget && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.dirTargetCard}>
                  <Text style={styles.dirTargetName}>{dirTarget.full_name}</Text>
                  <Text style={styles.dirTargetEmail}>{dirTarget.email}</Text>
                </View>
                <Text style={styles.fieldLabel}>{lang === 'en' ? 'Phone Number' : lang === 'es' ? 'Número de Teléfono' : '전화번호'}</Text>
                <TextInput style={styles.input} placeholder="(000) 000-0000" placeholderTextColor={Colors.text.light} value={dirPhone} onChangeText={setDirPhone} keyboardType="phone-pad" />
                <Text style={styles.fieldLabel}>{lang === 'en' ? 'Birthday (YYYY-MM-DD)' : lang === 'es' ? 'Cumpleaños (YYYY-MM-DD)' : '생일 (YYYY-MM-DD)'}</Text>
                <TextInput style={styles.input} placeholder="1990-01-01" placeholderTextColor={Colors.text.light} value={dirBirthday} onChangeText={setDirBirthday} />
                <Text style={styles.fieldLabel}>{lang === 'en' ? 'Photo URL (optional)' : lang === 'es' ? 'URL de Foto (opcional)' : '사진 URL (선택)'}</Text>
                <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={Colors.text.light} value={dirPhotoUrl} onChangeText={setDirPhotoUrl} autoCapitalize="none" />
                <TouchableOpacity
                  style={[styles.saveBtn, dirSaving && { opacity: 0.5 }]}
                  onPress={addToDirectory}
                  disabled={dirSaving}
                >
                  <Text style={styles.saveBtnText}>{dirSaving ? (lang === 'en' ? 'Adding...' : lang === 'es' ? 'Añadiendo...' : '추가 중...') : (lang === 'en' ? 'Add to Directory' : lang === 'es' ? 'Añadir al Directorio' : '요람에 추가')}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── 소형 컴포넌트 ──────────────────────────────────────────────────────────────
function AnonBadge({ lang }: { lang: 'ko' | 'en' | 'es' }) {
  return (
    <View style={styles.anonBadge}>
      <Text style={styles.anonBadgeText}>{lang === 'en' ? 'Anonymous' : lang === 'es' ? 'Anónimo' : '익명'}</Text>
    </View>
  );
}

function LoadingView() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

function EmptyView({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>{emoji}</Text>
      <Text style={{ fontSize: 15, color: Colors.text.secondary }}>{text}</Text>
    </View>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backText: { fontSize: 28, color: Colors.primary, lineHeight: 30 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 3 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.primary },
  pastorBadge: {
    backgroundColor: PASTOR_COLOR,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pastorBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  deniedEmoji: { fontSize: 56 },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  deniedDesc: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22 },

  tabBarWrap: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBar: { flexDirection: 'row', paddingHorizontal: 4 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minWidth: 70,
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabEmoji: { fontSize: 17, marginBottom: 2 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: Colors.text.secondary },
  tabLabelActive: { color: Colors.primary },
  tabBadge: { backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 16, alignItems: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Moderation tab
  modTypeBadge: { backgroundColor: Colors.primary + '18', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  modTypeBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  modReasonBadge: { backgroundColor: '#FEF3C7', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  modReasonBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  modBannedBadge: { backgroundColor: '#DC2626', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  modBannedBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  modPreview: {
    backgroundColor: Colors.background, borderRadius: 8, padding: 10,
    borderLeftWidth: 3, borderLeftColor: Colors.primary, marginBottom: 10,
  },
  modPreviewText: { fontSize: 13, color: Colors.text.primary, lineHeight: 19 },
  modMeta: { gap: 3, marginBottom: 10 },
  modMetaText: { fontSize: 12, color: Colors.text.secondary },
  modActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  modActionSoft: {
    flex: 1, minWidth: 90, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modActionSoftText: { fontSize: 12, fontWeight: '700', color: Colors.text.primary },
  modActionDanger: {
    flex: 1, minWidth: 90, paddingVertical: 9, borderRadius: 8,
    backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', alignItems: 'center',
  },
  modActionDangerText: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },
  modActionBan: {
    flex: 1, minWidth: 90, paddingVertical: 9, borderRadius: 8,
    backgroundColor: '#DC2626', alignItems: 'center',
  },
  modActionBanText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  addRow: {
    padding: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  addBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  // Members
  searchRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleStats: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  roleStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 2,
  },
  roleStatCount: { fontSize: 18, fontWeight: '800' },
  roleStatLabel: { fontSize: 10, fontWeight: '600', color: Colors.text.secondary },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  memberAvatarText: { fontSize: 18, fontWeight: '800' },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  meLabel: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  memberEmail: { fontSize: 12, color: Colors.text.secondary, marginTop: 1 },
  memberJoined: { fontSize: 11, color: Colors.text.light, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  roleBadgeText: { fontSize: 12, fontWeight: '800' },
  inDirBadge: { backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  inDirBadgeText: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  addDirBtn: { backgroundColor: Colors.primary + '15', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.primary + '40' },
  addDirBtnText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  // Events
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eventDateBadge: { backgroundColor: Colors.primary + '15', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center', minWidth: 50 },
  eventDateText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginBottom: 4 },
  eventMeta: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  eventDesc: { fontSize: 12, color: Colors.text.secondary, marginTop: 4, lineHeight: 18 },

  // Tab section header
  tabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tabHeaderTitle: { fontSize: 16, fontWeight: '800', color: Colors.text.primary },
  deleteIcon: { fontSize: 18, color: Colors.text.light },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  // Directory modal
  dirTargetCard: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginBottom: 16 },
  dirTargetName: { fontSize: 16, fontWeight: '800', color: Colors.text.primary },
  dirTargetEmail: { fontSize: 12, color: Colors.text.secondary, marginTop: 4 },

  list: { padding: 14, gap: 10 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  cardSub: { fontSize: 12, color: Colors.text.secondary, marginBottom: 4 },
  cardDate: { fontSize: 12, color: Colors.text.light },
  cardBody: { fontSize: 13, color: Colors.text.primary, lineHeight: 20, marginBottom: 8 },

  anonBadge: { backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  anonBadgeText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '600' },

  visitMeta: { gap: 3, marginBottom: 8 },
  visitMetaText: { fontSize: 12, color: Colors.text.secondary },

  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  statusRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 },
  statusBtn: {
    flex: 1, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  statusBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusBtnText: { fontSize: 11, fontWeight: '600', color: Colors.text.secondary },
  statusBtnTextActive: { color: Colors.white },

  sectionBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  sectionBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  bulletinSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, marginBottom: 8,
  },
  bulletinSectionDot: { width: 10, height: 10, borderRadius: 5 },
  bulletinSectionTitle: {
    fontSize: 12, fontWeight: '800',
    color: Colors.text.secondary, letterSpacing: 0.5, textTransform: 'uppercase',
  },

  worshipEditRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 8,
  },
  worshipRoleInput: {
    width: 80,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 13, color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  worshipContentInput: {
    flex: 1,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 13, color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  removeBtn: { padding: 6 },
  removeBtnText: { fontSize: 14, color: Colors.text.light, fontWeight: '700' },

  addRowBtn: {
    paddingVertical: 10, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4,
  },
  addRowBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  annEditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8 },
  annEditInput: {
    flex: 1,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 13, color: Colors.text.primary,
    backgroundColor: Colors.background,
    minHeight: 40,
  },

  annActions: { flexDirection: 'row', gap: 8 },
  editBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text.primary },
  deleteBtn: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#FED7D7', alignItems: 'center',
  },
  deleteBtnText: { fontSize: 12, fontWeight: '600', color: '#E53E3E' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  settingsContainer: { padding: 16, paddingBottom: 40 },
  settingsSection: {
    fontSize: 14, fontWeight: '800', color: Colors.text.primary,
    letterSpacing: 0.3, marginBottom: 4,
  },
  settingsHint: {
    fontSize: 12, color: Colors.text.secondary, marginBottom: 10, lineHeight: 17,
  },
  verseRefRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  verseRefInput: {
    flex: 1, marginBottom: 0,
  },
  autoFillBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 88,
  },
  autoFillBtnText: {
    color: Colors.white, fontSize: 13, fontWeight: '700',
  },
  annLangHeader: {
    fontSize: 13, fontWeight: '800', color: Colors.text.secondary, marginBottom: 8,
  },
  annLangToggle: {
    paddingVertical: 12, paddingHorizontal: 4, marginBottom: 8,
  },
  annLangToggleText: {
    fontSize: 14, fontWeight: '600', color: Colors.primary,
  },
  settingsCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4,
  },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 14, marginBottom: 12,
    color: Colors.text.primary, backgroundColor: Colors.background,
  },
  textArea: { height: 90 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalClose: { fontSize: 20, color: Colors.text.secondary, width: 32, textAlign: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.primary },
  modalBody: { padding: 20 },
});
