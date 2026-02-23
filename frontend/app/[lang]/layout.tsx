import { getDictionary } from '../lib/getDictionary';
import { i18n, type Locale } from '../lib/i18n-config';
import { DictionaryProvider } from '../context/DictionaryContext';
import BetSlip from '../components/BetSlip';
import Footer from '../components/Footer';

export async function generateStaticParams() {
    return i18n.locales.map((locale) => ({ lang: locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
    const { lang: rawLang } = await params;
    const lang = (i18n.locales.includes(rawLang as Locale) ? rawLang : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(lang);
    return {
        title: dict.metadata.title,
        description: dict.metadata.description,
        keywords: dict.metadata.keywords,
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
