import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { i18n } from './app/lib/i18n-config';

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Skip internal paths
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/firebase') ||
        pathname.includes('.') // static files
    ) {
        return;
    }

    // Check if the pathname already has a supported locale
    const pathnameHasLocale = i18n.locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) return;

    // Detect preferred language from Accept-Language header
    const acceptLang = request.headers.get('accept-language') || '';
    const preferredLocale = getPreferredLocale(acceptLang);

    // Redirect to default locale path
    const locale = preferredLocale || i18n.defaultLocale;
    return NextResponse.redirect(
        new URL(`/${locale}${pathname}`, request.url)
    );
}

function getPreferredLocale(acceptLanguage: string): string | null {
    const locales = i18n.locales as readonly string[];
    const langs = acceptLanguage.split(',').map(l => l.split(';')[0].trim().toLowerCase());

    for (const lang of langs) {
        // Exact match (e.g., 'ko', 'en')
        if (locales.includes(lang)) return lang;
        // Prefix match (e.g., 'ko-KR' -> 'ko', 'zh-TW' -> 'zh-TW')
        const prefix = lang.split('-')[0];
        if (locales.includes(prefix)) return prefix;
        // Check full code match for zh-CN, zh-TW, pt-BR
        const found = locales.find(l => l.toLowerCase() === lang);
        if (found) return found;
    }
    return null;
}

export const config = {
    matcher: ['/((?!_next|api|firebase|.*\\..*).*)'],
};
