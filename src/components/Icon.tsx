import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

// 커스텀 아이콘 세트 (assets/icons, 256px PNG, 투명 배경).
// - 글리프(tab-/action-/more-/admin-/ui-): 단색 남색 원본. tintColor 를 주면
//   알파만 마스크로 써서 어떤 색으로도 칠할 수 있다 (탭바에서 흰색 등).
// - 공동체 배지(community-): 풀컬러라 tintColor 를 주지 않는다.
// Metro 는 동적 require 를 지원하지 않아 이름→파일 매핑을 정적으로 둔다.
const ICONS = {
  'tab-home':            require('../../assets/icons/tab-home.png'),
  'tab-bible':           require('../../assets/icons/tab-bible.png'),
  'tab-community':       require('../../assets/icons/tab-community.png'),
  'tab-worship':         require('../../assets/icons/tab-worship.png'),
  'tab-more':            require('../../assets/icons/tab-more.png'),

  'community-kosovo':    require('../../assets/icons/community-kosovo.png'),
  'community-albania':   require('../../assets/icons/community-albania.png'),
  'community-dagestan':  require('../../assets/icons/community-dagestan.png'),
  'community-kissimmee': require('../../assets/icons/community-kissimmee.png'),
  'community-bridge':    require('../../assets/icons/community-bridge.png'),
  'community-hope':      require('../../assets/icons/community-hope.png'),
  'community-general':   require('../../assets/icons/community-general.png'),

  'action-prayer':       require('../../assets/icons/action-prayer.png'),
  'action-visit':        require('../../assets/icons/action-visit.png'),
  'action-volunteer':    require('../../assets/icons/action-volunteer.png'),
  'action-sermon':       require('../../assets/icons/action-sermon.png'),

  'more-language':       require('../../assets/icons/more-language.png'),
  'more-notifications':  require('../../assets/icons/more-notifications.png'),
  'more-privacy':        require('../../assets/icons/more-privacy.png'),
  'more-terms':          require('../../assets/icons/more-terms.png'),
  'more-directory':      require('../../assets/icons/more-directory.png'),
  'more-receipt':        require('../../assets/icons/more-receipt.png'),
  'more-website':        require('../../assets/icons/more-website.png'),
  'more-admin':          require('../../assets/icons/more-admin.png'),
  'more-edit-name':      require('../../assets/icons/more-edit-name.png'),
  'more-blocked':        require('../../assets/icons/more-blocked.png'),
  'more-signout':        require('../../assets/icons/more-signout.png'),
  'more-delete':         require('../../assets/icons/more-delete.png'),

  'admin-moderation':    require('../../assets/icons/admin-moderation.png'),
  'admin-prayer':        require('../../assets/icons/admin-prayer.png'),
  'admin-visits':        require('../../assets/icons/admin-visits.png'),
  'admin-announce':      require('../../assets/icons/admin-announce.png'),
  'admin-bulletins':     require('../../assets/icons/admin-bulletins.png'),
  'admin-events':        require('../../assets/icons/admin-events.png'),
  'admin-members':       require('../../assets/icons/admin-members.png'),
  'admin-settings':      require('../../assets/icons/admin-settings.png'),

  'ui-calendar':         require('../../assets/icons/ui-calendar.png'),
  'ui-clock':            require('../../assets/icons/ui-clock.png'),
  'ui-pin':              require('../../assets/icons/ui-pin.png'),
  'ui-phone':            require('../../assets/icons/ui-phone.png'),
  'ui-search':           require('../../assets/icons/ui-search.png'),
  'ui-play':             require('../../assets/icons/ui-play.png'),
  'ui-mail':             require('../../assets/icons/ui-mail.png'),
} as const;

export type IconName = keyof typeof ICONS;

export const COMMUNITY_ICON: Record<string, IconName> = {
  kosovo:     'community-kosovo',
  albania:    'community-albania',
  dagestan:   'community-dagestan',
  kissimmee:  'community-kissimmee',
  bridge:     'community-bridge',
  hope:       'community-hope',
  community7: 'community-general',
};

interface Props {
  name: IconName;
  size?: number;
  /** 글리프 색. 배지(community-*)에는 주지 말 것. */
  tintColor?: string;
  style?: StyleProp<ImageStyle>;
}

export default function Icon({ name, size = 24, tintColor, style }: Props) {
  return (
    <Image
      source={ICONS[name]}
      style={[{ width: size, height: size }, tintColor ? { tintColor } : null, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
