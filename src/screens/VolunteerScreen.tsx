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
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList, VolunteerPost, VolunteerRole } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { checkContentFilter } from '../utils/moderation';

type Props = NativeStackScreenProps<MoreStackParamList, 'Volunteer'>;

const CATEGORY_COLORS: Record<string, string> = {
  예배: '#1E3A5F',
  교육: '#2C5282',
  봉사: '#276749',
  행사: '#744210',
  Worship: '#1E3A5F',
  Education: '#2C5282',
  Service: '#276749',
  Event: '#744210',
};
const CATEGORY_KEYS = ['예배', '교육', '봉사', '행사'];
const CATEGORY_LABELS: Record<string, { ko: string; en: string; es: string }> = {
  '예배': { ko: '예배', en: 'Worship',   es: 'Adoración' },
  '교육': { ko: '교육', en: 'Education', es: 'Educación' },
  '봉사': { ko: '봉사', en: 'Service',   es: 'Servicio'  },
  '행사': { ko: '행사', en: 'Event',     es: 'Evento'    },
};
function catLabel(cat: string, lang: string): string {
  const m = CATEGORY_LABELS[cat];
  if (!m) return cat;
  return lang === 'en' ? m.en : lang === 'es' ? m.es : m.ko;
}

function spotsLeft(role: VolunteerRole) {
  return role.needed - role.applicants.length;
}
function isFull(role: VolunteerRole) {
  return spotsLeft(role) <= 0;
}
function totalSpots(post: VolunteerPost) {
  const needed = post.roles.reduce((s, r) => s + r.needed, 0);
  const filled = post.roles.reduce((s, r) => s + r.applicants.length, 0);
  return { needed, filled };
}

interface RoleForm {
  name: string;
  needed: string;
}

export default function VolunteerScreen({ navigation }: Props) {
  const { t, lang } = useLanguage();
  const lng: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
  const { isAdmin } = useAuth();

  const [posts, setPosts] = useState<VolunteerPost[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Apply modal ─────────────────────────────────────────────────────────────
  const [modalPost, setModalPost] = useState<VolunteerPost | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [applicantName, setApplicantName] = useState('');

  // ── Admin add modal ─────────────────────────────────────────────────────────
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newCategory, setNewCategory] = useState('예배');
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRoles, setNewRoles] = useState<RoleForm[]>([{ name: '', needed: '2' }]);
  const [saving, setSaving] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('volunteer_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setPosts(data as VolunteerPost[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // ── Apply ───────────────────────────────────────────────────────────────────
  function openApply(post: VolunteerPost) {
    const first = post.roles.find(r => !isFull(r));
    setSelectedRoleId(first?.id ?? post.roles[0]?.id ?? '');
    setApplicantName('');
    setModalPost(post);
  }
  function closeApply() {
    setModalPost(null);
    setSelectedRoleId('');
    setApplicantName('');
  }
  function submitApplication() {
    if (!applicantName.trim()) {
      Alert.alert(t('volunteerErrorTitle'), t('volunteerNameError'));
      return;
    }
    if (checkContentFilter(applicantName, lng)) return;
    setPosts(prev => prev.map(post => {
      if (post.id !== modalPost?.id) return post;
      return {
        ...post,
        roles: post.roles.map(role => {
          if (role.id !== selectedRoleId || isFull(role)) return role;
          return { ...role, applicants: [...role.applicants, applicantName.trim()] };
        }),
      };
    }));
    const roleLabel = modalPost?.roles.find(r => r.id === selectedRoleId)?.name ?? '';
    const title = modalPost?.title ?? '';
    closeApply();
    Alert.alert(t('volunteerSuccessTitle'), `${title}\n${roleLabel} ${t('volunteerSuccessSuffix')}`);
  }

  // ── Admin delete ─────────────────────────────────────────────────────────────
  function confirmDelete(post: VolunteerPost) {
    Alert.alert(
      t('volunteerDeleteTitle'),
      `"${post.title}" — ${t('volunteerDeleteMsg')}`,
      [
        { text: t('cancelBtn'), style: 'cancel' },
        {
          text: t('deleteLabel'), style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('volunteer_posts').delete().eq('id', post.id);
            if (error) {
              Alert.alert(t('errorTitle'), t('volunteerDeleteError'));
            } else {
              setPosts(prev => prev.filter(p => p.id !== post.id));
            }
          },
        },
      ],
    );
  }

  // ── Admin add ────────────────────────────────────────────────────────────────
  function resetAddForm() {
    setNewCategory('예배');
    setNewTitle('');
    setNewDate('');
    setNewTime('');
    setNewLocation('');
    setNewDesc('');
    setNewRoles([{ name: '', needed: '2' }]);
  }
  function openAddModal() {
    resetAddForm();
    setAddModalVisible(true);
  }
  function addRoleRow() {
    setNewRoles(prev => [...prev, { name: '', needed: '2' }]);
  }
  function removeRoleRow(index: number) {
    setNewRoles(prev => prev.filter((_, i) => i !== index));
  }
  function updateRoleRow(index: number, field: keyof RoleForm, value: string) {
    setNewRoles(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  async function saveNewPost() {
    if (!newTitle.trim()) {
      Alert.alert(t('errorTitle'), t('volunteerTitleError'));
      return;
    }
    if (!newDate.trim()) {
      Alert.alert(t('errorTitle'), t('volunteerDateError'));
      return;
    }
    const validRoles = newRoles.filter(r => r.name.trim());
    if (validRoles.length === 0) {
      Alert.alert(t('errorTitle'), t('volunteerRolesError'));
      return;
    }

    setSaving(true);
    const roles: VolunteerRole[] = validRoles.map((r, i) => ({
      id: `r_${Date.now()}_${i}`,
      name: r.name.trim(),
      needed: Math.max(1, parseInt(r.needed) || 2),
      applicants: [],
    }));

    const { data, error } = await supabase
      .from('volunteer_posts')
      .insert({
        category: newCategory,
        title: newTitle.trim(),
        date: newDate.trim(),
        time: newTime.trim(),
        location: newLocation.trim(),
        description: newDesc.trim(),
        roles,
      })
      .select()
      .single();

    setSaving(false);
    if (error || !data) {
      Alert.alert(t('errorTitle'), t('volunteerSaveError'));
      return;
    }
    setPosts(prev => [data as VolunteerPost, ...prev]);
    setAddModalVisible(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function renderPost({ item }: { item: VolunteerPost }) {
    const { needed, filled } = totalSpots(item);
    const allFull = filled >= needed;
    const catColor = CATEGORY_COLORS[item.category] ?? Colors.primary;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
            <Text style={styles.categoryText}>{catLabel(item.category, lang)}</Text>
          </View>
          {allFull && (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>{t('volunteerClosed')}</Text>
            </View>
          )}
          {isAdmin && (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
              <Text style={styles.deleteBtnText}>🗑</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📅</Text>
          <Text style={styles.infoText}>{item.date} {item.time || t('timeTbd')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📍</Text>
          <Text style={styles.infoText}>{item.location || t('locationTbd')}</Text>
        </View>
        {!!item.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        )}

        <View style={styles.rolesSection}>
          {item.roles.map(role => {
            const left = spotsLeft(role);
            const full = left <= 0;
            return (
              <View key={role.id} style={styles.roleRow}>
                <Text style={styles.roleName}>{role.name}</Text>
                <View style={styles.roleRight}>
                  <View style={styles.spotsBar}>
                    {Array.from({ length: Math.min(role.needed, 8) }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.spotDot,
                          i < role.applicants.length ? styles.spotDotFilled : styles.spotDotEmpty,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.spotsText, full && styles.spotsTextFull]}>
                    {full ? t('volunteerClosed') : `${left} ${t('volunteerSpotsLeft')}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.applyBtn, allFull && styles.applyBtnDisabled]}
          onPress={() => !allFull && openApply(item)}
          disabled={allFull}
        >
          <Text style={[styles.applyBtnText, allFull && styles.applyBtnTextDisabled]}>
            {allFull ? t('volunteerFull') : t('volunteerApply')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('volunteerTitle')}</Text>
          <Text style={styles.headerSub}>{t('volunteerSubtitle')}</Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Text style={styles.addBtnText}>{t('volunteerAddHeaderBtn')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('volunteerEmpty')}</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}>
              <Text style={styles.emptyAddBtnText}>{t('volunteerAddBtn')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderPost}
        />
      )}

      {/* ── Apply modal ── */}
      <Modal visible={modalPost !== null} animationType="slide" transparent={false} onRequestClose={closeApply}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeApply} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t('volunteerModalTitle')}</Text>
            <View style={{ width: 40 }} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {modalPost && (
                <>
                  <View style={styles.modalSummary}>
                    <Text style={styles.modalSummaryTitle}>{modalPost.title}</Text>
                    <Text style={styles.modalSummaryInfo}>📅 {modalPost.date} {modalPost.time}</Text>
                    <Text style={styles.modalSummaryInfo}>📍 {modalPost.location}</Text>
                  </View>
                  <Text style={styles.fieldLabel}>{t('volunteerSelectRole')} <Text style={styles.required}>*</Text></Text>
                  {modalPost.roles.map(role => {
                    const full = isFull(role);
                    const selected = selectedRoleId === role.id;
                    return (
                      <TouchableOpacity
                        key={role.id}
                        style={[styles.roleOption, selected && styles.roleOptionSelected, full && styles.roleOptionFull]}
                        onPress={() => !full && setSelectedRoleId(role.id)}
                        disabled={full}
                      >
                        <View style={styles.roleOptionLeft}>
                          <View style={[styles.radioCircle, selected && styles.radioCircleSelected, full && styles.radioCircleFull]}>
                            {selected && <View style={styles.radioDot} />}
                          </View>
                          <Text style={[styles.roleOptionName, full && styles.roleOptionNameFull]}>{role.name}</Text>
                        </View>
                        <Text style={[styles.roleOptionSpots, full && styles.roleOptionSpotsFull]}>
                          {full ? t('volunteerClosed') : `${spotsLeft(role)}/${role.needed} ${t('volunteerSpotsDisplay')}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={[styles.fieldLabel, { marginTop: 20 }]}>{t('volunteerName')} <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('volunteerNamePlaceholder')}
                    placeholderTextColor={Colors.text.light}
                    value={applicantName}
                    onChangeText={setApplicantName}
                  />
                  <TouchableOpacity style={styles.submitBtn} onPress={submitApplication}>
                    <Text style={styles.submitBtnText}>{t('volunteerSubmit')}</Text>
                  </TouchableOpacity>
                  <View style={{ height: 20 }} />
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Admin add modal ── */}
      <Modal visible={addModalVisible} animationType="slide" transparent={false} onRequestClose={() => setAddModalVisible(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t('volunteerRegisterTitle')}</Text>
            <TouchableOpacity onPress={saveNewPost} style={styles.saveBtn} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.saveBtnText}>{t('volunteerSaveBtn')}</Text>}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t('volunteerFieldCategory')}</Text>
              <View style={styles.categoryRow}>
                {CATEGORY_KEYS.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, newCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] ?? Colors.primary }]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text style={[styles.catChipText, newCategory === cat && styles.catChipTextActive]}>{catLabel(cat, lang)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('volunteerFieldTitle')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} placeholder={t('volunteerNamePlaceholder')} placeholderTextColor={Colors.text.light} value={newTitle} onChangeText={setNewTitle} />

              <Text style={styles.fieldLabel}>{t('volunteerFieldDate')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.text.light} value={newDate} onChangeText={setNewDate} />

              <Text style={styles.fieldLabel}>{t('volunteerFieldTime')}</Text>
              <TextInput style={styles.input} placeholder="e.g. 10:00 AM" placeholderTextColor={Colors.text.light} value={newTime} onChangeText={setNewTime} />

              <Text style={styles.fieldLabel}>{t('volunteerFieldLocation')}</Text>
              <TextInput style={styles.input} placeholder={t('volunteerLocation1')} placeholderTextColor={Colors.text.light} value={newLocation} onChangeText={setNewLocation} />

              <Text style={styles.fieldLabel}>{t('volunteerFieldDesc')}</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder={t('volunteerFieldDesc')}
                placeholderTextColor={Colors.text.light}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              <View style={styles.rolesHeader}>
                <Text style={styles.fieldLabel}>{t('volunteerFieldRoles')} <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity onPress={addRoleRow} style={styles.addRoleBtn}>
                  <Text style={styles.addRoleBtnText}>{t('volunteerAddRole')}</Text>
                </TouchableOpacity>
              </View>

              {newRoles.map((role, index) => (
                <View key={index} style={styles.roleFormRow}>
                  <TextInput
                    style={[styles.input, styles.roleFormName]}
                    placeholder={t('volunteerFieldRoles')}
                    placeholderTextColor={Colors.text.light}
                    value={role.name}
                    onChangeText={v => updateRoleRow(index, 'name', v)}
                  />
                  <TextInput
                    style={[styles.input, styles.roleFormNeeded]}
                    placeholder="#"
                    placeholderTextColor={Colors.text.light}
                    value={role.needed}
                    onChangeText={v => updateRoleRow(index, 'needed', v)}
                    keyboardType="number-pad"
                  />
                  {newRoles.length > 1 && (
                    <TouchableOpacity onPress={() => removeRoleRow(index)} style={styles.removeRoleBtn}>
                      <Text style={styles.removeRoleBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.primary },
  headerSub: { fontSize: 11, color: Colors.text.secondary, marginTop: 1 },
  addBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.primary, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 15, color: Colors.text.secondary },
  emptyAddBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: Colors.primary, borderRadius: 10,
  },
  emptyAddBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  categoryBadge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  categoryText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  fullBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  fullBadgeText: { color: '#C53030', fontSize: 11, fontWeight: '700' },
  deleteBtn: { marginLeft: 'auto' as any, padding: 4 },
  deleteBtnText: { fontSize: 16 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: Colors.text.primary, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoIcon: { fontSize: 13 },
  infoText: { fontSize: 13, color: Colors.text.secondary },
  cardDesc: { fontSize: 13, color: Colors.text.secondary, lineHeight: 20, marginTop: 8, marginBottom: 12 },
  rolesSection: {
    backgroundColor: Colors.background, borderRadius: 10,
    padding: 12, gap: 10, marginBottom: 14,
  },
  roleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleName: { fontSize: 13, fontWeight: '600', color: Colors.text.primary, flex: 1 },
  roleRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spotsBar: { flexDirection: 'row', gap: 3 },
  spotDot: { width: 8, height: 8, borderRadius: 4 },
  spotDotFilled: { backgroundColor: Colors.primary },
  spotDotEmpty: { backgroundColor: Colors.border },
  spotsText: { fontSize: 12, color: Colors.text.secondary, minWidth: 60, textAlign: 'right' },
  spotsTextFull: { color: '#C53030' },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: Colors.border },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  applyBtnTextDisabled: { color: Colors.text.secondary },
  modalRoot: { flex: 1, backgroundColor: Colors.white },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalCloseBtn: { width: 40, alignItems: 'center' },
  modalCloseText: { fontSize: 20, color: Colors.text.secondary },
  modalHeaderTitle: { fontSize: 17, fontWeight: '700', color: Colors.primary },
  saveBtn: { width: 60, alignItems: 'flex-end' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  modalScroll: { padding: 20 },
  modalSummary: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 16, marginBottom: 24,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  modalSummaryTitle: { fontSize: 16, fontWeight: '800', color: Colors.text.primary, marginBottom: 6 },
  modalSummaryInfo: { fontSize: 13, color: Colors.text.secondary, marginTop: 3 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.text.secondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  required: { color: '#E53E3E' },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 10, padding: 14, marginBottom: 8,
    backgroundColor: Colors.background,
  },
  roleOptionSelected: { borderColor: Colors.primary, backgroundColor: '#EBF4FF' },
  roleOptionFull: { opacity: 0.5 },
  roleOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primary },
  radioCircleFull: { borderColor: Colors.border },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  roleOptionName: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  roleOptionNameFull: { color: Colors.text.secondary },
  roleOptionSpots: { fontSize: 12, color: Colors.text.secondary },
  roleOptionSpotsFull: { color: '#C53030' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 14, fontSize: 14, marginBottom: 12,
    color: Colors.text.primary, backgroundColor: Colors.background,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  catChipText: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  catChipTextActive: { color: '#fff' },
  rolesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addRoleBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: Colors.primary + '18', borderRadius: 8,
  },
  addRoleBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  roleFormRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  roleFormName: { flex: 1, marginBottom: 8 },
  roleFormNeeded: { width: 70, marginBottom: 8 },
  removeRoleBtn: {
    width: 40, height: 48, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  removeRoleBtnText: { fontSize: 16, color: Colors.text.secondary },
});
