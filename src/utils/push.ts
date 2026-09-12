import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

// 푸시 알림 등록/해제.
// - 토큰은 public.push_tokens 에 저장되고, 공지/일정이 등록되면 send-push Edge
//   Function 이 모든 토큰으로 발송한다 (supabase_functional_fixes.sql 섹션 E).
// - 사용자가 알림을 끄면 이 기기의 토큰 행을 지워서 발송 대상에서 빠진다.

const TOKEN_KEY = '@grace_push_token';

// 앱이 포그라운드일 때도 배너를 보여준다 (기본값은 무음 처리).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // 시뮬레이터/웹에서는 푸시 토큰이 없다

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data ?? null;
}

/** 알림 켜기: 권한 요청 → 토큰 발급 → 서버 저장. 성공 시 true. */
export async function enablePush(params: { userId: string | null; lang: string }): Promise<boolean> {
  const token = await getExpoPushToken();
  if (!token) return false;
  const { error } = await supabase.from('push_tokens').upsert(
    {
      token,
      user_id: params.userId,
      platform: Platform.OS,
      lang: params.lang,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (error) return false;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return true;
}

/** 알림 끄기: 이 기기의 토큰 행 삭제. */
export async function disablePush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    await supabase.from('push_tokens').delete().eq('token', token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

/** 앱 시작 시: 알림이 켜져 있으면 토큰·언어·사용자 연결을 최신으로 갱신. */
export async function refreshPushIfEnabled(params: { enabled: boolean; userId: string | null; lang: string }): Promise<void> {
  if (!params.enabled) return;
  try { await enablePush(params); } catch { /* 네트워크 실패 등은 무시 — 다음 실행에 재시도 */ }
}
