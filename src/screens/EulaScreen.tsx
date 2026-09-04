import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreTabParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';

type Props = NativeStackScreenProps<MoreTabParamList, 'Eula'>;
type L = 'ko' | 'en' | 'es';

const EFFECTIVE_DATE = { ko: '2026년 6월 29일', en: 'June 29, 2026', es: '29 de junio de 2026' };

interface Section { title: string; body: string }

const SECTIONS: Record<L, Section[]> = {
  ko: [
    {
      title: '1. 동의',
      body: 'Sunlight Grace Church 앱(이하 "본 앱")을 사용하거나 회원으로 가입함으로써 귀하는 본 이용약관(EULA)에 동의하는 것입니다. 본 약관에 동의하지 않으시면 본 앱을 이용하실 수 없습니다.',
    },
    {
      title: '2. 부적절한 콘텐츠 무관용 원칙',
      body: '본 앱은 사용자가 작성하는 모든 콘텐츠(게시물, 사진, 댓글, 채팅 메시지, 기도 요청 등)에 대해 부적절한 콘텐츠 또는 학대 행위에 대한 무관용(Zero Tolerance) 원칙을 적용합니다.\n\n다음의 콘텐츠는 절대 금지됩니다:\n• 욕설, 비방, 모욕적 표현\n• 혐오 발언 (인종, 성별, 종교, 성적 지향 등 차별)\n• 음란물, 성적 표현, 노골적 콘텐츠\n• 폭력적·위협적 내용, 자해 조장\n• 스팸, 광고, 사기, 피싱\n• 타인의 개인정보, 명예훼손\n• 불법 행위 또는 불법 콘텐츠',
    },
    {
      title: '3. 사용자 행동 규범',
      body: '귀하는 다른 사용자를 존중하고, 그리스도의 사랑 안에서 교제하기 위해 본 앱을 사용하기로 동의합니다. 다른 사용자를 괴롭히거나 학대하는 행위는 엄격히 금지되며, 즉시 계정이 정지될 수 있습니다.',
    },
    {
      title: '4. 신고 및 차단',
      body: '귀하는 부적절한 콘텐츠를 발견했을 때 신고할 수 있으며, 학대 행위를 하는 사용자를 차단할 수 있습니다. 차단된 사용자의 콘텐츠는 즉시 귀하의 화면에서 사라집니다.\n\n관리자는 신고된 콘텐츠를 접수일로부터 24시간 이내에 검토하여 다음과 같이 조치합니다:\n• 부적절한 콘텐츠 즉시 삭제\n• 위반자의 계정 정지 또는 영구 차단\n• 반복 위반자의 영구 추방',
    },
    {
      title: '5. 책임 한계',
      body: '본 앱은 사용자가 작성하는 콘텐츠에 대해 검토 및 조치를 시행하지만, 모든 콘텐츠의 정확성·합법성·적절성을 사전에 보장할 수는 없습니다. 사용자가 작성한 콘텐츠로 인해 발생하는 분쟁이나 손해에 대한 책임은 해당 작성자에게 있습니다.',
    },
    {
      title: '6. 약관 변경',
      body: '본 약관은 변경될 수 있으며, 변경 시 앱 내에서 공지됩니다. 변경된 약관에 동의하지 않을 경우 회원 탈퇴를 요청하실 수 있습니다.',
    },
    {
      title: '7. 문의',
      body: '본 약관에 관한 문의는 joccjosh@gmail.com 으로 연락 주시기 바랍니다.',
    },
  ],
  en: [
    {
      title: '1. Agreement',
      body: 'By using or signing up for the Sunlight Grace Church app ("the App"), you agree to these Terms of Use (EULA). If you do not agree, you may not use the App.',
    },
    {
      title: '2. Zero Tolerance for Objectionable Content',
      body: 'The App applies a strict Zero Tolerance policy toward objectionable content and abusive behavior in all user-generated content (posts, photos, comments, chat messages, prayer requests, etc.).\n\nThe following are strictly prohibited:\n• Profanity, slander, or insults\n• Hate speech (discrimination by race, gender, religion, sexual orientation, etc.)\n• Pornographic, sexual, or sexually explicit content\n• Violent or threatening content, self-harm encouragement\n• Spam, advertising, fraud, phishing\n• Sharing others\' private information, defamation\n• Illegal acts or illegal content',
    },
    {
      title: '3. User Code of Conduct',
      body: 'You agree to use the App with respect for other users and to fellowship in the love of Christ. Harassment or abuse of any other user is strictly prohibited and may result in immediate account suspension.',
    },
    {
      title: '4. Reporting & Blocking',
      body: 'You may report objectionable content when you find it, and you may block users who behave abusively. Blocked users\' content will immediately disappear from your feed.\n\nAdministrators review reported content within 24 hours of submission and take the following actions:\n• Immediately remove objectionable content\n• Suspend or permanently ban the violating account\n• Permanently eject repeat offenders',
    },
    {
      title: '5. Limitation of Liability',
      body: 'While the App reviews and moderates user content, we cannot guarantee in advance the accuracy, legality, or appropriateness of every piece of content. Authors are solely responsible for any disputes or damages arising from content they post.',
    },
    {
      title: '6. Changes to Terms',
      body: 'These terms may change. Changes will be announced in-app. If you do not agree to the revised terms, you may request account deletion.',
    },
    {
      title: '7. Contact',
      body: 'For questions about these terms, contact joccjosh@gmail.com.',
    },
  ],
  es: [
    {
      title: '1. Acuerdo',
      body: 'Al usar o registrarse en la aplicación Sunlight Grace Church ("la App"), usted acepta estos Términos de Uso (EULA). Si no está de acuerdo, no puede usar la App.',
    },
    {
      title: '2. Tolerancia Cero para Contenido Objetable',
      body: 'La App aplica una política estricta de Tolerancia Cero hacia el contenido objetable y el comportamiento abusivo en todo el contenido generado por usuarios (publicaciones, fotos, comentarios, mensajes de chat, peticiones de oración, etc.).\n\nEstá estrictamente prohibido lo siguiente:\n• Lenguaje obsceno, difamación o insultos\n• Discurso de odio (discriminación por raza, género, religión, orientación sexual, etc.)\n• Contenido pornográfico, sexual o sexualmente explícito\n• Contenido violento o amenazante, incitación a la autolesión\n• Spam, publicidad, fraude, phishing\n• Compartir información privada de otros, difamación\n• Actos o contenido ilegal',
    },
    {
      title: '3. Código de Conducta',
      body: 'Usted se compromete a usar la App con respeto hacia otros usuarios y a tener compañerismo en el amor de Cristo. El acoso o abuso de otros usuarios está estrictamente prohibido y puede resultar en la suspensión inmediata de la cuenta.',
    },
    {
      title: '4. Reportar y Bloquear',
      body: 'Puede reportar contenido objetable cuando lo encuentre y bloquear usuarios que se comporten de manera abusiva. El contenido de los usuarios bloqueados desaparecerá inmediatamente de su pantalla.\n\nLos administradores revisan el contenido reportado dentro de 24 horas y toman las siguientes medidas:\n• Eliminar inmediatamente el contenido objetable\n• Suspender o bloquear permanentemente la cuenta infractora\n• Expulsar permanentemente a infractores reincidentes',
    },
    {
      title: '5. Limitación de Responsabilidad',
      body: 'Aunque la App revisa y modera el contenido del usuario, no podemos garantizar la exactitud, legalidad o adecuación de cada contenido. Los autores son responsables de cualquier disputa o daño que surja del contenido que publiquen.',
    },
    {
      title: '6. Cambios en los Términos',
      body: 'Estos términos pueden cambiar. Los cambios se anunciarán en la App. Si no está de acuerdo con los términos revisados, puede solicitar la eliminación de su cuenta.',
    },
    {
      title: '7. Contacto',
      body: 'Para preguntas sobre estos términos, contacte joccjosh@gmail.com.',
    },
  ],
};

const T = {
  title:     { ko: '이용약관', en: 'Terms of Use', es: 'Términos de Uso' },
  effective: { ko: '시행일',    en: 'Effective',    es: 'Vigente desde' },
};

export default function EulaScreen({ navigation }: Props) {
  const { lang } = useLanguage();
  const l: L = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{T.title[l]}</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.effective}>{T.effective[l]}: {EFFECTIVE_DATE[l]}</Text>
        {SECTIONS[l].map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: { padding: 20 },
  effective: { fontSize: 12, color: Colors.text.light, marginBottom: 18, fontWeight: '600' },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text.primary, marginBottom: 6 },
  sectionBody: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22 },
});
