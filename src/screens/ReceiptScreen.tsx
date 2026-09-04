import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray } from 'base64-js';
import { MoreStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

type Props = NativeStackScreenProps<MoreStackParamList, 'Receipt'>;

const DEPARTMENTS = [
  { ko: '예배부', en: 'Worship', es: 'Adoración' },
  { ko: '교육부', en: 'Education', es: 'Educación' },
  { ko: '청년부', en: 'Young Adults', es: 'Jóvenes' },
  { ko: '청소년부', en: 'Youth', es: 'Juventud' },
  { ko: '어린이부', en: 'Children', es: 'Niños' },
  { ko: '행정부', en: 'Administration', es: 'Administración' },
  { ko: '기타', en: 'Other', es: 'Otro' },
];

const UI = {
  title:        { ko: '영수증 제출',       en: 'Receipt Submission',   es: 'Envío de Recibo'       },
  desc:         { ko: '지출 영수증을 제출해 주세요.', en: 'Submit your expense receipt.', es: 'Envía tu recibo de gastos.' },
  name:         { ko: '이름',              en: 'Name',                 es: 'Nombre'                },
  date:         { ko: '날짜 (YYYY-MM-DD)', en: 'Date (YYYY-MM-DD)',    es: 'Fecha (YYYY-MM-DD)'    },
  item:         { ko: '항목 (지출 내용)',   en: 'Item / Description',   es: 'Artículo / Descripción'},
  dept:         { ko: '부서',              en: 'Department',           es: 'Departamento'          },
  photo:        { ko: '영수증 사진',        en: 'Receipt Photo',        es: 'Foto del Recibo'       },
  addPhoto:     { ko: '사진 추가',          en: 'Add Photo',            es: 'Agregar Foto'          },
  changePhoto:  { ko: '사진 변경',          en: 'Change Photo',         es: 'Cambiar Foto'          },
  submit:       { ko: '제출하기',           en: 'Submit',               es: 'Enviar'                },
  submitting:   { ko: '제출 중...',         en: 'Submitting...',        es: 'Enviando...'           },
  cancel:       { ko: '취소',              en: 'Cancel',               es: 'Cancelar'              },
  selectDept:   { ko: '부서를 선택하세요',   en: 'Select department',    es: 'Seleccionar departamento'},
  errName:      { ko: '이름을 입력해 주세요.', en: 'Please enter your name.', es: 'Ingresa tu nombre.' },
  errDate:      { ko: '날짜를 입력해 주세요.', en: 'Please enter the date.', es: 'Ingresa la fecha.' },
  errItem:      { ko: '항목을 입력해 주세요.', en: 'Please enter the item.', es: 'Ingresa el artículo.' },
  errDept:      { ko: '부서를 선택해 주세요.', en: 'Please select a department.', es: 'Selecciona un departamento.' },
  errPhoto:     { ko: '영수증 사진을 추가해 주세요.', en: 'Please add a receipt photo.', es: 'Agrega la foto del recibo.' },
  success:      { ko: '영수증이 제출되었습니다. 감사합니다!', en: 'Receipt submitted. Thank you!', es: '¡Recibo enviado. Gracias!' },
  failUpload:   { ko: '사진 업로드에 실패했습니다. 다시 시도해 주세요.', en: 'Failed to upload photo. Please try again.', es: 'Error al subir la foto. Intenta de nuevo.' },
  failSubmit:   { ko: '제출에 실패했습니다. 다시 시도해 주세요.', en: 'Submission failed. Please try again.', es: 'Envío fallido. Intenta de nuevo.' },
};

function lu(key: keyof typeof UI, lang: string): string {
  const l: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
  return UI[key][l];
}

export default function ReceiptScreen({ navigation }: Props) {
  const { lang } = useLanguage();
  const { user, displayName } = useAuth();
  const L: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  const [name, setName]         = useState(displayName ?? user?.email?.split('@')[0] ?? '');
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [item, setItem]         = useState('');
  const [dept, setDept]         = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = lang === 'es' ? 'Se requiere permiso de acceso a las fotos.' : lang === 'ko' ? '사진 접근 권한이 필요합니다.' : 'Photo library permission is required.';
      Alert.alert('', msg);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function uploadPhoto(uri: string): Promise<string | null> {
    try {
      const ext = (uri.split('.').pop()?.toLowerCase() ?? 'jpg').replace(/\?.*$/, '');
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const mimeType = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';
      const path = `receipts/receipt_${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const bytes = toByteArray(base64);
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(path, bytes, { contentType: mimeType, upsert: false });
      if (error) { console.error('Receipt upload error:', error.message); return null; }
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(data.path);
      return publicUrl;
    } catch (e: any) {
      console.error('uploadPhoto error:', e?.message);
      return null;
    }
  }

  async function handleSubmit() {
    if (!name.trim())  { Alert.alert('', lu('errName', lang));  return; }
    if (!date.trim())  { Alert.alert('', lu('errDate', lang));  return; }
    if (!item.trim())  { Alert.alert('', lu('errItem', lang));  return; }
    if (!dept)         { Alert.alert('', lu('errDept', lang));  return; }
    if (!photoUri)     { Alert.alert('', lu('errPhoto', lang)); return; }

    setSubmitting(true);
    try {
      const photoUrl = await uploadPhoto(photoUri);
      if (!photoUrl) {
        const title = lang === 'es' ? 'Carga Fallida' : lang === 'ko' ? '업로드 실패' : 'Upload Failed';
        const body  = lang === 'es'
          ? 'Falló la carga de la foto del recibo. Inténtalo de nuevo.'
          : lang === 'ko'
            ? '영수증 사진 업로드에 실패했습니다. 다시 시도해 주세요.'
            : 'Receipt photo upload failed. Please try again.';
        Alert.alert(title, body);
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('receipts').insert({
        submitter_name: name.trim(),
        expense_date: date.trim(),
        item: item.trim(),
        department: dept,
        photo_url: photoUrl,
        submitted_by: user?.id ?? null,
        status: 'pending',
      });

      if (error) {
        Alert.alert('', lu('failSubmit', lang));
      } else {
        Alert.alert('✓', lu('success', lang), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch {
      Alert.alert('', lu('failSubmit', lang));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{lu('title', lang)}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.desc}>{lu('desc', lang)}</Text>

          {/* 이름 */}
          <Text style={styles.label}>{lu('name', lang)}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={lu('name', lang)}
            placeholderTextColor={Colors.text.light}
          />

          {/* 날짜 */}
          <Text style={styles.label}>{lu('date', lang)}</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="2026-04-21"
            placeholderTextColor={Colors.text.light}
            keyboardType="numbers-and-punctuation"
          />

          {/* 항목 */}
          <Text style={styles.label}>{lu('item', lang)}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={item}
            onChangeText={setItem}
            placeholder={lu('item', lang)}
            placeholderTextColor={Colors.text.light}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* 부서 선택 */}
          <Text style={styles.label}>{lu('dept', lang)}</Text>
          <TouchableOpacity
            style={[styles.input, styles.deptSelect]}
            onPress={() => setDeptOpen(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.deptSelectText, !dept && styles.deptPlaceholder]}>
              {dept ? DEPARTMENTS.find(d => d.ko === dept)?.[L] ?? dept : lu('selectDept', lang)}
            </Text>
            <Text style={styles.deptChevron}>{deptOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {deptOpen && (
            <View style={styles.deptDropdown}>
              {DEPARTMENTS.map((d, i) => (
                <TouchableOpacity
                  key={d.ko}
                  style={[styles.deptOption, i < DEPARTMENTS.length - 1 && styles.deptOptionBorder, dept === d.ko && styles.deptOptionActive]}
                  onPress={() => { setDept(d.ko); setDeptOpen(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.deptOptionText, dept === d.ko && styles.deptOptionTextActive]}>
                    {d[L]}
                  </Text>
                  {dept === d.ko && <Text style={styles.deptCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 영수증 사진 */}
          <Text style={[styles.label, { marginTop: 20 }]}>{lu('photo', lang)}</Text>
          {photoUri ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
              <TouchableOpacity style={styles.changePhotoBtn} onPress={pickImage} activeOpacity={0.8}>
                <Text style={styles.changePhotoBtnText}>{lu('changePhoto', lang)}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoPlaceholder} onPress={pickImage} activeOpacity={0.8}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={styles.photoPlaceholderText}>{lu('addPhoto', lang)}</Text>
            </TouchableOpacity>
          )}

          {/* 제출 버튼 */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.submitBtnText}>{lu('submit', lang)}</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backBtn: { width: 36 },
  backText: { fontSize: 28, color: Colors.primary, lineHeight: 30 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.text.primary },

  content: { padding: 20 },

  desc: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 24,
    lineHeight: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: 16,
  },

  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.text.primary,
  },
  inputMulti: {
    minHeight: 80,
  },

  // 부서 드롭다운
  deptSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deptSelectText: { fontSize: 15, color: Colors.text.primary, flex: 1 },
  deptPlaceholder: { color: Colors.text.light },
  deptChevron: { fontSize: 12, color: Colors.text.secondary, marginLeft: 8 },
  deptDropdown: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  deptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  deptOptionBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  deptOptionActive: { backgroundColor: '#EBF4FF' },
  deptOptionText: { fontSize: 15, color: Colors.text.primary, fontWeight: '500' },
  deptOptionTextActive: { color: Colors.primary, fontWeight: '700' },
  deptCheck: { fontSize: 14, color: Colors.primary, fontWeight: '800' },

  // 사진
  photoWrap: { borderRadius: 12, overflow: 'hidden' },
  photoPreview: { width: '100%', height: 200 },
  changePhotoBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  changePhotoBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  photoPlaceholder: {
    height: 140,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderIcon: { fontSize: 32 },
  photoPlaceholderText: { fontSize: 14, color: Colors.text.secondary, fontWeight: '600' },

  // 제출
  submitBtn: {
    marginTop: 28,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
