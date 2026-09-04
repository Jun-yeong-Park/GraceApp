import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../types';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';

type Props = NativeStackScreenProps<MoreStackParamList, 'Offering'>;

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
  const { t } = useLanguage();

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

        {/* 하단 안내 */}
        <View style={styles.noteRow}>
          <Text style={styles.noteIcon}>✉️</Text>
          <Text style={styles.noteText}>{t('offeringContactNote')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

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
  noteIcon: { fontSize: 16, marginTop: 1 },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
});
