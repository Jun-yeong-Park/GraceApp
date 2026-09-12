import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../utils/colors';

// Enforces App Store Guideline 1.2 gating at app root:
//   1. If the signed-in user is banned → show a full-screen block and sign them out.
//   2. If the signed-in user has not accepted the current EULA version →
//      show a modal that MUST be agreed to before any UGC action.
//
// Rendered as an overlay sibling to the main navigator in App.tsx.
export default function UgcComplianceGate() {
  const { user, needsEulaAccept, isBanned, bannedReason, acceptEula, signOut } = useAuth();
  const { lang } = useLanguage();
  const l: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  const [submitting, setSubmitting] = useState(false);
  const [bannedAlertShown, setBannedAlertShown] = useState(false);
  // RN Modal 안의 SafeAreaView 는 첫 렌더에서 상단 인셋을 받지 못해 헤더가
  // 노치 뒤로 들어간다. Provider 에서 직접 읽은 인셋을 패딩으로 준다.
  const insets = useSafeAreaInsets();

  // Banned users: show one native alert, then force sign-out. Only render once
  // per session — the alert queue can otherwise re-fire on every re-render.
  useEffect(() => {
    if (!user || !isBanned || bannedAlertShown) return;
    setBannedAlertShown(true);
    Alert.alert(
      T.bannedTitle[l],
      T.bannedMsg[l] + (bannedReason ? `\n\n${T.bannedReason[l]}: ${bannedReason}` : ''),
      [
        {
          text: T.ok[l],
          style: 'destructive',
          onPress: () => { signOut(); setBannedAlertShown(false); },
        },
      ],
      { cancelable: false }
    );
  }, [user, isBanned, bannedReason, bannedAlertShown, l, signOut]);

  async function handleAgree() {
    setSubmitting(true);
    const { error } = await acceptEula();
    setSubmitting(false);
    if (error) Alert.alert('', T.saveErr[l]);
  }

  // Only render the EULA modal if the user is signed in, needs re-accept, and
  // is not currently banned (banned takes precedence).
  const showEula = !!user && needsEulaAccept && !isBanned;

  return (
    <Modal visible={showEula} animationType="slide" transparent={false} onRequestClose={() => { /* non-dismissible */ }}>
      <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]} edges={['bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{T.title[l]}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{T.required[l]}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>{T.intro[l]}</Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{T.zeroTolTitle[l]}</Text>
            <Text style={styles.sectionBody}>{T.zeroTolBody[l]}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{T.moderationTitle[l]}</Text>
            <Text style={styles.sectionBody}>{T.moderationBody[l]}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{T.actionsTitle[l]}</Text>
            <Text style={styles.sectionBody}>
              {'• ' + T.actionReport[l] + '\n'}
              {'• ' + T.actionBlock[l]  + '\n'}
              {'• ' + T.actionBan[l]    + '\n'}
              {'• ' + T.actionRemove[l]}
            </Text>
          </View>

          <Text style={styles.footnote}>{T.footnote[l]}</Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => {
              Alert.alert(T.declineTitle[l], T.declineMsg[l], [
                { text: T.cancel[l], style: 'cancel' },
                { text: T.signOut[l], style: 'destructive', onPress: () => signOut() },
              ]);
            }}
            disabled={submitting}
          >
            <Text style={styles.declineText}>{T.decline[l]}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.agreeBtn, submitting && { opacity: 0.6 }]}
            onPress={handleAgree}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.agreeText}>{T.agree[l]}</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const T = {
  title:           { ko: '이용약관 재동의',     en: 'Terms Update — Please Re-agree', es: 'Actualización de Términos — Por favor acepte de nuevo' },
  required:        { ko: '필수',                en: 'Required',                       es: 'Requerido' },
  intro:           { ko: '이용약관이 업데이트되었습니다. 계속 이용하시려면 아래 내용을 확인하고 동의해 주세요. 부적절한 콘텐츠와 학대 행위에 대한 무관용 원칙이 포함되어 있습니다.',
                     en: 'Our Terms of Use have been updated. To keep using the app, please review and agree to the terms below, including our zero-tolerance policy for objectionable content and abusive users.',
                     es: 'Nuestros Términos de Uso se han actualizado. Para seguir usando la aplicación, revise y acepte los términos, incluida nuestra política de tolerancia cero para contenido objetable y usuarios abusivos.' },

  zeroTolTitle:    { ko: '무관용 원칙 (Zero Tolerance)', en: 'Zero Tolerance Policy', es: 'Política de Tolerancia Cero' },
  zeroTolBody:     { ko: '본 앱은 게시물, 사진, 댓글, 채팅, 기도 요청 등 사용자가 작성하는 모든 콘텐츠에 대해 부적절한 콘텐츠(objectionable content)와 학대 행위(abusive behavior)를 절대 허용하지 않습니다. 욕설, 혐오 발언, 음란물, 폭력, 스팸, 타인 모욕 등이 포함됩니다.',
                     en: 'This app applies a zero-tolerance policy toward objectionable content and abusive behavior in all user-generated content — posts, photos, comments, chat, prayer requests. This includes profanity, hate speech, sexual content, violence, spam, and personal attacks.',
                     es: 'Esta aplicación aplica una política de tolerancia cero contra el contenido objetable y el comportamiento abusivo en todo el contenido generado por usuarios: publicaciones, fotos, comentarios, chat, peticiones de oración. Incluye lenguaje obsceno, discurso de odio, contenido sexual, violencia, spam y ataques personales.' },

  moderationTitle: { ko: '24시간 내 조치',                en: '24-Hour Moderation',    es: 'Moderación en 24 Horas' },
  moderationBody:  { ko: '신고된 콘텐츠는 접수 후 24시간 이내에 검토되어 삭제되며, 위반 사용자의 계정은 정지될 수 있습니다.',
                     en: 'Reported content is reviewed and removed within 24 hours of submission; violating accounts may be suspended.',
                     es: 'El contenido reportado se revisa y elimina dentro de las 24 horas posteriores a su envío; las cuentas infractoras pueden ser suspendidas.' },

  actionsTitle:    { ko: '이용 가능한 조치',              en: 'Actions Available to You', es: 'Acciones Disponibles' },
  actionReport:    { ko: '부적절한 콘텐츠 신고 (모든 게시글·댓글·사진의 "…" 메뉴)',
                     en: 'Report objectionable content (via the "…" menu on any post/comment/photo)',
                     es: 'Reportar contenido objetable (menú "…" en cualquier publicación/comentario/foto)' },
  actionBlock:     { ko: '학대 사용자 차단 — 차단 즉시 해당 사용자의 콘텐츠가 화면에서 사라짐',
                     en: 'Block abusive users — their content disappears from your view immediately',
                     es: 'Bloquear usuarios abusivos — su contenido desaparece de su vista inmediatamente' },
  actionBan:       { ko: '관리자는 반복 위반자를 정지·영구 추방할 수 있음',
                     en: 'Administrators may suspend or permanently ban repeat offenders',
                     es: 'Los administradores pueden suspender o expulsar permanentemente a los infractores reincidentes' },
  actionRemove:    { ko: '관리자는 신고된 콘텐츠를 즉시 삭제할 수 있음',
                     en: 'Administrators may remove reported content immediately',
                     es: 'Los administradores pueden eliminar el contenido reportado inmediatamente' },

  footnote:        { ko: '전체 약관은 더보기 → 이용약관에서 언제든 확인하실 수 있습니다.',
                     en: 'Full terms are available anytime under More → Terms of Use.',
                     es: 'Los términos completos están disponibles en Más → Términos de Uso.' },

  agree:           { ko: '동의하고 계속',      en: 'Agree & Continue',              es: 'Aceptar y Continuar' },
  decline:         { ko: '동의하지 않음',      en: 'Do Not Agree',                  es: 'No Aceptar' },
  declineTitle:    { ko: '로그아웃하시겠습니까?', en: 'Sign out?',                   es: '¿Cerrar sesión?' },
  declineMsg:      { ko: '이용약관에 동의하지 않으시면 로그아웃됩니다. 커뮤니티 기능을 이용하려면 다음 로그인 시 다시 동의해 주세요.',
                     en: 'If you do not agree, you will be signed out. To use community features, please re-agree the next time you sign in.',
                     es: 'Si no acepta, se cerrará su sesión. Para usar las funciones comunitarias, acepte de nuevo la próxima vez que inicie sesión.' },
  signOut:         { ko: '로그아웃',            en: 'Sign Out',                      es: 'Cerrar sesión' },
  cancel:          { ko: '취소',                en: 'Cancel',                        es: 'Cancelar' },

  saveErr:         { ko: '동의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
                     en: 'Failed to save. Please try again shortly.',
                     es: 'Error al guardar. Inténtelo de nuevo en breve.' },

  // Banned
  bannedTitle:     { ko: '계정이 정지되었습니다', en: 'Account Suspended',          es: 'Cuenta Suspendida' },
  bannedMsg:       { ko: '커뮤니티 이용약관 위반으로 계정이 정지되었습니다. 이의 신청은 joccjosh@gmail.com 으로 문의해 주세요.',
                     en: 'Your account has been suspended for violating our community terms. For appeals, contact joccjosh@gmail.com.',
                     es: 'Su cuenta ha sido suspendida por violar nuestros términos comunitarios. Para apelaciones, contacte a joccjosh@gmail.com.' },
  bannedReason:    { ko: '사유',                en: 'Reason',                        es: 'Motivo' },
  ok:              { ko: '확인',                en: 'OK',                            es: 'OK' },
};

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary, flex: 1 },
  badge:   { backgroundColor: '#DC2626', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  scroll:  { padding: 20, paddingBottom: 40 },
  intro:   { fontSize: 14, color: Colors.text.primary, lineHeight: 22, marginBottom: 20 },
  card:    {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginBottom: 8 },
  sectionBody:  { fontSize: 13, color: Colors.text.secondary, lineHeight: 20 },
  footnote: { fontSize: 12, color: Colors.text.light, marginTop: 8, textAlign: 'center', lineHeight: 18 },

  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 24,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  declineBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  declineText: { fontSize: 15, fontWeight: '600', color: Colors.text.secondary },
  agreeBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  agreeText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
