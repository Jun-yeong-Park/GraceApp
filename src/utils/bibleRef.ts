import { BIBLE_BOOKS, BOOK_ABBR } from '../data/bibleBooks';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
export interface ParsedRef {
  bookNum: number;
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

export interface VerseResult {
  ko: string;
  en: string;
  es: string;
  ref: string; // 정규화된 구절 표기 (한국어)
}

type FlatBible = Record<string, string>;

// ─── 오프라인 성경 데이터 ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GAEYEOK: FlatBible = require('../../bible.json');       // 개역개정 (창1:1)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NIV: FlatBible     = require('../../niv_flat.json');    // NIV      (43:3:16)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RV: FlatBible      = require('../../rv_flat.json');     // 스페인어 Reina-Valera (43:3:16)

// ─── 책 이름 → 책 번호 매핑 테이블 ───────────────────────────────────────────
// 한글 약어 → 책번호 (역방향)
const ABBR_TO_NUM: Record<string, number> = Object.fromEntries(
  Object.entries(BOOK_ABBR).map(([num, abbr]) => [abbr, Number(num)])
);

// 추가 한글 별칭
const KO_ALIAS: Record<string, number> = {
  '창세기': 1,  '출애굽기': 2, '레위기': 3,   '민수기': 4,   '신명기': 5,
  '여호수아': 6,'사사기': 7,  '룻기': 8,     '사무엘상': 9, '사무엘하': 10,
  '열왕기상': 11,'열왕기하': 12,'역대상': 13, '역대하': 14,  '에스라': 15,
  '느헤미야': 16,'에스더': 17, '욥기': 18,   '시편': 19,    '잠언': 20,
  '전도서': 21, '아가': 22,   '이사야': 23,  '예레미야': 24,'예레미야애가': 25,
  '에스겔': 26, '다니엘': 27, '호세아': 28,  '요엘': 29,    '아모스': 30,
  '오바댜': 31, '요나': 32,   '미가': 33,    '나훔': 34,    '하박국': 35,
  '스바냐': 36, '학개': 37,   '스가랴': 38,  '말라기': 39,
  '마태복음': 40,'마가복음': 41,'누가복음': 42,'요한복음': 43,'사도행전': 44,
  '로마서': 45, '고린도전서': 46,'고린도후서': 47,'갈라디아서': 48,'에베소서': 49,
  '빌립보서': 50,'골로새서': 51,'데살로니가전서': 52,'데살로니가후서': 53,
  '디모데전서': 54,'디모데후서': 55,'디도서': 56,'빌레몬서': 57,'히브리서': 58,
  '야고보서': 59,'베드로전서': 60,'베드로후서': 61,'요한일서': 62,
  '요한이서': 63,'요한삼서': 64,'유다서': 65,'요한계시록': 66,
};

// 영어 이름 → 책번호
const EN_TO_NUM: Record<string, number> = Object.fromEntries(
  BIBLE_BOOKS.map(b => [b.name.en.toLowerCase(), b.num])
);

// ─── 구절 참조 파싱 ──────────────────────────────────────────────────────────
export function parseBibleRef(refStr: string): ParsedRef | null {
  const s = refStr.trim();

  // 패턴: "<책이름> <장>:<절>" 또는 "<책이름> <장>:<절>-<절>"
  const m = s.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return null;

  const bookRaw = m[1].trim();
  const chapter = parseInt(m[2], 10);
  const verseStart = parseInt(m[3], 10);
  const verseEnd = m[4] ? parseInt(m[4], 10) : verseStart;

  const bookNum = resolveBook(bookRaw);
  if (!bookNum) return null;
  if (isNaN(chapter) || isNaN(verseStart)) return null;

  return { bookNum, chapter, verseStart, verseEnd };
}

function resolveBook(name: string): number | null {
  // 1. 한글 전체 이름
  if (KO_ALIAS[name] !== undefined) return KO_ALIAS[name];
  // 2. 한글 약어
  if (ABBR_TO_NUM[name] !== undefined) return ABBR_TO_NUM[name];
  // 3. 영어 전체 이름 (대소문자 무관)
  const enNum = EN_TO_NUM[name.toLowerCase()];
  if (enNum !== undefined) return enNum;
  // 4. 한글 접두사 (ex. "요한" → 요한복음)
  const koMatch = BIBLE_BOOKS
    .filter(b => b.name.ko.startsWith(name))
    .sort((a, b) => a.num - b.num); // 책 번호 순 (요한복음 > 요한일서)
  if (koMatch.length > 0) return koMatch[0].num;
  // 5. 영어 접두사
  const enMatch = BIBLE_BOOKS
    .filter(b => b.name.en.toLowerCase().startsWith(name.toLowerCase()))
    .sort((a, b) => a.num - b.num);
  if (enMatch.length > 0) return enMatch[0].num;
  return null;
}

// ─── 개역개정 조회 ────────────────────────────────────────────────────────────
export function lookupGaeyeok(ref: ParsedRef): string {
  const abbr = BOOK_ABBR[ref.bookNum];
  if (!abbr) return '';
  const verses: string[] = [];
  for (let v = ref.verseStart; v <= ref.verseEnd; v++) {
    const text = GAEYEOK[`${abbr}${ref.chapter}:${v}`];
    if (text) verses.push(text.trim());
  }
  return verses.join(' ');
}

// ─── NIV 조회 ────────────────────────────────────────────────────────────────
export function lookupNIV(ref: ParsedRef): string {
  const verses: string[] = [];
  for (let v = ref.verseStart; v <= ref.verseEnd; v++) {
    const text = NIV[`${ref.bookNum}:${ref.chapter}:${v}`];
    if (text) verses.push(text.trim());
  }
  return verses.join(' ');
}

// ─── 스페인어 Reina-Valera 조회 (오프라인) ──────────────────────────────────
export function lookupRVR1960(ref: ParsedRef): string {
  const verses: string[] = [];
  for (let v = ref.verseStart; v <= ref.verseEnd; v++) {
    const text = RV[`${ref.bookNum}:${ref.chapter}:${v}`];
    if (text) verses.push(text.trim());
  }
  return verses.join(' ');
}

// ─── 정규화된 구절 표기 생성 ─────────────────────────────────────────────────
export function normalizeRef(ref: ParsedRef): string {
  const book = BIBLE_BOOKS.find(b => b.num === ref.bookNum);
  if (!book) return '';
  const range = ref.verseStart === ref.verseEnd
    ? `${ref.verseStart}`
    : `${ref.verseStart}-${ref.verseEnd}`;
  return `${book.name.ko} ${ref.chapter}:${range}`;
}

export function normalizeRefEn(ref: ParsedRef): string {
  const book = BIBLE_BOOKS.find(b => b.num === ref.bookNum);
  if (!book) return '';
  const range = ref.verseStart === ref.verseEnd
    ? `${ref.verseStart}`
    : `${ref.verseStart}-${ref.verseEnd}`;
  return `${book.name.en} ${ref.chapter}:${range}`;
}

export function normalizeRefEs(ref: ParsedRef): string {
  const book = BIBLE_BOOKS.find(b => b.num === ref.bookNum);
  if (!book) return '';
  const range = ref.verseStart === ref.verseEnd
    ? `${ref.verseStart}`
    : `${ref.verseStart}-${ref.verseEnd}`;
  return `${book.name.es} ${ref.chapter}:${range}`;
}
