"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, localizedName, translate, type Locale, type Messages } from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  messages: Messages;
};

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, messages: {} });

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const { messages, locale } = useContext(I18nContext);
  return useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(messages, key, undefined, params);
    },
    [messages, locale],
  );
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export function useLocalizedName() {
  const locale = useLocale();
  return useCallback(
    (entity: { code?: string; nameRu?: string; nameUk?: string; name?: string } | null | undefined) => {
      return localizedName(locale, entity);
    },
    [locale],
  );
}
