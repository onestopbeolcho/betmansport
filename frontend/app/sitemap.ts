import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://scorenix-backend-n5dv44kdaa-du.a.run.app';
const SITE_URL = 'https://scorenix.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    '', '/ko', '/en', '/ja', '/zh',
    '/ko/market', '/en/market',
    '/ko/analysis', '/en/analysis',
    '/ko/bets', '/en/bets',
    '/ko/manual', '/en/manual',
    '/ko/pricing', '/en/pricing',
    '/ko/vip', '/en/vip'
  ];

  const staticSitemap = routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' || route === '/ko' ? 1 : 0.8,
  }));

  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/match-list`, { next: { revalidate: 3600 } });
    if (!res.ok) return staticSitemap;
    const data = await res.json();
    const matches = data.matches || [];

    const dynamicSitemap = matches.flatMap((match: any) => {
      return ['ko', 'en'].map(lang => ({
        url: `${SITE_URL}/${lang}/match/${match.date}/${match.slug}`,
        lastModified: new Date(),
        changeFrequency: 'hourly' as const,
        priority: 0.9,
      }));
    });

    return [...staticSitemap, ...dynamicSitemap];
  } catch (e) {
    console.error('Failed to generate dynamic sitemap:', e);
    return staticSitemap;
  }
}
