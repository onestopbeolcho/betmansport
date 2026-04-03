import { getDictionary } from '../lib/getDictionary';
import { i18n, type Locale } from '../lib/i18n-config';
import { DictionaryProvider } from '../context/DictionaryContext';
import BetSlip from '../components/BetSlip';
import Footer from '../components/Footer';

const SITE_URL = 'https://scorenix.com';

export async function generateStaticParams() {
    return i18n.locales.map((locale) => ({ lang: locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
    const { lang: rawLang } = await params;
    const lang = (i18n.locales.includes(rawLang as Locale) ? rawLang : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(lang);

    const ogLocaleMap: Record<string, string> = {
        ko: 'ko_KR', en: 'en_US', ja: 'ja_JP', zh: 'zh_CN', es: 'es_ES',
        fr: 'fr_FR', de: 'de_DE', pt: 'pt_BR', it: 'it_IT', ru: 'ru_RU',
        ar: 'ar_SA', hi: 'hi_IN', th: 'th_TH', vi: 'vi_VN', id: 'id_ID',
        tr: 'tr_TR', pl: 'pl_PL', nl: 'nl_NL', sv: 'sv_SE', da: 'da_DK', nb: 'nb_NO',
    };

    return {
        title: dict.metadata.title,
        description: dict.metadata.description,
        keywords: dict.metadata.keywords,
        alternates: {
            canonical: `${SITE_URL}/${lang}`,
            languages: Object.fromEntries(
                i18n.locales.map(l => [l, `${SITE_URL}/${l}`])
            ),
        },
        openGraph: {
            type: 'website' as const,
            locale: ogLocaleMap[lang] || 'en_US',
            url: `${SITE_URL}/${lang}`,
            siteName: 'Scorenix',
            title: dict.metadata.title,
            description: dict.metadata.description,
            images: [
                {
                    url: '/og-image.png',
                    width: 1200,
                    height: 630,
                    alt: 'Scorenix AI Sports Data Analytics',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image' as const,
            title: dict.metadata.title,
            description: dict.metadata.description,
            images: ['/og-image.png'],
        },
    };
}

export default async function LangLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ lang: string }>;
}) {
    const { lang: rawLang } = await params;
    const lang = (i18n.locales.includes(rawLang as Locale) ? rawLang : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(lang);

    return (
        <DictionaryProvider dictionary={dict}>
            {children}
            <Footer lang={lang} />
            <BetSlip />
        </DictionaryProvider>
    );
}
