import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../services/supabase';
import Icon from '../components/Icon';

type Props = NativeStackScreenProps<MoreStackParamList, 'Offering'>;

// 관리자 → 앱설정 → 온라인 헌금 설정에서 저장한 값 (app_settings)
interface OfferingInfo { url: string; zelle: string; venmo: string; cashApp: string }

const OTHER = {
  title:  { ko: '다른 헌금 방법', en: 'Other Ways to Give', es: 'Otras Formas de Ofrendar' },
  link:   { ko: '온라인 헌금 링크', en: 'Online giving link', es: 'Enlace de ofrenda en línea' },
  copied: { ko: '복사되었습니다', en: 'Copied', es: 'Copiado' },
  tapCopy:{ ko: '탭하여 복사', en: 'Tap to copy', es: 'Toca para copiar' },
  tapOpen:{ ko: '탭하여 열기', en: 'Tap to open', es: 'Toca para abrir' },
};

const TITHELY_FORM_ID = '6547d5e0-5d42-11ee-90fc-1260ab546d11';

const TITHELY_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: transparent;
    }
    .tithely-give-button {
      background-color: #00DB72 !important;
      font-family: -apple-system, sans-serif;
      font-weight: bold;
      font-size: 19px;
      padding: 15px 70px;
      border-radius: 4px;
      cursor: pointer;
      background-image: none !important;
      color: white;
      text-shadow: none;
      display: inline-block;
      border: none;
      width: 100%;
      max-width: 320px;
    }
  </style>
</head>
<body>
  <button
    class="tithely-give-button"
    data-form="${TITHELY_FORM_ID}"
  >Give</button>
  <script src="https://static.tithely.com/give/give.js" defer></script>
</body>
</html>
`;

export default function OfferingScreen({ navigation }: Props) {
  const { t, lang } = useLanguage();
  const L: 'ko' | 'en' | 'es' = lang === 'ko' ? 'ko' : lang === 'es' ? 'es' : 'en';
  const [info, setInfo] = useState<OfferingInfo>({ url: '', zelle: '', venmo: '', cashApp: '' });

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['offering_url', 'offering_zelle', 'offering_venmo', 'offering_cash_app'])
      .then(({ data }) => {
        if (!data) return;
        const m: Record<string, string> = {};
        data.forEach((r: any) => { m[r.key] = typeof r.value === 'string' ? r.value : ''; });
        setInfo({ url: m.offering_url ?? '', zelle: m.offering_zelle ?? '', venmo: m.offering_venmo ?? '', cashApp: m.offering_cash_app ?? '' });
      }, () => {});
  }, []);

  async function copy(v: string) {
    await Clipboard.setStringAsync(v);
    Alert.alert('', OTHER.copied[L]);
  }

  const rows: { icon: string; label: string; value: string; onPress: () => void; hint: string }[] = [];
  if (info.url)     rows.push({ icon: '💳', label: OTHER.link[L], value: info.url, onPress: () => Linking.openURL(info.url), hint: OTHER.tapOpen[L] });
  if (info.zelle)   rows.push({ icon: '💸', label: 'Zelle',    value: info.zelle,   onPress: () => copy(info.zelle),   hint: OTHER.tapCopy[L] });
  if (info.venmo)   rows.push({ icon: '📱', label: 'Venmo',    value: info.venmo,   onPress: () => Linking.openURL(`https://venmo.com/u/${info.venmo.replace(/^@/, '')}`), hint: OTHER.tapOpen[L] });
  if (info.cashApp) rows.push({ icon: '💵', label: 'Cash App', value: info.cashApp, onPress: () => Linking.openURL(`https://cash.app/${info.cashApp.startsWith('$') ? info.cashApp : '$' + info.cashApp}`), hint: OTHER.tapOpen[L] });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('offeringTitle')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 배너 */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Text style={styles.bannerIconText}>💝</Text>
          </View>
          <Text style={styles.bannerTitle}>{t('offeringTitle')}</Text>
          <Text style={styles.bannerSubtitle}>{t('offeringSubtitle')}</Text>
        </View>

        {/* 말씀 카드 */}
        <View style={styles.verseCard}>
          <Text style={styles.verseText}>{t('offeringVerse')}</Text>
        </View>

        {/* Tithe.ly 헌금 버튼 */}
        <View style={styles.tithelyCard}>
          <Text style={styles.tithelyLabel}>{t('offeringBtnLabel')}</Text>
          <WebView
            style={styles.tithelyWebView}
            source={{ html: TITHELY_HTML }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url !== 'about:blank' && !request.url.startsWith('data:')) {
                Linking.openURL(request.url);
                return false;
              }
              return true;
            }}
          />
        </View>

        {/* 관리자가 설정한 다른 헌금 방법 (없으면 섹션 자체를 숨김) */}
        {rows.length > 0 && (
          <View style={styles.otherCard}>
            <Text style={styles.otherTitle}>{OTHER.title[L]}</Text>
            {rows.map((r, i) => (
              <TouchableOpacity key={r.label} style={[styles.otherRow, i < rows.length - 1 && styles.otherRowBorder]} onPress={r.onPress} activeOpacity={0.7}>
                <Text style={styles.otherIcon}>{r.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otherLabel}>{r.label}</Text>
                  <Text style={styles.otherValue} numberOfLines={1}>{r.value}</Text>
                </View>
                <Text style={styles.otherHint}>{r.hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 하단 안내 */}
        <View style={styles.noteRow}>
          <Icon name="ui-mail" size={16} tintColor={Colors.text.secondary} style={styles.noteIcon} />
          <Text style={styles.noteText}>{t('offeringContactNote')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  otherCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  otherTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginBottom: 6 },
  otherRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  otherRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  otherIcon: { fontSize: 20, width: 32 },
  otherLabel: { fontSize: 12, color: Colors.text.secondary, marginBottom: 2 },
  otherValue: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  otherHint: { fontSize: 11, color: Colors.text.light, marginLeft: 8 },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backArrow: { fontSize: 30, color: Colors.primary, lineHeight: 32 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },

  container: {
    padding: 20,
    paddingBottom: 48,
  },

  // 배너
  banner: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(197,168,79,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  bannerIconText: { fontSize: 32 },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 21,
  },

  // 말씀 카드
  verseCard: {
    backgroundColor: Colors.secondary + '18',
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  verseText: {
    fontSize: 13,
    color: Colors.text.primary,
    lineHeight: 21,
    fontStyle: 'italic',
  },

  // Tithe.ly 헌금 버튼 카드
  tithelyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  tithelyLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  tithelyWebView: {
    width: 320,
    height: 60,
    backgroundColor: 'transparent',
  },

  // 하단 안내
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteIcon: { marginTop: 1 },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
});
