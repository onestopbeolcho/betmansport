import ClientPage from './ClientPage';

export async function generateStaticParams() {
    try {
        const res = await fetch('https://scorenix-backend-n5dv44kdaa-du.a.run.app/api/ai/predictions');
        if (res.ok) {
            const data = await res.json();
            return (data.predictions || []).map((p: any) => ({
                match_id: encodeURIComponent(p.match_id),
            }));
        }
    } catch (e) {
        console.error("Failed to fetch predictions for static build", e);
    }
    return [];
}

export default function Page() {
    return <ClientPage />;
}
