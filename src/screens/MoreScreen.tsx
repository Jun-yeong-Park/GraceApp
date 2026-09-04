import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreTabParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { Language, translations } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

type Props = NativeStackScreenProps<MoreTabParamList, 'MoreMain'>;

const NOTIF_KEY = '@grace_notifications_enabled';

const INSTAGRAM_URL = 'https://www.instagram.com/sunlight_gracechurch?igsh=MWdmYjJrdWIzYzFmbw==';
const FACEBOOK_URL  = 'https://www.facebook.com/share/1CsvnFLf8d/';
const WEBSITE_URL   = 'https://sunlightgrace.org';

const STAFF = [
  {
    role:  { ko: '담임목사', en: 'Senior Pastor',    es: 'Pastor Principal' },
    name:  { ko: '정경원 목사', en: 'Pastor Joshua', es: 'Pastor Joshua' },
    email: 'joccjosh@gmail.com',
    phone: '(321) 438-3443',
    color: Colors.primary,
  },
  {
    role:  { ko: '전도사', en: 'Associate Pastor', es: 'Pastor Asociado' },
    name:  { ko: '허강현 전도사', en: 'Pastor Kang', es: 'Pastor Kang' },
    email: 'kanghyeon@sunlightcc.org',
    phone: '(616) 752-0594',
    color: '#2D6A4F',
  },
];

const LANGS: { code: Language; flag: string; label: string }[] = [
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];


type L = 'ko' | 'en' | 'es';

const UI = {
  title:      { ko: '더보기', en: 'More', es: 'Más' },
  // profile
  hello:      { ko: '안녕하세요', en: 'Hello', es: 'Hola' },
  pastor:     { ko: '목사/전도사', en: 'Pastor', es: 'Pastor' },
  member:     { ko: '성도', es: 'Miembro', en: 'Member' },
  deacon:     { ko: '집사', en: 'Deacon', es: 'Diácono' },
  loginPrompt: { ko: '로그인하여 모든 기능을 이용하세요', en: 'Sign in to use all features', es: 'Inicia sesión para usar todo' },
  loginBtn:   { ko: '로그인 / 회원가입', en: 'Sign In / Sign Up', es: 'Entrar / Registrarse' },
  // sections
  sSettings:  { ko: '설정', en: 'Settings', es: 'Ajustes' },
  sChurch:    { ko: '교회 정보', en: 'Church', es: 'Iglesia' },
  sAccount:   { ko: '계정', en: 'Account', es: 'Cuenta' },
  sAdmin:     { ko: '관리자', en: 'Admin', es: 'Admin' },
  // items
  language:   { ko: '언어 / Language', en: 'Language', es: 'Idioma' },
  notif:      { ko: '알림', en: 'Notifications', es: 'Notificaciones' },
  privacy:    { ko: '개인정보 처리방침', en: 'Privacy Policy', es: 'Política de Privacidad' },
  eula:       { ko: '이용약관',          en: 'Terms of Use',   es: 'Términos de Uso' },
  directory:  { ko: '교회 요람', en: 'Directory', es: 'Directorio' },
  receipt:    { ko: '영수증 제출', en: 'Submit Receipt', es: 'Enviar Recibo' },
  dashboard:  { ko: '관리자 대시보드', en: 'Admin Dashboard', es: 'Panel Admin' },
  logout:     { ko: '로그아웃', en: 'Sign Out', es: 'Cerrar sesión' },
  deleteAcct: { ko: '계정 삭제', en: 'Delete Account', es: 'Eliminar cuenta' },
  blocked:    { ko: '차단한 사용자 관리', en: 'Manage Blocked Users', es: 'Gestionar Usuarios Bloqueados' },
  // staff
  sStaff:     { ko: '섬기는 분들', en: 'Our Staff', es: 'Nuestro Equipo' },
  sSocial:    { ko: '소셜 & 링크', en: 'Social & Links', es: 'Redes & Links' },
  // confirm
  logoutTitle: { ko: '로그아웃', en: 'Sign Out', es: 'Cerrar sesión' },
  logoutMsg:   { ko: '로그아웃하시겠습니까?', en: 'Are you sure?', es: '¿Cerrar sesión?' },
  logoutOk:    { ko: '로그아웃', en: 'Sign Out', es: 'Cerrar sesión' },
  deleteTitle: { ko: '계정 삭제', en: 'Delete Account', es: 'Eliminar cuenta' },
  deleteMsg:   { ko: '계정을 삭제하시겠습니까?\n삭제 요청은 관리자에게 전달되며, 로그아웃됩니다.', en: 'Delete your account?\nThe request will be sent to admin and you will be signed out.', es: '¿Eliminar tu cuenta?\nLa solicitud se enviará al admin.' },
  deleteOk:    { ko: '삭제 요청', en: 'Request Deletion', es: 'Solicitar eliminación' },
  cancel:      { ko: '취소', en: 'Cancel', es: 'Cancelar' },
  close:       { ko: '닫기', en: 'Close', es: 'Cerrar' },
  pastorOnly:  { ko: '목회자 전용', en: 'Pastor only', es: 'Solo pastor' },
  changeName:  { ko: '이름 변경', en: 'Change Name', es: 'Cambiar nombre' },
  nameLabel:   { ko: '이름', en: 'Name', es: 'Nombre' },
  namePlaceholder: { ko: '이름을 입력하세요', en: 'Enter your name', es: 'Ingresa tu nombre' },
  nameSave:    { ko: '저장', en: 'Save', es: 'Guardar' },
  nameSuccess: { ko: '이름이 변경되었습니다.', en: 'Name updated.', es: 'Nombre actualizado.' },
};

function lu(key: keyof typeof UI, l: L): string {
  return UI[key]?.[l] ?? UI[key]?.ko ?? '';
}

export default function MoreScreen({ navigation }: Props) {
  const { lang, setLang } = useLanguage();
  const { user, role, isPastor, displayName, refreshRole, signIn, signUp, signOut } = useAuth();
  const l: L = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [loginModal, setLoginModal] = useState(false);
  const [loginTab, setLoginTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [nameModal, setNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [eulaAgreed, setEulaAgreed] = useState(false);

  function openLogin(tab: 'login' | 'signup' = 'login') {
    setLoginTab(tab); setEmail(''); setPassword(''); setName(''); setConfirm(''); setEulaAgreed(false);
    setLoginModal(true);
  }
  function closeLogin() {
    setEmail(''); setPassword(''); setName(''); setConfirm(''); setEulaAgreed(false);
    setLoginModal(false);
  }

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        if (error.includes('Email not confirmed') || error.includes('email_not_confirmed')) {
          Alert.alert(translations[lang].emailVerificationTitle, translations[lang].emailVerificationMsg);
        } else {
          Alert.alert('', translations[lang].invalidCredentials);
        }
      } else {
        closeLogin();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp() {
    const M = {
      nameReq:    { ko: '이름을 입력해 주세요.',         en: 'Please enter your name.',                es: 'Por favor ingresa tu nombre.' },
      emailReq:   { ko: '이메일을 입력해 주세요.',       en: 'Please enter your email.',               es: 'Por favor ingresa tu correo.' },
      pwShort:    { ko: '비밀번호는 6자 이상이어야 합니다.', en: 'Password must be at least 6 characters.', es: 'La contraseña debe tener al menos 6 caracteres.' },
      pwMismatch: { ko: '비밀번호가 일치하지 않습니다.', en: 'Passwords do not match.',                es: 'Las contraseñas no coinciden.' },
      eulaReq:    { ko: '회원가입을 위해서는 이용약관에 동의해 주세요.', en: 'You must agree to the Terms of Use to sign up.', es: 'Debe aceptar los Términos de Uso para registrarse.' },
      success:    { ko: '가입이 완료되었습니다!\n이메일 인증 후 로그인해 주세요.', en: 'Account created!\nPlease verify your email to sign in.', es: '¡Cuenta creada!\nVerifica tu correo para iniciar sesión.' },
    };
    if (!name.trim())     { Alert.alert('', M.nameReq[l]);    return; }
    if (!email.trim())    { Alert.alert('', M.emailReq[l]);   return; }
    if (password.length < 6) { Alert.alert('', M.pwShort[l]); return; }
    if (password !== confirm) { Alert.alert('', M.pwMismatch[l]); return; }
    if (!eulaAgreed) { Alert.alert('', M.eulaReq[l]); return; }
    setSubmitting(true);
    try {
      const { error } = await signUp(email.trim(), password, name.trim());
      if (error) Alert.alert('', error);
      else {
        // Record EULA acceptance on profile (best-effort; column added via migration)
        try {
          const { data: { user: newUser } } = await supabase.auth.getUser();
          if (newUser) {
            await supabase.from('profiles').update({ eula_accepted_at: new Date().toISOString() }).eq('id', newUser.id);
          }
        } catch { /* ignore */ }
        closeLogin();
        Alert.alert('✓', M.success[l]);
      }
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY)
      .then((v) => setNotifEnabled(v === 'true'))
      .catch(() => {});
  }, []);

  function toggleNotif(val: boolean) {
    setNotifEnabled(val);
    AsyncStorage.setItem(NOTIF_KEY, val ? 'true' : 'false');
  }

  function handleSignOut() {
    Alert.alert(lu('logoutTitle', l), lu('logoutMsg', l), [
      { text: lu('cancel', l), style: 'cancel' },
      { text: lu('logoutOk', l), style: 'destructive', onPress: () => signOut() },
    ]);
  }

  async function handleChangeName() {
    if (!newName.trim()) return;
    setNameSaving(true);
    const { error: authErr } = await supabase.auth.updateUser({ data: { full_name: newName.trim() } });
    if (authErr) { setNameSaving(false); Alert.alert('', authErr.message); return; }
    if (user) {
      const { error: dbErr } = await supabase.from('profiles').update({ full_name: newName.trim() }).eq('id', user.id);
      if (dbErr) { setNameSaving(false); Alert.alert('', dbErr.message); return; }
    }
    await refreshRole();
    setNameSaving(false);
    setNameModal(false);
    Alert.alert('✓', lu('nameSuccess', l));
  }

  function handleDeleteAccount() {
    Alert.alert(lu('deleteTitle', l), lu('deleteMsg', l), [
      { text: lu('cancel', l), style: 'cancel' },
      {
        text: lu('deleteOk', l),
        style: 'destructive',
        onPress: () => {
          signOut();
          Alert.alert('', translations[lang].accountDeletionRequested);
        },
      },
    ]);
  }

  const roleLabel =
    role === 'pastor' ? lu('pastor', l)
    : role === 'deacon' ? lu('deacon', l)
    : lu('member', l);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{lu('title', l)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── 프로필 카드 ── */}
        <View style={styles.profileCard}>
          {user ? (
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(displayName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                {displayName ? (
                  <Text style={styles.profileName}>{displayName}</Text>
                ) : null}
                <Text style={styles.profileEmail}>{user.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: isPastor ? '#7C3AED18' : '#2b588a18' }]}>
                  <Text style={[styles.roleBadgeText, { color: isPastor ? '#7C3AED' : Colors.primary }]}>
                    {roleLabel}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.guestRow}>
              <Text style={styles.guestText}>{lu('loginPrompt', l)}</Text>
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => openLogin('login')}
                activeOpacity={0.8}
              >
                <Text style={styles.loginBtnText}>{lu('loginBtn', l)}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 설정 ── */}
        <Text style={styles.sectionLabel}>{lu('sSettings', l)}</Text>
        <View style={styles.card}>
          {/* 언어 */}
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Text style={styles.rowIcon}>🌐</Text>
            </View>
            <Text style={styles.rowLabel}>{lu('language', l)}</Text>
            <View style={styles.langPills}>
              {LANGS.map((lng) => (
                <TouchableOpacity
                  key={lng.code}
                  style={[styles.langPill, lang === lng.code && styles.langPillActive]}
                  onPress={() => setLang(lng.code)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.langPillFlag}>{lng.flag}</Text>
                  <Text style={[styles.langPillText, lang === lng.code && styles.langPillTextActive]}>
                    {lng.code.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* 알림 */}
          <View style={styles.row}>
            <View style={[styles.rowIconWrap, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.rowIcon}>🔔</Text>
            </View>
            <Text style={styles.rowLabel}>{lu('notif', l)}</Text>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotif}
              trackColor={{ false: '#ddd', true: Colors.primary + '80' }}
              thumbColor={notifEnabled ? Colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={styles.divider} />

          {/* 개인정보 처리방침 */}
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('PrivacyPolicy')} activeOpacity={0.75}>
            <View style={[styles.rowIconWrap, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.rowIcon}>🔒</Text>
            </View>
            <Text style={styles.rowLabel}>{lu('privacy', l)}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 이용약관 */}
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Eula')} activeOpacity={0.75}>
            <View style={[styles.rowIconWrap, { backgroundColor: '#F3E5F5' }]}>
              <Text style={styles.rowIcon}>📜</Text>
            </View>
            <Text style={styles.rowLabel}>{lu('eula', l)}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── 교회 정보 ── */}
        <Text style={styles.sectionLabel}>{lu('sChurch', l)}</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Directory')} activeOpacity={0.75}>
            <View style={[styles.rowIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Text style={styles.rowIcon}>📒</Text>
            </View>
            <Text style={styles.rowLabel}>{lu('directory', l)}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Receipt')} activeOpacity={0.75}>
            <View style={[styles.rowIconWrap, { backgroundColor: '#FEF9E7' }]}>
              <Text style={styles.rowIcon}>🧾</Text>
            </View>
            <Text style={styles.rowLabel}>{lu('receipt', l)}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── 섬기는 분들 ── */}
        <Text style={styles.sectionLabel}>{lu('sStaff', l)}</Text>
        <View style={styles.card}>
          {STAFF.map((person, i) => (
            <View key={person.email} style={[styles.staffRow, i < STAFF.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
              <View style={[styles.staffAvatar, { backgroundColor: person.color + '20' }]}>
                <Text style={[styles.staffAvatarText, { color: person.color }]}>
                  {person.name[l].charAt(0)}
                </Text>
              </View>
              <View style={styles.staffInfo}>
                <Text style={styles.staffRole}>{person.role[l]}</Text>
                <Text style={styles.staffName}>{person.name[l]}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={() => Linking.openURL(`tel:${person.phone.replace(/\D/g, '')}`)}
                  >
                    <Text style={styles.contactBtnText}>📞 {person.phone}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={() => Linking.openURL(`mailto:${person.email}`)}
                  >
                    <Text style={styles.contactBtnText}>✉️ {person.email}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ── 소셜 & 링크 ── */}
        <Text style={styles.sectionLabel}>{lu('sSocial', l)}</Text>
        <View style={styles.card}>
          {[
            { icon: '📷', label: 'Instagram', url: INSTAGRAM_URL, color: '#C13584' },
            { icon: '👥', label: 'Facebook',  url: FACEBOOK_URL,  color: '#1877F2' },
            { icon: '🌐', label: l === 'ko' ? '교회 홈페이지' : l === 'es' ? 'Sitio Web' : 'Website', url: WEBSITE_URL, color: Colors.primary },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.url}
              style={[styles.row, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.75}
            >
              <View style={[styles.rowIconWrap, { backgroundColor: item.color + '18' }]}>
                <Text style={styles.rowIcon}>{item.icon}</Text>
              </View>
              <Text style={[styles.rowLabel, { color: item.color }]}>{item.label}</Text>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 관리자 대시보드 (목회자 전용) ── */}
        {isPastor && (
          <>
            <Text style={styles.sectionLabel}>{lu('sAdmin', l)}</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('Admin')}
                activeOpacity={0.75}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: '#EDE9FE' }]}>
                  <Text style={styles.rowIcon}>⚙️</Text>
                </View>
                <Text style={styles.rowLabel}>{lu('dashboard', l)}</Text>
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>{lu('pastorOnly', l)}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── 계정 (로그인된 경우만) ── */}
        {user && (
          <>
            <Text style={styles.sectionLabel}>{lu('sAccount', l)}</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => { setNewName(displayName ?? ''); setNameModal(true); }}
                activeOpacity={0.75}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={styles.rowIcon}>✏️</Text>
                </View>
                <Text style={styles.rowLabel}>{lu('changeName', l)}</Text>
                {displayName ? <Text style={styles.currentName}>{displayName}</Text> : null}
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('BlockedUsers')}
                activeOpacity={0.75}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={styles.rowIcon}>🚫</Text>
                </View>
                <Text style={styles.rowLabel}>{lu('blocked', l)}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.75}>
                <View style={[styles.rowIconWrap, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={styles.rowIcon}>🚪</Text>
                </View>
                <Text style={styles.rowLabel}>{lu('logout', l)}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.75}>
                <View style={[styles.rowIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={styles.rowIcon}>🗑</Text>
                </View>
                <Text style={[styles.rowLabel, { color: '#DC2626' }]}>{lu('deleteAcct', l)}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.version}>Sunlight Grace Church · v1.0{'\n'}Orlando, FL</Text>
      </ScrollView>

      {/* ── 이름 변경 모달 ── */}
      <Modal visible={nameModal} animationType="slide" transparent onRequestClose={() => setNameModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{lu('changeName', l)}</Text>
            <TextInput
              style={styles.input}
              placeholder={lu('namePlaceholder', l)}
              placeholderTextColor={Colors.text.light}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.authBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setNameModal(false)}>
                <Text style={styles.cancelBtnText}>{lu('cancel', l)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!newName.trim() || nameSaving) && styles.submitBtnDisabled]}
                onPress={handleChangeName}
                disabled={!newName.trim() || nameSaving}
              >
                {nameSaving
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>{lu('nameSave', l)}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 로그인 / 회원가입 모달 ── */}
      <Modal visible={loginModal} animationType="slide" transparent onRequestClose={closeLogin}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {(() => {
              const F = {
                signIn:    { ko: '로그인',          en: 'Sign In',           es: 'Entrar' },
                signUp:    { ko: '회원가입',        en: 'Sign Up',           es: 'Registrarse' },
                email:     { ko: '이메일',          en: 'Email',             es: 'Correo' },
                password:  { ko: '비밀번호',        en: 'Password',          es: 'Contraseña' },
                confirmPw: { ko: '비밀번호 확인',   en: 'Confirm Password',  es: 'Confirmar contraseña' },
                nameField: { ko: '이름',            en: 'Name',              es: 'Nombre' },
                createBtn: { ko: '가입하기',        en: 'Sign Up',           es: 'Crear cuenta' },
                eulaPre:   { ko: '본인은',          en: 'I agree to the',    es: 'Acepto los' },
                eulaLink:  { ko: '이용약관',        en: 'Terms of Use',      es: 'Términos de Uso' },
                eulaMid:   { ko: ' 및 ',            en: ' and ',             es: ' y ' },
                privLink:  { ko: '개인정보처리방침', en: 'Privacy Policy',   es: 'Política de Privacidad' },
                eulaPost:  { ko: '에 동의합니다. 부적절한 콘텐츠 및 학대 행위는 무관용 원칙으로 24시간 내 조치됩니다.', en: '. Objectionable content & abuse: zero tolerance, acted on within 24 hours.', es: '. Contenido inapropiado y abuso: tolerancia cero, acción en 24 horas.' },
              };
              return (
                <>
                  <View style={styles.authTabRow}>
                    <TouchableOpacity
                      style={[styles.authTab, loginTab === 'login' && styles.authTabActive]}
                      onPress={() => { setLoginTab('login'); setName(''); setConfirm(''); }}
                    >
                      <Text style={[styles.authTabText, loginTab === 'login' && styles.authTabTextActive]}>
                        {F.signIn[l]}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.authTab, loginTab === 'signup' && styles.authTabActive]}
                      onPress={() => setLoginTab('signup')}
                    >
                      <Text style={[styles.authTabText, loginTab === 'signup' && styles.authTabTextActive]}>
                        {F.signUp[l]}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {loginTab === 'login' && (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder={F.email[l]}
                        placeholderTextColor={Colors.text.light}
                        value={email} onChangeText={setEmail}
                        autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder={F.password[l]}
                        placeholderTextColor={Colors.text.light}
                        value={password} onChangeText={setPassword} secureTextEntry
                      />
                      <View style={styles.authBtns}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={closeLogin}>
                          <Text style={styles.cancelBtnText}>{lu('cancel', l)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.submitBtn, (!email || !password || submitting) && styles.submitBtnDisabled]}
                          onPress={handleLogin} disabled={!email || !password || submitting}
                        >
                          {submitting
                            ? <ActivityIndicator color={Colors.white} />
                            : <Text style={styles.submitBtnText}>{F.signIn[l]}</Text>}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {loginTab === 'signup' && (
                    <>
                      <TextInput style={styles.input} placeholder={F.nameField[l]} placeholderTextColor={Colors.text.light} value={name} onChangeText={setName} />
                      <TextInput style={styles.input} placeholder={F.email[l]} placeholderTextColor={Colors.text.light} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
                      <TextInput style={styles.input} placeholder={F.password[l]} placeholderTextColor={Colors.text.light} value={password} onChangeText={setPassword} secureTextEntry />
                      <TextInput style={styles.input} placeholder={F.confirmPw[l]} placeholderTextColor={Colors.text.light} value={confirm} onChangeText={setConfirm} secureTextEntry />

                      {/* ── EULA / Privacy 동의 (App Store Guideline 1.2) ── */}
                      <TouchableOpacity
                        style={styles.eulaRow}
                        onPress={() => setEulaAgreed((v) => !v)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.eulaCheckbox, eulaAgreed && styles.eulaCheckboxOn]}>
                          {eulaAgreed && <Text style={styles.eulaCheckmark}>✓</Text>}
                        </View>
                        <Text style={styles.eulaText}>
                          {F.eulaPre[l]}{' '}
                          <Text
                            style={styles.eulaLink}
                            onPress={() => { setLoginModal(false); navigation.navigate('Eula'); }}
                          >
                            {F.eulaLink[l]}
                          </Text>
                          {F.eulaMid[l]}
                          <Text
                            style={styles.eulaLink}
                            onPress={() => { setLoginModal(false); navigation.navigate('PrivacyPolicy'); }}
                          >
                            {F.privLink[l]}
                          </Text>
                          {F.eulaPost[l]}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.authBtns}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={closeLogin}>
                          <Text style={styles.cancelBtnText}>{lu('cancel', l)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.submitBtn, (!name || !email || !password || !confirm || !eulaAgreed || submitting) && styles.submitBtnDisabled]}
                          onPress={handleSignUp} disabled={!name || !email || !password || !confirm || !eulaAgreed || submitting}
                        >
                          {submitting
                            ? <ActivityIndicator color={Colors.white} />
                            : <Text style={styles.submitBtnText}>{F.createBtn[l]}</Text>}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              );
            })()}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary },

  scroll: { padding: 20, paddingBottom: 120 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // ── 프로필
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 16, fontWeight: '800', color: Colors.text.primary },
  profileEmail: { fontSize: 13, fontWeight: '500', color: Colors.text.secondary },
  currentName: { fontSize: 13, color: Colors.text.secondary, marginRight: 4 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },

  guestRow: { alignItems: 'center', gap: 12 },
  guestText: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center' },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  loginBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },

  // ── 행
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 18 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  arrow: { fontSize: 22, color: Colors.text.light },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 64 },

  // ── 언어 선택
  langPills: { flexDirection: 'row', gap: 6 },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  langPillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  langPillFlag: { fontSize: 14 },
  langPillText: { fontSize: 11, fontWeight: '700', color: Colors.text.secondary },
  langPillTextActive: { color: Colors.primary },

  // ── 스탭
  staffRow: { flexDirection: 'row', padding: 16, alignItems: 'flex-start', gap: 14 },
  staffAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  staffAvatarText: { fontSize: 20, fontWeight: '800' },
  staffInfo: { flex: 1 },
  staffRole: { fontSize: 10, fontWeight: '700', color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  staffName: { fontSize: 15, fontWeight: '800', color: Colors.text.primary, marginTop: 2 },
  contactBtn: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  contactBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  // ── 관리자 배지
  adminBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  adminBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  version: { textAlign: 'center', color: Colors.text.light, fontSize: 11, marginTop: 36, lineHeight: 18 },

  // ── 로그인 모달 탭
  authTabRow: {
    flexDirection: 'row', backgroundColor: Colors.background,
    borderRadius: 12, padding: 4, marginBottom: 20,
  },
  authTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  authTabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  authTabText: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  authTabTextActive: { color: Colors.primary, fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 14, fontSize: 15, color: Colors.text.primary,
    backgroundColor: Colors.background, marginBottom: 12,
  },
  authBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: Colors.text.secondary, fontWeight: '600' },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, color: Colors.white, fontWeight: '700' },

  // ── 모달 공통
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 16,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, marginBottom: 16 },
  modalScroll: { marginBottom: 16 },
  modalBody: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22 },
  modalCloseBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  // ── EULA 동의 체크박스
  eulaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 10,
  },
  eulaCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  eulaCheckboxOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  eulaCheckmark: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  eulaText: { flex: 1, fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },
  eulaLink: { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
});
