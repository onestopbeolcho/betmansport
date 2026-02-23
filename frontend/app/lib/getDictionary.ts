import type { Locale } from './i18n-config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dictionaries: Record<string, () => Promise<any>> = {
    // East Asia
    ko: () => import('../dictionaries/ko.json').then((m) => m.default),
    en: () => import('../dictionaries/en.json').then((m) => m.default),
    ja: () => import('../dictionaries/ja.json').then((m) => m.default),
    'zh-CN': () => import('../dictionaries/zh-CN.json').then((m) => m.default),
    'zh-TW': () => import('../dictionaries/zh-TW.json').then((m) => m.default),
    // Europe
    es: () => import('../dictionaries/es.json').then((m) => m.default),
    pt: () => import('../dictionaries/pt.json').then((m) => m.default),
    fr: () => import('../dictionaries/fr.json').then((m) => m.default),
    de: () => import('../dictionaries/de.json').then((m) => m.default),
    it: () => import('../dictionaries/it.json').then((m) => m.default),
    ru: () => import('../dictionaries/ru.json').then((m) => m.default),
    tr: () => import('../dictionaries/tr.json').then((m) => m.default),
    pl: () => import('../dictionaries/pl.json').then((m) => m.default),
    nl: () => import('../dictionaries/nl.json').then((m) => m.default),
    // Southeast Asia
    vi: () => import('../dictionaries/vi.json').then((m) => m.default),
    th: () => import('../dictionaries/th.json').then((m) => m.default),
    id: () => import('../dictionaries/id.json').then((m) => m.default),
    ms: () => import('../dictionaries/ms.json').then((m) => m.default),
    tl: () => import('../dictionaries/tl.json').then((m) => m.default),
    my: () => import('../dictionaries/my.json').then((m) => m.default),
    km: () => import('../dictionaries/km.json').then((m) => m.default),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDictionary = async (locale: Locale): Promise<any> => {
    const loader = dictionaries[locale] || dictionaries['ko'];
    return loader();
};
