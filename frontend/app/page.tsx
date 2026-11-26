"use client";
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const actualPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
    if (actualPath && actualPath !== '/' && actualPath !== '/index.html') {
      return;
    }
    const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
    const locale = browserLang === 'en' ? 'en' : 'ko';
    router.replace(`/${locale}`);
  }, [router, pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
      </div>
    </div>
  );
}
