export const i18n = {
    defaultLocale: 'ko' as const,
    locales: [
        // East Asia
        'ko', 'en', 'ja', 'zh-CN', 'zh-TW',
        // Europe
        'es', 'pt', 'fr', 'de', 'it', 'ru', 'tr', 'pl', 'nl',
        // Southeast Asia
        'vi', 'th', 'id', 'ms', 'tl', 'my', 'km',
    ] as const,
};

export type Locale = (typeof i18n)['locales'][number];

// Language display info for UI
export const languageNames: Record<string, { flag: string; name: string; nativeName: string }> = {
    // East Asia
    'ko': { flag: '🇰🇷', name: 'Korean', nativeName: '한국어' },
    'en': { flag: '🇺🇸', name: 'English', nativeName: 'English' },
    'ja': { flag: '🇯🇵', name: 'Japanese', nativeName: '日本語' },
    'zh-CN': { flag: '🇨🇳', name: 'Chinese (Simplified)', nativeName: '简体中文' },
    'zh-TW': { flag: '🇹🇼', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
    // Europe
    'es': { flag: '🇪🇸', name: 'Spanish', nativeName: 'Español' },
    'pt': { flag: '🇧🇷', name: 'Portuguese', nativeName: 'Português' },
    'fr': { flag: '🇫🇷', name: 'French', nativeName: 'Français' },
    'de': { flag: '🇩🇪', name: 'German', nativeName: 'Deutsch' },
    'it': { flag: '🇮🇹', name: 'Italian', nativeName: 'Italiano' },
    'ru': { flag: '🇷🇺', name: 'Russian', nativeName: 'Русский' },
    'tr': { flag: '🇹🇷', name: 'Turkish', nativeName: 'Türkçe' },
    'pl': { flag: '🇵🇱', name: 'Polish', nativeName: 'Polski' },
    'nl': { flag: '🇳🇱', name: 'Dutch', nativeName: 'Nederlands' },
    // Southeast Asia
    'vi': { flag: '🇻🇳', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
    'th': { flag: '🇹🇭', name: 'Thai', nativeName: 'ภาษาไทย' },
    'id': { flag: '🇮🇩', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
    'ms': { flag: '🇲🇾', name: 'Malay', nativeName: 'Bahasa Melayu' },
    'tl': { flag: '🇵🇭', name: 'Filipino', nativeName: 'Filipino' },
    'my': { flag: '🇲🇲', name: 'Burmese', nativeName: 'မြန်မာ' },
    'km': { flag: '🇰🇭', name: 'Khmer', nativeName: 'ភាសាខ្មែរ' },
};
