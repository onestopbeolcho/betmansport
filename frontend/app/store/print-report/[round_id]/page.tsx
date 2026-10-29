import React from "react";
import StorePrintReportView from "../../../components/StorePrintReportView";

export function generateStaticParams() {
    const ids = ["current", "latest", "45", "85", "86", "87", "88", "89", "90", "260084", "260085", "260086", "260087", "260088", "260089", "260090", "260120", "260125", "260126", "260127", "260128", "260129", "260130"];
    return ids.map((round_id) => ({ round_id }));
}

export default async function StorePrintReportRoundPage({ params }: { params: Promise<{ round_id: string }> }) {
    const resolved = await params;
    return <StorePrintReportView initialRoundId={resolved?.round_id} />;
}
