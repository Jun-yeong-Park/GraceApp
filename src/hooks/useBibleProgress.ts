import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BIBLE_BOOKS } from '../data/bibleBooks';

const STORAGE_KEY = '@bible_read_chapters';

// key format: "{bookNum}_{chapter}"  e.g. "1_1" = Genesis 1
type ProgressMap = Record<string, boolean>;

export function useBibleProgress() {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setProgress(JSON.parse(raw)); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const save = useCallback((next: ProgressMap) => {
    setProgress(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const chapterKey = (bookNum: number, chapter: number) => `${bookNum}_${chapter}`;

  const isRead = useCallback(
    (bookNum: number, chapter: number) => !!progress[chapterKey(bookNum, chapter)],
    [progress],
  );

  const toggleRead = useCallback(
    (bookNum: number, chapter: number) => {
      const key = chapterKey(bookNum, chapter);
      const next = { ...progress, [key]: !progress[key] };
      if (!next[key]) delete next[key];
      save(next);
    },
    [progress, save],
  );

  const markAllRead = useCallback(
    (bookNum: number) => {
      const book = BIBLE_BOOKS.find(b => b.num === bookNum);
      if (!book) return;
      const next = { ...progress };
      for (let c = 1; c <= book.chapters; c++) {
        next[chapterKey(bookNum, c)] = true;
      }
      save(next);
    },
    [progress, save],
  );

  const clearBook = useCallback(
    (bookNum: number) => {
      const book = BIBLE_BOOKS.find(b => b.num === bookNum);
      if (!book) return;
      const next = { ...progress };
      for (let c = 1; c <= book.chapters; c++) {
        delete next[chapterKey(bookNum, c)];
      }
      save(next);
    },
    [progress, save],
  );

  const getBookProgress = useCallback(
    (bookNum: number) => {
      const book = BIBLE_BOOKS.find(b => b.num === bookNum);
      if (!book) return { read: 0, total: 0 };
      let read = 0;
      for (let c = 1; c <= book.chapters; c++) {
        if (progress[chapterKey(bookNum, c)]) read++;
      }
      return { read, total: book.chapters };
    },
    [progress],
  );

  const getTotalProgress = useCallback(() => {
    const total = BIBLE_BOOKS.reduce((s, b) => s + b.chapters, 0);
    const read = Object.values(progress).filter(Boolean).length;
    return { read, total };
  }, [progress]);

  return { isRead, toggleRead, markAllRead, clearBook, getBookProgress, getTotalProgress, loaded };
}
