import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export type ExportMessage = {
    role: "user" | "assistant";
    content: string;
};

function cleanText(text: string): string {
    return text.replace(/\*\*/g, "").replace(/#{1,6}\s/g, "").trim();
}

// ── PDF Export ────────────────────────────────────────────
export function exportToPDF(
    messages: ExportMessage[],
    agentName: string
): void {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxW = pageW - margin * 2;
    let y = 20;

    const addPage = () => {
        doc.addPage();
        y = 20;
    };

    const checkY = (needed: number) => {
        if (y + needed > 280) addPage();
    };

    // Başlık
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Teknofest Rapor Asistanı — ${agentName}`, margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text(
        `Oluşturulma tarihi: ${new Date().toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        })}`,
        margin,
        y
    );
    y += 10;

    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // Mesajlar
    messages.forEach((msg) => {
        const isUser = msg.role === "user";
        const label = isUser ? "Kullanıcı" : agentName;
        const lines = doc.splitTextToSize(cleanText(msg.content), maxW);

        checkY(10 + lines.length * 5);

        // Etiket
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(isUser ? 30 : 59, isUser ? 100 : 130, isUser ? 200 : 246);
        doc.text(label, margin, y);
        y += 6;

        // İçerik
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);

        lines.forEach((line: string) => {
            checkY(5);
            doc.text(line, margin, y);
            y += 5;
        });

        y += 6;
    });

    doc.save(`teknofest-${agentName.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

// ── Word Export ───────────────────────────────────────────
export async function exportToWord(
    messages: ExportMessage[],
    agentName: string
): Promise<void> {
    const dateStr = new Date().toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });

    const children = [
        new Paragraph({
            text: `Teknofest Rapor Asistanı — ${agentName}`,
            heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: `Oluşturulma tarihi: ${dateStr}`,
                    color: "888888",
                    size: 20,
                }),
            ],
        }),
        new Paragraph({ text: "" }),
        ...messages.flatMap((msg) => {
            const isUser = msg.role === "user";
            const label = isUser ? "Kullanıcı" : agentName;
            const lines = cleanText(msg.content).split("\n");

            return [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: label,
                            bold: true,
                            color: isUser ? "1E64C8" : "3B82F6",
                            size: 22,
                        }),
                    ],
                }),
                ...lines.map(
                    (line) =>
                        new Paragraph({
                            children: [new TextRun({ text: line, size: 22 })],
                            spacing: { after: 80 },
                        })
                ),
                new Paragraph({ text: "" }),
            ];
        }),
    ];

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teknofest-${agentName.toLowerCase().replace(/\s+/g, "-")}.docx`;
    a.click();
    URL.revokeObjectURL(url);
}
