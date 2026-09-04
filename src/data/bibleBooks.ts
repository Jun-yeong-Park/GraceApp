export type Testament = 'OT' | 'NT';

export interface BibleBook {
  num: number;
  name: { ko: string; en: string; es: string };
  chapters: number;
  testament: Testament;
}

// getbible.net v2 translation codes
export const BIBLE_TRANSLATION: Record<string, string> = {
  ko: 'korean',
  en: 'kjv',
  es: 'rv1960',
};

export const BIBLE_BOOKS: BibleBook[] = [
  // ─── 구약 (Old Testament) ────────────────────────────────────────────────────
  { num: 1,  name: { ko: '창세기',      en: 'Genesis',        es: 'Génesis'        }, chapters: 50,  testament: 'OT' },
  { num: 2,  name: { ko: '출애굽기',    en: 'Exodus',         es: 'Éxodo'          }, chapters: 40,  testament: 'OT' },
  { num: 3,  name: { ko: '레위기',      en: 'Leviticus',      es: 'Levítico'       }, chapters: 27,  testament: 'OT' },
  { num: 4,  name: { ko: '민수기',      en: 'Numbers',        es: 'Números'        }, chapters: 36,  testament: 'OT' },
  { num: 5,  name: { ko: '신명기',      en: 'Deuteronomy',    es: 'Deuteronomio'   }, chapters: 34,  testament: 'OT' },
  { num: 6,  name: { ko: '여호수아',    en: 'Joshua',         es: 'Josué'          }, chapters: 24,  testament: 'OT' },
  { num: 7,  name: { ko: '사사기',      en: 'Judges',         es: 'Jueces'         }, chapters: 21,  testament: 'OT' },
  { num: 8,  name: { ko: '룻기',        en: 'Ruth',           es: 'Rut'            }, chapters: 4,   testament: 'OT' },
  { num: 9,  name: { ko: '사무엘상',    en: '1 Samuel',       es: '1 Samuel'       }, chapters: 31,  testament: 'OT' },
  { num: 10, name: { ko: '사무엘하',    en: '2 Samuel',       es: '2 Samuel'       }, chapters: 24,  testament: 'OT' },
  { num: 11, name: { ko: '열왕기상',    en: '1 Kings',        es: '1 Reyes'        }, chapters: 22,  testament: 'OT' },
  { num: 12, name: { ko: '열왕기하',    en: '2 Kings',        es: '2 Reyes'        }, chapters: 25,  testament: 'OT' },
  { num: 13, name: { ko: '역대상',      en: '1 Chronicles',   es: '1 Crónicas'     }, chapters: 29,  testament: 'OT' },
  { num: 14, name: { ko: '역대하',      en: '2 Chronicles',   es: '2 Crónicas'     }, chapters: 36,  testament: 'OT' },
  { num: 15, name: { ko: '에스라',      en: 'Ezra',           es: 'Esdras'         }, chapters: 10,  testament: 'OT' },
  { num: 16, name: { ko: '느헤미야',    en: 'Nehemiah',       es: 'Nehemías'       }, chapters: 13,  testament: 'OT' },
  { num: 17, name: { ko: '에스더',      en: 'Esther',         es: 'Ester'          }, chapters: 10,  testament: 'OT' },
  { num: 18, name: { ko: '욥기',        en: 'Job',            es: 'Job'            }, chapters: 42,  testament: 'OT' },
  { num: 19, name: { ko: '시편',        en: 'Psalms',         es: 'Salmos'         }, chapters: 150, testament: 'OT' },
  { num: 20, name: { ko: '잠언',        en: 'Proverbs',       es: 'Proverbios'     }, chapters: 31,  testament: 'OT' },
  { num: 21, name: { ko: '전도서',      en: 'Ecclesiastes',   es: 'Eclesiastés'    }, chapters: 12,  testament: 'OT' },
  { num: 22, name: { ko: '아가',        en: 'Song of Solomon',es: 'Cantares'       }, chapters: 8,   testament: 'OT' },
  { num: 23, name: { ko: '이사야',      en: 'Isaiah',         es: 'Isaías'         }, chapters: 66,  testament: 'OT' },
  { num: 24, name: { ko: '예레미야',    en: 'Jeremiah',       es: 'Jeremías'       }, chapters: 52,  testament: 'OT' },
  { num: 25, name: { ko: '예레미야애가',en: 'Lamentations',   es: 'Lamentaciones'  }, chapters: 5,   testament: 'OT' },
  { num: 26, name: { ko: '에스겔',      en: 'Ezekiel',        es: 'Ezequiel'       }, chapters: 48,  testament: 'OT' },
  { num: 27, name: { ko: '다니엘',      en: 'Daniel',         es: 'Daniel'         }, chapters: 12,  testament: 'OT' },
  { num: 28, name: { ko: '호세아',      en: 'Hosea',          es: 'Oseas'          }, chapters: 14,  testament: 'OT' },
  { num: 29, name: { ko: '요엘',        en: 'Joel',           es: 'Joel'           }, chapters: 3,   testament: 'OT' },
  { num: 30, name: { ko: '아모스',      en: 'Amos',           es: 'Amós'           }, chapters: 9,   testament: 'OT' },
  { num: 31, name: { ko: '오바댜',      en: 'Obadiah',        es: 'Abdías'         }, chapters: 1,   testament: 'OT' },
  { num: 32, name: { ko: '요나',        en: 'Jonah',          es: 'Jonás'          }, chapters: 4,   testament: 'OT' },
  { num: 33, name: { ko: '미가',        en: 'Micah',          es: 'Miqueas'        }, chapters: 7,   testament: 'OT' },
  { num: 34, name: { ko: '나훔',        en: 'Nahum',          es: 'Nahúm'          }, chapters: 3,   testament: 'OT' },
  { num: 35, name: { ko: '하박국',      en: 'Habakkuk',       es: 'Habacuc'        }, chapters: 3,   testament: 'OT' },
  { num: 36, name: { ko: '스바냐',      en: 'Zephaniah',      es: 'Sofonías'       }, chapters: 3,   testament: 'OT' },
  { num: 37, name: { ko: '학개',        en: 'Haggai',         es: 'Hageo'          }, chapters: 2,   testament: 'OT' },
  { num: 38, name: { ko: '스가랴',      en: 'Zechariah',      es: 'Zacarías'       }, chapters: 14,  testament: 'OT' },
  { num: 39, name: { ko: '말라기',      en: 'Malachi',        es: 'Malaquías'      }, chapters: 4,   testament: 'OT' },
  // ─── 신약 (New Testament) ────────────────────────────────────────────────────
  { num: 40, name: { ko: '마태복음',    en: 'Matthew',        es: 'Mateo'          }, chapters: 28,  testament: 'NT' },
  { num: 41, name: { ko: '마가복음',    en: 'Mark',           es: 'Marcos'         }, chapters: 16,  testament: 'NT' },
  { num: 42, name: { ko: '누가복음',    en: 'Luke',           es: 'Lucas'          }, chapters: 24,  testament: 'NT' },
  { num: 43, name: { ko: '요한복음',    en: 'John',           es: 'Juan'           }, chapters: 21,  testament: 'NT' },
  { num: 44, name: { ko: '사도행전',    en: 'Acts',           es: 'Hechos'         }, chapters: 28,  testament: 'NT' },
  { num: 45, name: { ko: '로마서',      en: 'Romans',         es: 'Romanos'        }, chapters: 16,  testament: 'NT' },
  { num: 46, name: { ko: '고린도전서',  en: '1 Corinthians',  es: '1 Corintios'    }, chapters: 16,  testament: 'NT' },
  { num: 47, name: { ko: '고린도후서',  en: '2 Corinthians',  es: '2 Corintios'    }, chapters: 13,  testament: 'NT' },
  { num: 48, name: { ko: '갈라디아서',  en: 'Galatians',      es: 'Gálatas'        }, chapters: 6,   testament: 'NT' },
  { num: 49, name: { ko: '에베소서',    en: 'Ephesians',      es: 'Efesios'        }, chapters: 6,   testament: 'NT' },
  { num: 50, name: { ko: '빌립보서',    en: 'Philippians',    es: 'Filipenses'     }, chapters: 4,   testament: 'NT' },
  { num: 51, name: { ko: '골로새서',    en: 'Colossians',     es: 'Colosenses'     }, chapters: 4,   testament: 'NT' },
  { num: 52, name: { ko: '데살로니가전서',en: '1 Thessalonians',es:'1 Tesalonicenses'}, chapters: 5,  testament: 'NT' },
  { num: 53, name: { ko: '데살로니가후서',en: '2 Thessalonians',es:'2 Tesalonicenses'}, chapters: 3,  testament: 'NT' },
  { num: 54, name: { ko: '디모데전서',  en: '1 Timothy',      es: '1 Timoteo'      }, chapters: 6,   testament: 'NT' },
  { num: 55, name: { ko: '디모데후서',  en: '2 Timothy',      es: '2 Timoteo'      }, chapters: 4,   testament: 'NT' },
  { num: 56, name: { ko: '디도서',      en: 'Titus',          es: 'Tito'           }, chapters: 3,   testament: 'NT' },
  { num: 57, name: { ko: '빌레몬서',    en: 'Philemon',       es: 'Filemón'        }, chapters: 1,   testament: 'NT' },
  { num: 58, name: { ko: '히브리서',    en: 'Hebrews',        es: 'Hebreos'        }, chapters: 13,  testament: 'NT' },
  { num: 59, name: { ko: '야고보서',    en: 'James',          es: 'Santiago'       }, chapters: 5,   testament: 'NT' },
  { num: 60, name: { ko: '베드로전서',  en: '1 Peter',        es: '1 Pedro'        }, chapters: 5,   testament: 'NT' },
  { num: 61, name: { ko: '베드로후서',  en: '2 Peter',        es: '2 Pedro'        }, chapters: 3,   testament: 'NT' },
  { num: 62, name: { ko: '요한일서',    en: '1 John',         es: '1 Juan'         }, chapters: 5,   testament: 'NT' },
  { num: 63, name: { ko: '요한이서',    en: '2 John',         es: '2 Juan'         }, chapters: 1,   testament: 'NT' },
  { num: 64, name: { ko: '요한삼서',    en: '3 John',         es: '3 Juan'         }, chapters: 1,   testament: 'NT' },
  { num: 65, name: { ko: '유다서',      en: 'Jude',           es: 'Judas'          }, chapters: 1,   testament: 'NT' },
  { num: 66, name: { ko: '요한계시록',  en: 'Revelation',     es: 'Apocalipsis'    }, chapters: 22,  testament: 'NT' },
];

export const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((sum, b) => sum + b.chapters, 0); // 1189

// bible.json 키에 쓰이는 한글 약어 (책번호 → 약어)
export const BOOK_ABBR: Record<number, string> = {
  1:  '창',  2:  '출',  3:  '레',  4:  '민',  5:  '신',
  6:  '수',  7:  '삿',  8:  '룻',  9:  '삼상', 10: '삼하',
  11: '왕상', 12: '왕하', 13: '대상', 14: '대하', 15: '스',
  16: '느',  17: '에',  18: '욥',  19: '시',  20: '잠',
  21: '전',  22: '아',  23: '사',  24: '렘',  25: '애',
  26: '겔',  27: '단',  28: '호',  29: '욜',  30: '암',
  31: '옵',  32: '욘',  33: '미',  34: '나',  35: '합',
  36: '습',  37: '학',  38: '슥',  39: '말',
  40: '마',  41: '막',  42: '눅',  43: '요',  44: '행',
  45: '롬',  46: '고전', 47: '고후', 48: '갈',  49: '엡',
  50: '빌',  51: '골',  52: '살전', 53: '살후', 54: '딤전',
  55: '딤후', 56: '딛',  57: '몬',  58: '히',  59: '약',
  60: '벧전', 61: '벧후', 62: '요일', 63: '요이', 64: '요삼',
  65: '유',  66: '계',
};
