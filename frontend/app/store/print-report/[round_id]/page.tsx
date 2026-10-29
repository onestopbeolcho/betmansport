import React from "react";
import StorePrintReportView from "../../../components/StorePrintReportView";

export function generateStaticParams() {
    const ids = [
        "current",
        "latest",
        "G011_260065",
        "G027_260031",
        "G055_260098",
        "G055_260099",
        "G056_260099",
        "G025_260032",
        "G005_260032",
        "G015_260104",
        "G015_260105",
        "G101_260129",
        "G101_260128",
        "260065",
        "260031",
        "260098",
        "260099",
        "260032",
        "260104",
        "260105",
        "260128",
        "260129",
    ];
    return ids.map((round_id) => ({ round_id }));
}

export default async function StorePrintReportRoundPage({ params }: { params: Promise<{ round_id: string }> }) {
    const resolved = await params;
    return <StorePrintReportView initialRoundId={resolved?.round_id} />;
}
