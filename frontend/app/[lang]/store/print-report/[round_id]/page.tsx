import React from "react";
import StorePrintReportView from "../../../../components/StorePrintReportView";
import { i18n } from "../../../../lib/i18n-config";

export function generateStaticParams() {
    const ids = ["current", "latest", "45", "85", "86", "87", "88", "89", "90", "260084", "260085", "260086", "260087", "260088", "260089", "260090", "260120", "260125", "260126", "260127", "260128", "260129", "260130"];
    const params: { lang: string; round_id: string }[] = [];
    for (const lang of i18n.locales) {
        for (const round_id of ids) {
            params.push({ lang, round_id });
        }
    }
    return params;
}

export default async function LangStorePrintReportRoundPage({ params }: { params: Promise<{ lang: string; round_id: string }> }) {
    const resolved = await params;
    return <StorePrintReportView initialRoundId={resolved?.round_id} />;
}
