import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from '../i18n/translations';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const DEFAULT_LANG: Language = 'en';

const LanguageContext = createContext<LanguageContextType>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => translations[DEFAULT_LANG][key] as string,
});

const STORAGE_KEY = '@grace_app_language';
const VALID_LANGS: Language[] = ['ko', 'en', 'es'];

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(DEFAULT_LANG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && VALID_LANGS.includes(saved as Language)) {
          setLangState(saved as Language);
        }
      })
      .catch(() => {});
  }, []);

  function setLang(newLang: Language) {
    setLangState(newLang);
    AsyncStorage.setItem(STORAGE_KEY, newLang);
  }

  function t(key: TranslationKey): string {
    const val = translations[lang][key];
    if (val !== undefined) return val as string;
    return translations[DEFAULT_LANG][key] as string;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
