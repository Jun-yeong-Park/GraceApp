import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreTabParamList } from '../types';
import { Colors } from '../utils/colors';
import Icon from '../components/Icon';
import { useLanguage } from '../context/LanguageContext';

type Props = NativeStackScreenProps<MoreTabParamList, 'PrivacyPolicy'>;

type Lang = 'ko' | 'en';

const EFFECTIVE_DATE = { ko: '2025년 1월 1일', en: 'January 1, 2025' };
const CONTACT_EMAIL = 'joccjosh@gmail.com';
const CHURCH_NAME = { ko: 'Sunlight Grace Church (주은혜교회)', en: 'Sunlight Grace Church' };

interface Section {
  icon: string;
  title: string;
  items: { label?: string; text: string }[];
}

const SECTIONS: Record<Lang, Section[]> = {
  ko: [
    {
      icon: '📋',
      title: '1. 수집하는 개인정보',
      items: [
        { label: '회원가입 시', text: '이름, 이메일 주소, 비밀번호' },
        { label: '서비스 이용 시', text: '기도요청 내용, 심방요청 내용, 봉사 신청 정보, 커뮤니티 게시글' },
        { label: '자동 수집', text: '앱 이용 기록, 기기 정보 (알림 설정 목적)' },
      ],
    },
    {
      icon: '🎯',
      title: '2. 이용 목적',
      items: [
        { text: '교회 서비스 및 앱 기능 제공' },
        { text: '공지사항, 주보, 설교 등 교회 정보 전달' },
        { text: '기도요청 및 심방 요청 처리' },
        { text: '봉사 신청 및 커뮤니티 활동 운영' },
        { text: '푸시 알림 발송 (동의한 경우에 한함)' },
        { text: '계정 관리 및 본인 확인' },
      ],
    },
    {
      icon: '🗄️',
      title: '3. 보관 기간',
      items: [
        { text: '회원 탈퇴 시 개인정보는 즉시 파기됩니다.' },
        { text: '단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.' },
        { text: '비회원(게스트)이 작성한 기도요청 등은 관리자가 직접 삭제할 때까지 보관됩니다.' },
      ],
    },
    {
      icon: '🤝',
      title: '4. 제3자 제공',
      items: [
        { text: '교회는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.' },
        { text: '다만, 법령에 의한 요청이 있는 경우는 예외로 합니다.' },
        { label: 'Supabase', text: '데이터베이스 및 인증 서비스 (미국 서버, GDPR 준수)' },
        { label: 'Expo / Apple / Google', text: '푸시 알림 전송 목적에 한하여 기기 토큰이 전달될 수 있습니다.' },
      ],
    },
    {
      icon: '🔐',
      title: '5. 보안',
      items: [
        { text: '비밀번호는 암호화하여 저장되며 원문은 확인할 수 없습니다.' },
        { text: '데이터는 Supabase의 보안 서버에 저장되며 SSL/TLS 암호화를 통해 전송됩니다.' },
        { text: '교회 관리자만 제한된 범위 내에서 정보에 접근할 수 있습니다.' },
      ],
    },
    {
      icon: '🛡️',
      title: '6. 사용자 콘텐츠 관리 · 신고 · 차단',
      items: [
        { text: '본 앱은 부적절한 콘텐츠 및 학대 행위에 대해 무관용(Zero Tolerance) 원칙을 적용합니다.' },
        { text: '사용자는 부적절한 게시물·사진·댓글·채팅 메시지를 언제든지 신고할 수 있습니다.' },
        { text: '학대 행위를 하는 사용자를 차단할 수 있으며, 차단 시 해당 사용자의 모든 콘텐츠가 즉시 화면에서 사라집니다.' },
        { text: '신고된 콘텐츠는 접수 후 24시간 이내에 관리자가 검토하여 삭제 또는 계정 정지 조치합니다.' },
        { text: '자세한 내용은 이용약관(EULA)을 참고해 주세요.' },
      ],
    },
    {
      icon: '⚖️',
      title: '7. 이용자 권리',
      items: [
        { text: '언제든지 자신의 개인정보를 조회, 수정, 삭제 요청할 수 있습니다.' },
        { text: '계정 삭제는 앱 내 "계정 삭제" 기능 또는 이메일 요청으로 처리됩니다.' },
        { text: '알림 수신 동의는 앱 설정에서 언제든지 변경 가능합니다.' },
      ],
    },
    {
      icon: '🧒',
      title: '8. 어린이 보호',
      items: [
        { text: '본 앱은 만 13세 미만 어린이의 개인정보를 의도적으로 수집하지 않습니다.' },
        { text: '만 13세 미만 아동이 가입한 사실이 확인되면 즉시 해당 정보를 삭제합니다.' },
      ],
    },
    {
      icon: '📬',
      title: '9. 문의',
      items: [
        { text: '개인정보와 관련된 문의, 불만 처리, 피해 구제 등은 아래로 연락 주세요.' },
        { label: '교회', text: 'Sunlight Grace Church — Orlando, FL' },
        { label: '이메일', text: CONTACT_EMAIL },
      ],
    },
  ],
  en: [
    {
      icon: '📋',
      title: '1. Information We Collect',
      items: [
        { label: 'On sign-up', text: 'Full name, email address, password' },
        { label: 'During use', text: 'Prayer requests, visit requests, volunteer applications, community posts' },
        { label: 'Automatically', text: 'App usage data, device info (for notification purposes)' },
      ],
    },
    {
      icon: '🎯',
      title: '2. How We Use Your Information',
      items: [
        { text: 'Provide church services and app features' },
        { text: 'Deliver church information such as bulletins, sermons, and announcements' },
        { text: 'Process prayer and pastoral visit requests' },
        { text: 'Manage volunteer sign-ups and community activities' },
        { text: 'Send push notifications (only with your consent)' },
        { text: 'Account management and identity verification' },
      ],
    },
    {
      icon: '🗄️',
      title: '3. Data Retention',
      items: [
        { text: 'Your personal data is deleted immediately upon account deletion.' },
        { text: 'Data required by applicable law may be retained for the legally mandated period.' },
        { text: 'Content posted by guest users (e.g., prayer requests) is retained until manually removed by an administrator.' },
      ],
    },
    {
      icon: '🤝',
      title: '4. Third-Party Sharing',
      items: [
        { text: 'We do not sell or share your personal information with third parties without your consent.' },
        { text: 'Disclosure may be required by law in certain circumstances.' },
        { label: 'Supabase', text: 'Database and authentication services (US servers, GDPR-compliant)' },
        { label: 'Expo / Apple / Google', text: 'Device tokens may be shared solely for push notification delivery.' },
      ],
    },
    {
      icon: '🔐',
      title: '5. Security',
      items: [
        { text: 'Passwords are hashed and stored securely — we cannot view them.' },
        { text: 'All data is stored on Supabase secure servers and transmitted via SSL/TLS encryption.' },
        { text: 'Only authorized church administrators have limited access to user data.' },
      ],
    },
    {
      icon: '🛡️',
      title: '6. User Content Moderation · Reporting · Blocking',
      items: [
        { text: 'The App enforces a Zero Tolerance policy against objectionable content and abusive behavior.' },
        { text: 'You may report inappropriate posts, photos, comments, or chat messages at any time.' },
        { text: 'You may block abusive users; once blocked, all of their content disappears from your feed instantly.' },
        { text: 'Reported content is reviewed by an administrator within 24 hours and may be removed; offending accounts may be suspended.' },
        { text: 'See the Terms of Use (EULA) for full details.' },
      ],
    },
    {
      icon: '⚖️',
      title: '7. Your Rights',
      items: [
        { text: 'You may request to access, correct, or delete your personal information at any time.' },
        { text: 'Account deletion can be requested through the "Delete Account" option in the app or by email.' },
        { text: 'Notification preferences can be changed at any time in the app settings.' },
      ],
    },
    {
      icon: '🧒',
      title: '8. Children\'s Privacy',
      items: [
        { text: 'We do not knowingly collect personal information from children under the age of 13.' },
        { text: 'If we discover that a child under 13 has registered, we will promptly delete their information.' },
      ],
    },
    {
      icon: '📬',
      title: '9. Contact Us',
      items: [
        { text: 'For privacy-related questions, complaints, or data requests, please contact us:' },
        { label: 'Church', text: 'Sunlight Grace Church — Orlando, FL' },
        { label: 'Email', text: CONTACT_EMAIL },
      ],
    },
  ],
};

const UI = {
  title: { ko: '개인정보 처리방침', en: 'Privacy Policy' },
  effectiveDate: { ko: '시행일', en: 'Effective Date' },
  intro: {
    ko: `${CHURCH_NAME.ko}(이하 "교회")는 이용자의 개인정보를 소중히 여기며, 「개인정보 보호법」 및 관련 법령을 준수합니다. 본 방침은 앱을 통해 수집하는 개인정보의 처리 방법을 안내합니다.`,
    en: `${CHURCH_NAME.en} ("we", "our", or "the Church") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard information through our mobile application.`,
  },
  close: { ko: '닫기', en: 'Close' },
  emailContact: { ko: '이메일로 문의하기', en: 'Contact by Email' },
};

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const { lang } = useLanguage();
  const [activeLang, setActiveLang] = useState<Lang>(lang === 'ko' ? 'ko' : 'en');

  const sections = SECTIONS[activeLang];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{UI.title[activeLang]}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Language Toggle */}
        <View style={styles.langRow}>
          {(['ko', 'en'] as Lang[]).map((code) => (
            <TouchableOpacity
              key={code}
              style={[styles.langBtn, activeLang === code && styles.langBtnActive]}
              onPress={() => setActiveLang(code)}
              activeOpacity={0.75}
            >
              <Text style={[styles.langBtnText, activeLang === code && styles.langBtnTextActive]}>
                {code === 'ko' ? '🇰🇷  한국어' : '🇺🇸  English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title Card */}
        <View style={styles.titleCard}>
          <View style={styles.lockBadge}>
            <Icon name="more-privacy" size={22} tintColor={Colors.primary} />
          </View>
          <Text style={styles.titleCardHeading}>{UI.title[activeLang]}</Text>
          <Text style={styles.titleCardChurch}>{CHURCH_NAME[activeLang]}</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>
              {UI.effectiveDate[activeLang]}: {EFFECTIVE_DATE[activeLang]}
            </Text>
          </View>
        </View>

        {/* Introduction */}
        <View style={styles.introCard}>
          <Text style={styles.introText}>{UI.intro[activeLang]}</Text>
        </View>

        {/* Sections */}
        {sections.map((section, idx) => (
          <View key={idx} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{section.icon}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <View style={styles.bullet} />
                <View style={styles.itemContent}>
                  {item.label && (
                    <Text style={styles.itemLabel}>{item.label}</Text>
                  )}
                  <Text style={styles.itemText}>{item.text}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Contact Button */}
        <TouchableOpacity
          style={styles.emailBtn}
          onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.emailBtnText}>✉️  {UI.emailContact[activeLang]}</Text>
          <Text style={styles.emailBtnSub}>{CONTACT_EMAIL}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          © 2025 Sunlight Grace Church{'\n'}Orlando, FL
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 28, color: Colors.primary, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.text.primary },
  headerRight: { width: 36 },

  scroll: { padding: 20, paddingBottom: 60 },

  // Language toggle
  langRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  langBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  langBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  langBtnTextActive: { color: Colors.white },

  // Title card
  titleCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  lockBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lockIcon: { fontSize: 28 },
  titleCardHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
  },
  titleCardChurch: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 14,
  },
  dateBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  dateBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  // Intro
  introCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  introText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
  },

  // Section
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionIcon: { fontSize: 18 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
  },

  // Item
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 7,
    flexShrink: 0,
  },
  itemContent: { flex: 1 },
  itemLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  itemText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },

  // Email button
  emailBtn: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emailBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  emailBtnSub: {
    fontSize: 12,
    color: Colors.text.light,
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.text.light,
    lineHeight: 18,
  },
});
