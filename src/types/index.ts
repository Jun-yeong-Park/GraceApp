export type UserRole = 'member' | 'deacon' | 'pastor';

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  role: UserRole;
  created_at: string;
}

export interface WorshipOrderItem {
  role: string;    // 사회, 찬양, 기도, 설교 ...
  content: string; // 이름 또는 내용
}

export interface Bulletin {
  id: string;
  title: string;
  date: string;
  worship_order: WorshipOrderItem[];
  announcements: string[];
  prayer_requests: string;
  created_at: string;
}

export interface Sermon {
  id: string;
  title: string;
  preacher: string;
  date: string;
  scripture: string;
  youtube_url?: string;
  description?: string;
  created_at: string;
}

export interface PrayerRequest {
  id: string;
  author_name: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
}

export interface VisitRequest {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  note: string;
  status?: 'pending' | 'confirmed' | 'completed';
  created_at: string;
}

export interface Announcement {
  id: string;
  title_ko: string;
  title_en: string;
  title_es: string;
  body_ko: string;
  body_en: string;
  body_es: string;
  created_at: string;
}

export type BulletinStackParamList = {
  BulletinList: undefined;
  BulletinDetail: { bulletin: Bulletin };
};

export type RootTabParamList = {
  Home: undefined;
  BibleTab: undefined;
  CommunityTab: undefined;
  WorshipTab: undefined;
  More: undefined;
};

export type BibleStackParamList = {
  BibleMain: undefined;
  BibleBookChapters: { bookNum: number; translationId: string };
  BibleChapter: { bookNum: number; chapter: number; translationId: string };
};

export type CommunityTabStackParamList = {
  CommunityMain: undefined;
  CommunityDetail: { communityId: string };
  CommunityPostDetail: { post: CommunityPost; communityId: string };
  CommunityChat: { communityId: string };
};

export type WorshipStackParamList = {
  WorshipMain: undefined;
  BulletinDetail: { bulletin: Bulletin };
};

export interface Member {
  id: string;
  name: string;
  birthday?: string;
  phone?: string;
  email?: string;
  photo_url?: string;
  created_at: string;
}

export type MoreTabParamList = {
  MoreMain: undefined;
  Admin: undefined;
  Directory: undefined;
  MemberDetail: { member: Member };
  Receipt: undefined;
  PrivacyPolicy: undefined;
  Eula: undefined;
  BlockedUsers: undefined;
};

export type MoreStackParamList = {
  HomeMain: undefined;
  Volunteer: undefined;
  Prayer: undefined;
  Visit: undefined;
  SermonSummary: undefined;
  Directory: undefined;
  MemberDetail: { member: Member };
  Admin: undefined;
  Offering: undefined;
  Receipt: undefined;
};

export interface CommunityPhoto {
  id: string;
  community_id: string;
  author_id: string | null;
  author_name: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  community_id: string;
  title: string;
  location?: string;
  event_date?: string;
  description?: string;
  photo_urls?: string[];
  author_id?: string;
  author_name: string;
  created_at: string;
}

export interface VolunteerRole {
  id: string;
  name: string;
  needed: number;
  applicants: string[];
}

export interface VolunteerPost {
  id: string;
  category: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  roles: VolunteerRole[];
  created_at: string;
}
