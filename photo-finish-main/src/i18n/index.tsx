/**
 * Photo Finish Pro — محرك الترجمة الثنائية (AR/FR i18n Engine)
 * ============================================================
 * - مزوّد React (I18nProvider + useI18n) لواجهات المكوّنات.
 * - نُسجةsingleton قابلة للاشتراك للخدمات خارج React (تصدير PDF، إشعارات...).
 * - تبديل الاتجاه تلقائياً: عربي = RTL، فرنسي = LTR (يضبط document.documentElement).
 * - تخزين اختيار المستخدم في localStorage واسترجاعه عند الإقلاع
 *   (الافتراضي: لغة متصفح الجهاز — مناسبة ميدانياً في الجزائر ثنائية اللغة).
 */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { dictionaries, type DictKey, type Lang } from './dictionaries';

const LANG_STORAGE_KEY = 'pf_lang_v1';

export type Translator = (key: DictKey, vars?: Record<string, string | number>) => string;

function detectInitialLang(): Lang {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_STORAGE_KEY) : null;
    if (saved === 'ar' || saved === 'fr') return saved;
  } catch { /* تخزين غير متاح */ }
  try {
    const nav = typeof navigator !== 'undefined' ? navigator.language : 'ar';
    return nav?.toLowerCase().startsWith('fr') ? 'fr' : 'ar';
  } catch {
    return 'ar';
  }
}

function applyDocumentLang(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang === 'fr' ? 'fr' : 'ar';
  document.documentElement.dir = lang === 'fr' ? 'ltr' : 'rtl';
}

// ═══ النسخة الخادمية/الخارجية (خارج React) ═══

type LangListener = (lang: Lang) => void;

class I18nCore {
  private lang: Lang = detectInitialLang();
  private listeners = new Set<LangListener>();

  constructor() {
    applyDocumentLang(this.lang);
  }

  public get current(): Lang {
    return this.lang;
  }

  public get isRTL(): boolean {
    return this.lang === 'ar';
  }

  public translate: Translator = (key, vars) => {
    let text = dictionaries[this.lang][key] ?? dictionaries.ar[key] ?? String(key);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return text;
  };

  public setLang(lang: Lang): void {
    if (lang === this.lang) return;
    this.lang = lang;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch { /* */ }
    applyDocumentLang(lang);
    this.listeners.forEach(fn => {
      try { fn(lang); } catch { /* */ }
    });
  }

  public subscribe(fn: LangListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const i18n = new I18nCore();

// ═══ طبقة React ═══

interface I18nContextValue {
  lang: Lang;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  t: Translator;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(i18n.current);

  useEffect(() => {
    const unsub = i18n.subscribe(setLangState);
    return unsub;
  }, []);

  const setLang = useCallback((next: Lang) => {
    i18n.setLang(next);
    setLangState(next);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    isRTL: lang === 'ar',
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    t: i18n.translate,
    setLang,
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // سقوط آمن لأي مكوّن خارج المزوّد (اختبارات/أدوات)
    return {
      lang: i18n.current,
      isRTL: i18n.isRTL,
      dir: i18n.isRTL ? 'rtl' : 'ltr',
      t: i18n.translate,
      setLang: (l: Lang) => i18n.setLang(l),
    };
  }
  return ctx;
}
