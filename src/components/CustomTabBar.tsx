import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../utils/colors';
import { useLanguage } from '../context/LanguageContext';
import { RootTabParamList } from '../types';
import Icon, { IconName } from './Icon';

type TabName = keyof RootTabParamList;

// Recursively get the deepest active route name
function getDeepRouteName(routeState: any): string {
  if (!routeState) return '';
  const route = routeState.routes?.[routeState.index ?? 0];
  if (!route) return '';
  if (route.state) return getDeepRouteName(route.state);
  return route.name as string;
}

// 하단 입력창이 있는 화면 — 떠 있는 탭바가 입력창을 가리므로 숨긴다.
const HIDE_TAB_ROUTES = new Set(['CommunityChat', 'CommunityPostDetail']);

const TAB_ICONS: Record<TabName, IconName> = {
  Home:         'tab-home',
  BibleTab:     'tab-bible',
  CommunityTab: 'tab-community',
  WorshipTab:   'tab-worship',
  More:         'tab-more',
};

const TAB_LABELS: Record<TabName, { ko: string; en: string; es: string }> = {
  Home:         { ko: '홈',    en: 'Home',    es: 'Inicio' },
  BibleTab:     { ko: '성경',  en: 'Bible',   es: 'Biblia' },
  CommunityTab: { ko: '공동체', en: 'Comm.',  es: 'Com.' },
  WorshipTab:   { ko: '예배',  en: 'Worship', es: 'Culto' },
  More:         { ko: '더보기', en: 'More',   es: 'Más' },
};

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { lang } = useLanguage();
  const l = lang as 'ko' | 'en' | 'es';

  // Hide tab bar on screens where it would cover interactive content
  const activeTabRoute = state.routes[state.index];
  const deepRouteName = getDeepRouteName(activeTabRoute?.state);
  if (HIDE_TAB_ROUTES.has(deepRouteName)) return null;

  return (
    <View
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const name = route.name as TabName;
          const icon = TAB_ICONS[name];
          const label = TAB_LABELS[name]?.[l] ?? route.name;

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={() => {
                const ev = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
              }}
              activeOpacity={0.75}
            >
              {focused && <View style={styles.activeHighlight} />}
              <Icon
                name={icon}
                size={22}
                tintColor={focused ? '#fff' : 'rgba(255,255,255,0.45)'}
                style={styles.icon}
              />
              <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#14213D',
    borderRadius: 40,
    paddingHorizontal: 6,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
    width: '100%',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 32,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 50,
  },
  activeHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary,
    opacity: 0.25,
    borderRadius: 30,
  },
  icon: { marginBottom: 2 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  labelActive: { color: '#fff' },
  labelInactive: { color: 'rgba(255,255,255,0.4)' },
});
