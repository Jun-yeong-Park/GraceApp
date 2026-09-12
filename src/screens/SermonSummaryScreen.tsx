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
import { MoreStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import Icon from '../components/Icon';

type Props = NativeStackScreenProps<MoreStackParamList, 'SermonSummary'>;

interface SermonSummary {
  id: string;
  date: string;
  preacher: string;
  scripture: string;
  title_ko: string;
  title_en: string;
  title_es: string;
  body_ko: string;
  body_en: string;
  body_es: string;
  is_published: boolean;
  created_at: string;
}


export default function SermonSummaryScreen({ navigation }: Props) {
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();

  const [summaries, setSummaries] = useState<SermonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Admin add modal ──────────────────────────────────────────────────────
  const [addModal, setAddModal] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formPreacher, setFormPreacher] = useState('');
  const [formScripture, setFormScripture] = useState('');
  const [formTitleKo, setFormTitleKo] = useState('');
  const [formBodyKo, setFormBodyKo] = useState('');
  const [formTitleEn, setFormTitleEn] = useState('');
  const [formBodyEn, setFormBodyEn] = useState('');
  const [formTitleEs, setFormTitleEs] = useState('');
  const [formBodyEs, setFormBodyEs] = useState('');
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('sermon_summaries')
      .select('*')
      .order('date', { ascending: false });
    if (!isAdmin) query = query.eq('is_published', true);
    const { data } = await query;
    if (data) setSummaries(data as SermonSummary[]);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { loadSummaries(); }, [loadSummaries]);

  function resetForm() {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPreacher('');
    setFormScripture('');
    setFormTitleKo('');
    setFormBodyKo('');
    setFormTitleEn('');
    setFormBodyEn('');
    setFormTitleEs('');
    setFormBodyEs('');
  }

  function splitChunks(text: string, maxLen = 400): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      if (line.length <= maxLen) { chunks.push(line); continue; }
      let remaining = line;
      while (remaining.length > maxLen) {
        let idx = remaining.lastIndexOf('. ', maxLen);
        if (idx === -1) idx = remaining.lastIndexOf(' ', maxLen);
        if (idx === -1) idx = maxLen;
        chunks.push(remaining.slice(0, idx).trim());
        remaining = remaining.slice(idx).trim();
      }
      if (remaining) chunks.push(remaining);
    }
    return chunks.filter(c => c.trim());
  }

  async function translateChunk(text: string, target: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err: any) {
      throw new Error(`Connection failed: ${err?.message ?? err}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json[0] as any[][]).map((item: any[]) => item[0] ?? '').join('');
  }

  async function translateLong(text: string, target: string): Promise<string> {
    const chunks = splitChunks(text);
    const results = await Promise.all(chunks.map(c => translateChunk(c, target)));
    return results.join('\n');
  }

  async function autoTranslate() {
    if (!formTitleKo.trim() || !formBodyKo.trim()) {
      Alert.alert(
        lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류',
        lang === 'en' ? 'Please enter the Korean title and body first.' : lang === 'es' ? 'Ingresa primero el título y contenido en coreano.' : '한국어 제목과 내용을 먼저 입력해주세요.'
      );
      return;
    }
    setTranslating(true);
    try {
      const [titleEn, bodyEn, titleEs, bodyEs] = await Promise.all([
        translateChunk(formTitleKo.trim(), 'en'),
        translateLong(formBodyKo.trim(), 'en'),
        translateChunk(formTitleKo.trim(), 'es'),
        translateLong(formBodyKo.trim(), 'es'),
      ]);
      setFormTitleEn(titleEn);
      setFormBodyEn(bodyEn);
      setFormTitleEs(titleEs);
      setFormBodyEs(bodyEs);
    } catch (e: any) {
      Alert.alert(
        lang === 'en' ? 'Translation Error' : lang === 'es' ? 'Error de traducción' : '번역 오류',
        e.message ?? (lang === 'en' ? 'Please try again.' : lang === 'es' ? 'Inténtalo de nuevo.' : '다시 시도해주세요.')
      );
    } finally {
      setTranslating(false);
    }
  }

  async function saveSummary() {
    if (!formDate.trim() || !formTitleKo.trim() || !formBodyKo.trim()) {
      Alert.alert(
        lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류',
        lang === 'en' ? 'Date, title, and body are required.' : lang === 'es' ? 'Fecha, título y contenido son obligatorios.' : '날짜, 제목, 내용은 필수입니다.'
      );
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('sermon_summaries')
      .insert({
        date: formDate.trim(),
        preacher: formPreacher.trim(),
        scripture: formScripture.trim(),
        title_ko: formTitleKo.trim(),
        body_ko: formBodyKo.trim(),
        title_en: formTitleEn.trim(),
        body_en: formBodyEn.trim(),
        title_es: formTitleEs.trim(),
        body_es: formBodyEs.trim(),
        is_published: true,
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      Alert.alert(
        lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류',
        (lang === 'en' ? 'An error occurred while saving.\n' : lang === 'es' ? 'Ocurrió un error al guardar.\n' : '저장 중 오류가 발생했습니다.\n') + (error?.message ?? '')
      );
      return;
    }
    setSummaries(prev => [data as SermonSummary, ...prev]);
    setAddModal(false);
  }

  async function deleteSummary(id: string, title: string) {
    const T = {
      title:   lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제',
      msg:     lang === 'en' ? `Delete summary "${title}"?` : lang === 'es' ? `¿Eliminar el resumen "${title}"?` : `"${title}" 요약을 삭제하시겠습니까?`,
      cancel:  lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : '취소',
      del:     lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : '삭제',
      error:   lang === 'en' ? 'Error' : lang === 'es' ? 'Error' : '오류',
    };
    Alert.alert(T.title, T.msg, [
      { text: T.cancel, style: 'cancel' },
      {
        text: T.del, style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('sermon_summaries').delete().eq('id', id);
          if (error) { Alert.alert(T.error, error.message); return; }
          setSummaries(prev => prev.filter(s => s.id !== id));
        },
      },
    ]);
  }

  function getTitle(item: SermonSummary) {
    if (lang === 'en') return item.title_en || item.title_ko;
    if (lang === 'es') return item.title_es || item.title_ko;
    return item.title_ko;
  }

  function getBody(item: SermonSummary) {
    if (lang === 'en') return item.body_en || item.body_ko;
    if (lang === 'es') return item.body_es || item.body_ko;
    return item.body_ko;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {lang === 'en' ? 'Sermon Summary' : lang === 'es' ? 'Resumen del Sermón' : '설교 요약'}
        </Text>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { resetForm(); setAddModal(true); }}
          >
            <Text style={styles.addBtnText}>{lang === 'en' ? '+ Add' : lang === 'es' ? '+ Añadir' : '+ 추가'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : summaries.length === 0 ? (
        <View style={styles.emptyBox}>
          <Icon name="tab-bible" size={56} tintColor={Colors.text.light} />
          <Text style={styles.emptyText}>
            {lang === 'en' ? 'No sermon summaries yet' : lang === 'es' ? 'Sin resúmenes aún' : '등록된 설교 요약이 없습니다'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={summaries}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{item.date}</Text>
                </View>
                {!!item.scripture && (
                  <View style={styles.scriptureBadge}>
                    <Text style={styles.scriptureBadgeText}>📖 {item.scripture}</Text>
                  </View>
                )}
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => deleteSummary(item.id, item.title_ko)}
                    style={styles.deleteBtn}
                  >
                    <Icon name="more-delete" size={18} tintColor="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>

              {!!item.preacher && (
                <Text style={styles.preacher}>
                  {lang === 'en' ? 'Preacher: ' : lang === 'es' ? 'Predicador: ' : '설교자: '}{item.preacher}
                </Text>
              )}

              <Text style={styles.cardTitle}>{getTitle(item)}</Text>
              <Text style={styles.cardBody}>{getBody(item)}</Text>

              {isAdmin && (
                <View style={styles.langRow}>
                  {(['ko', 'en', 'es'] as const).map(l => {
                    const has = l === 'ko' ? !!item.title_ko : l === 'en' ? !!item.title_en : !!item.title_es;
                    return (
                      <View
                        key={l}
                        style={[styles.langDot, { backgroundColor: has ? '#22C55E' : Colors.border }]}
                      >
                        <Text style={styles.langDotText}>{l.toUpperCase()}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* ── Admin 추가 모달 ── */}
      <Modal visible={addModal} animationType="slide" transparent={false} onRequestClose={() => setAddModal(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddModal(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{lang === 'en' ? 'Add Sermon Summary' : lang === 'es' ? 'Agregar Resumen' : '설교 요약 등록'}</Text>
            <TouchableOpacity onPress={saveSummary} style={styles.saveBtn} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={styles.saveBtnText}>{lang === 'en' ? 'Save' : lang === 'es' ? 'Guardar' : '저장'}</Text>
              }
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">

              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Date' : lang === 'es' ? 'Fecha' : '날짜'} <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} placeholder={lang === 'en' ? 'e.g. 2026-06-15' : lang === 'es' ? 'ej. 2026-06-15' : '예: 2026-06-15'} placeholderTextColor={Colors.text.light} value={formDate} onChangeText={setFormDate} />

              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Preacher' : lang === 'es' ? 'Predicador' : '설교자'}</Text>
              <TextInput style={styles.input} placeholder={lang === 'en' ? 'e.g. Pastor Joshua' : lang === 'es' ? 'ej. Pastor Joshua' : '예: 정경원 목사'} placeholderTextColor={Colors.text.light} value={formPreacher} onChangeText={setFormPreacher} />

              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Scripture' : lang === 'es' ? 'Escritura' : '성경 본문'}</Text>
              <TextInput style={styles.input} placeholder={lang === 'en' ? 'e.g. John 3:16' : lang === 'es' ? 'ej. Juan 3:16' : '예: 요한복음 3:16'} placeholderTextColor={Colors.text.light} value={formScripture} onChangeText={setFormScripture} />

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>🇰🇷 {lang === 'en' ? 'Korean (required)' : lang === 'es' ? 'Coreano (obligatorio)' : '한국어 (필수)'}</Text>
              </View>

              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Title' : lang === 'es' ? 'Título' : '제목'} <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} placeholder={lang === 'en' ? 'Sermon title (Korean)' : lang === 'es' ? 'Título del sermón (coreano)' : '설교 제목'} placeholderTextColor={Colors.text.light} value={formTitleKo} onChangeText={setFormTitleKo} />

              <Text style={styles.fieldLabel}>{lang === 'en' ? 'Body' : lang === 'es' ? 'Contenido' : '내용'} <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={lang === 'en' ? 'Paste the summary generated from seolgyo-ai.com' : lang === 'es' ? 'Pega el resumen generado en seolgyo-ai.com' : 'seolgyo-ai.com에서 생성한 요약을 여기에 붙여넣으세요'}
                placeholderTextColor={Colors.text.light}
                value={formBodyKo}
                onChangeText={setFormBodyKo}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.translateBtn, translating && { opacity: 0.7 }]}
                onPress={autoTranslate}
                disabled={translating}
              >
                {translating ? (
                  <View style={styles.translateBtnInner}>
                    <ActivityIndicator size="small" color={Colors.white} />
                    <Text style={styles.translateBtnText}>{lang === 'en' ? 'Translating…' : lang === 'es' ? 'Traduciendo…' : '번역 중...'}</Text>
                  </View>
                ) : (
                  <Text style={styles.translateBtnText}>{lang === 'en' ? '✨ Auto Translate (English + Spanish)' : lang === 'es' ? '✨ Traducción automática (inglés + español)' : '✨ 자동 번역 (영어 + 스페인어)'}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>🇺🇸 English {lang === 'en' ? '(auto-translated)' : lang === 'es' ? '(traducción automática)' : '(자동 번역)'}</Text>
              </View>

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput style={styles.input} placeholder="Auto-translated" placeholderTextColor={Colors.text.light} value={formTitleEn} onChangeText={setFormTitleEn} />

              <Text style={styles.fieldLabel}>Summary</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Auto-translated"
                placeholderTextColor={Colors.text.light}
                value={formBodyEn}
                onChangeText={setFormBodyEn}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>🇪🇸 Español {lang === 'en' ? '(auto-translated)' : lang === 'es' ? '(traducción automática)' : '(자동 번역)'}</Text>
              </View>

              <Text style={styles.fieldLabel}>Título</Text>
              <TextInput style={styles.input} placeholder="Traducción automática" placeholderTextColor={Colors.text.light} value={formTitleEs} onChangeText={setFormTitleEs} />

              <Text style={styles.fieldLabel}>Resumen</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Traducción automática"
                placeholderTextColor={Colors.text.light}
                value={formBodyEs}
                onChangeText={setFormBodyEs}
                multiline
                textAlignVertical="top"
              />

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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.primary },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primary, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.text.secondary },
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  dateBadge: { backgroundColor: Colors.primary + '18', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  dateBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  scriptureBadge: { backgroundColor: Colors.secondary + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  scriptureBadgeText: { fontSize: 12, color: Colors.text.secondary },
  deleteBtn: { marginLeft: 'auto' as any, padding: 4 },
  deleteBtnText: { fontSize: 16 },
  preacher: { fontSize: 12, color: Colors.text.secondary, marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: Colors.text.primary, marginBottom: 10, lineHeight: 24 },
  cardBody: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22 },
  langRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  langDot: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  langDotText: { fontSize: 10, fontWeight: '700', color: Colors.white },
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
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.text.secondary,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  req: { color: '#E53E3E' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 14, fontSize: 14, marginBottom: 12,
    color: Colors.text.primary, backgroundColor: Colors.background,
  },
  textArea: { height: 120 },
  sectionDivider: {
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, marginTop: 4,
  },
  sectionDividerText: { fontSize: 13, fontWeight: '700', color: Colors.text.secondary },
  translateBtn: {
    backgroundColor: '#7C3AED', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  translateBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  translateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
