import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import { VisitRequest, MoreStackParamList } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

type Props = NativeStackScreenProps<MoreStackParamList, 'Visit'>;

const DATE_LOCALES: Record<string, string> = { ko: 'ko-KR', en: 'en-US', es: 'es-ES' };

const VISIT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
  completed: { bg: '#D1FAE5', text: '#065F46' },
};


export default function VisitScreen({ navigation }: Props) {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const dateLocale = DATE_LOCALES[lang] ?? 'ko-KR';

  // ── Admin: list ────────────────────────────────────────────────────────────
  const [visits, setVisits] = useState<VisitRequest[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // ── Submission form ────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [visitDate, setVisitDate] = useState(new Date());
  const [visitTime, setVisitTime] = useState(() => {
    const d = new Date();
    d.setHours(11, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isAdmin) loadVisits();
  }, [isAdmin]);

  async function loadVisits() {
    setListLoading(true);
    try {
      const { data } = await supabase
        .from('visit_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setVisits(data as VisitRequest[]);
    } catch { /* ignore */ }
    setListLoading(false);
  }

  async function deleteVisit(id: string) {
    Alert.alert(t('errorTitle'), t('visitDeleteMsg'), [
      { text: t('cancelBtn'), style: 'cancel' },
      {
        text: t('deleteLabel'), style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('visit_requests').delete().eq('id', id);
          if (error) { Alert.alert(t('errorTitle'), error.message); return; }
          setVisits(prev => prev.filter(v => v.id !== id));
        },
      },
    ]);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('visit_requests').update({ status }).eq('id', id);
    if (error) { Alert.alert(t('errorTitle'), error.message); return; }
    setVisits(prev => prev.map(v => v.id === id ? { ...v, status: status as any } : v));
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString(dateLocale, {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    });
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setVisitDate(selected);
  }

  function onTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selected) setVisitTime(selected);
  }

  function resetForm() {
    setName('');
    setPhone('');
    setNote('');
    const now = new Date();
    now.setHours(11, 0, 0, 0);
    setVisitDate(new Date());
    setVisitTime(now);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

  async function submitVisit() {
    if (!name.trim()) {
      Alert.alert(t('errorTitle'), t('visitNameError'));
      return;
    }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      date: formatDate(visitDate),
      time: formatTime(visitTime),
      note: note.trim(),
      status: 'pending',
    };
    const { error } = await supabase.from('visit_requests').insert(payload);
    setSubmitting(false);
    if (error) {
      Alert.alert(t('errorTitle'), t('submitErrorMsg'));
      return;
    }
    resetForm();
    setSubmitted(true);
    if (isAdmin) loadVisits();
  }

  const statusColor = (status?: string) =>
    VISIT_STATUS_COLORS[status ?? 'pending'] ?? VISIT_STATUS_COLORS.pending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('visitTab')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        {/* ── 관리자 목록 ── */}
        {isAdmin && (
          listLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : visits.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏠</Text>
              <Text style={styles.emptyText}>{t('visitEmptyList')}</Text>
            </View>
          ) : (
            <FlatList
              data={visits}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const sc = statusColor(item.status);
                return (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.avatarRow}>
                        <View style={[styles.avatar, { backgroundColor: Colors.secondary }]}>
                          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                        </View>
                        <Text style={styles.authorName}>{item.name}</Text>
                      </View>
                      <View style={styles.cardHeaderRight}>
                        <TouchableOpacity
                          style={[styles.statusBadge, { backgroundColor: sc.bg }]}
                          onPress={() => {
                            const next = item.status === 'pending' ? 'confirmed'
                              : item.status === 'confirmed' ? 'completed' : 'pending';
                            updateStatus(item.id, next);
                          }}
                        >
                          <Text style={[styles.statusBadgeText, { color: sc.text }]}>
                            {item.status === 'confirmed' ? t('visitStatusConfirmed') : item.status === 'completed' ? t('visitStatusCompleted') : t('visitStatusPending')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteVisit(item.id)} style={styles.deleteBtn}>
                          <Text style={styles.deleteBtnText}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoIcon}>📅</Text>
                      <Text style={styles.infoText}>{item.date}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoIcon}>🕐</Text>
                      <Text style={styles.infoText}>{item.time}</Text>
                    </View>
                    {!!item.phone && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoIcon}>📞</Text>
                        <Text style={styles.infoText}>{item.phone}</Text>
                      </View>
                    )}
                    {!!item.note && <Text style={styles.cardNote}>{item.note}</Text>}
                  </View>
                );
              }}
            />
          )
        )}

        {/* ── 일반 사용자: 제출 폼 또는 완료 메시지 ── */}
        {!isAdmin && (
          submitted ? (
            <View style={styles.successBox}>
              <Text style={styles.successEmoji}>🏠</Text>
              <Text style={styles.successTitle}>{t('visitSuccessTitle')}</Text>
              <Text style={styles.successSub}>{t('visitSuccessMsg')}</Text>
              <TouchableOpacity style={styles.anotherBtn} onPress={() => setSubmitted(false)}>
                <Text style={styles.anotherBtnText}>{t('visitAnotherBtn')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.formBox} keyboardShouldPersistTaps="handled">
              <Text style={styles.formTitle}>{t('visitModalTitle')}</Text>

              <Text style={styles.fieldLabel}>{t('visitNameLabel')} <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder={t('visitNamePlaceholder')}
                placeholderTextColor={Colors.text.light}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>{t('visitPhoneLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('visitPhonePlaceholder')}
                placeholderTextColor={Colors.text.light}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>{t('visitDateLabel')} <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => { setShowTimePicker(false); setShowDatePicker(v => !v); }}
              >
                <Text style={styles.pickerIcon}>📅</Text>
                <Text style={styles.pickerText}>{formatDate(visitDate)}</Text>
                <Text style={styles.pickerChevron}>{showDatePicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={visitDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date()}
                    onChange={onDateChange}
                    locale={DATE_LOCALES[lang]}
                    style={{ width: '100%' }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.pickerConfirm} onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.pickerConfirmText}>{t('pickerConfirm')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.fieldLabel}>{t('visitTimeLabel')} <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => { setShowDatePicker(false); setShowTimePicker(v => !v); }}
              >
                <Text style={styles.pickerIcon}>🕐</Text>
                <Text style={styles.pickerText}>{formatTime(visitTime)}</Text>
                <Text style={styles.pickerChevron}>{showTimePicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showTimePicker && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={visitTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minuteInterval={30}
                    onChange={onTimeChange}
                    locale={DATE_LOCALES[lang]}
                    style={{ width: '100%' }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.pickerConfirm} onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.pickerConfirmText}>{t('pickerConfirm')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.fieldLabel}>{t('visitNoteLabel')}</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                placeholder={t('visitNotePlaceholder')}
                placeholderTextColor={Colors.text.light}
                value={note}
                onChangeText={setNote}
                multiline
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitVisit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>{t('visitSubmitBtn')}</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          )
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backBtnText: { fontSize: 30, color: Colors.primary, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.primary },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.text.secondary },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  authorName: { fontSize: 14, fontWeight: '700', color: Colors.text.primary },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoIcon: { fontSize: 14 },
  infoText: { fontSize: 13, color: Colors.text.primary, fontWeight: '500' },
  cardNote: { fontSize: 13, color: Colors.text.secondary, lineHeight: 20, marginTop: 6 },
  successBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  successEmoji: { fontSize: 64, marginBottom: 8 },
  successTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, textAlign: 'center' },
  successSub: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  anotherBtn: {
    marginTop: 16, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: Colors.primary, borderRadius: 10,
  },
  anotherBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  formBox: { padding: 20 },
  formTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginBottom: 20 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.text.secondary,
    marginBottom: 6, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  required: { color: '#E53E3E' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 14, fontSize: 14, marginBottom: 12,
    color: Colors.text.primary, backgroundColor: Colors.white,
  },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 14, marginBottom: 4, backgroundColor: Colors.white,
  },
  pickerIcon: { fontSize: 18, marginRight: 10 },
  pickerText: { flex: 1, fontSize: 15, color: Colors.text.primary, fontWeight: '500' },
  pickerChevron: { fontSize: 12, color: Colors.text.light },
  pickerContainer: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12, overflow: 'hidden',
  },
  pickerConfirm: { backgroundColor: Colors.primary, paddingVertical: 12, alignItems: 'center' },
  pickerConfirmText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
