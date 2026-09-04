import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';

type Props = NativeStackScreenProps<MoreStackParamList, 'MemberDetail'>;

const UI = {
  birthday: { ko: '생일',   en: 'Birthday',  es: 'Cumpleaños' },
  phone:    { ko: '전화번호', en: 'Phone',     es: 'Teléfono'   },
  email:    { ko: '이메일',  en: 'Email',     es: 'Correo'     },
  call:     { ko: '전화하기', en: 'Call',      es: 'Llamar'     },
  sendMail: { ko: '메일 보내기', en: 'Send Email', es: 'Enviar correo' },
  noInfo:   { ko: '정보 없음', en: 'No info',  es: 'Sin info'   },
  cannotCallPhone: { ko: '전화 앱을 열 수 없습니다.', en: 'Cannot open the phone app.', es: 'No se puede abrir la aplicación de teléfono.' },
  cannotOpenMail:  { ko: '메일 앱을 열 수 없습니다.', en: 'Cannot open the mail app.',  es: 'No se puede abrir la aplicación de correo.' },
};

function t(key: keyof typeof UI, lang: string) {
  return UI[key]?.[lang as 'ko' | 'en' | 'es'] ?? UI[key]?.ko ?? '';
}

function formatBirthday(dateStr: string | undefined, lang: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const locales: Record<string, string> = { ko: 'ko-KR', en: 'en-US', es: 'es-ES' };
  return date.toLocaleDateString(locales[lang] ?? 'ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function InitialAvatar({ name, size = 96 }: { name: string; size?: number }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? '?';
  const colors = ['#1E3A5F', '#2C5282', '#276749', '#744210', '#553C9A', '#97266D'];
  const bg = colors[(name.charCodeAt(0) ?? 0) % colors.length];
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

export default function MemberDetailScreen({ navigation, route }: Props) {
  const { member } = route.params;
  const { lang } = useLanguage();

  function callPhone() {
    if (!member.phone) return;
    Linking.openURL(`tel:${member.phone}`).catch(() =>
      Alert.alert('', t('cannotCallPhone', lang))
    );
  }

  function sendEmail() {
    if (!member.email) return;
    Linking.openURL(`mailto:${member.email}`).catch(() =>
      Alert.alert('', t('cannotOpenMail', lang))
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{member.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* 프로필 사진 */}
        <View style={styles.profileSection}>
          {member.photo_url ? (
            <Image
              source={{ uri: member.photo_url }}
              style={styles.photo}
            />
          ) : (
            <InitialAvatar name={member.name} size={96} />
          )}
          <Text style={styles.name}>{member.name}</Text>
        </View>

        {/* 정보 카드 */}
        <View style={styles.infoCard}>
          {/* 생일 */}
          {member.birthday && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Text style={styles.infoEmoji}>🎂</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('birthday', lang)}</Text>
                <Text style={styles.infoValue}>{formatBirthday(member.birthday, lang)}</Text>
              </View>
            </View>
          )}

          {/* 전화번호 */}
          {member.phone && (
            <>
              {member.birthday && <View style={styles.divider} />}
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Text style={styles.infoEmoji}>📞</Text>
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('phone', lang)}</Text>
                  <Text style={styles.infoValue}>{member.phone}</Text>
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={callPhone}>
                  <Text style={styles.actionBtnText}>{t('call', lang)}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* 이메일 */}
          {member.email && (
            <>
              {(member.birthday || member.phone) && <View style={styles.divider} />}
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Text style={styles.infoEmoji}>✉️</Text>
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('email', lang)}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{member.email}</Text>
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={sendEmail}>
                  <Text style={styles.actionBtnText}>{t('sendMail', lang)}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* 아무 정보도 없을 때 */}
          {!member.birthday && !member.phone && !member.email && (
            <View style={styles.noInfoRow}>
              <Text style={styles.noInfoText}>{t('noInfo', lang)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.primary },

  container: { padding: 20, paddingBottom: 40 },

  // 프로필
  profileSection: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  avatarCircle: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { color: Colors.white, fontWeight: '800' },
  name: { fontSize: 24, fontWeight: '800', color: Colors.primary },

  // 정보 카드
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F0F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoEmoji: { fontSize: 18 },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  actionBtn: {
    backgroundColor: '#E8F0F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  noInfoRow: { padding: 20, alignItems: 'center' },
  noInfoText: { fontSize: 14, color: Colors.text.secondary },
});
