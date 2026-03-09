import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

import mammoth from "mammoth";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json(
                { error: "Dosya çok büyük. Maksimum 10 MB yüklenebilir." },
                { status: 413 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = file.type;
        const name = file.name;

        // ── PDF ──────────────────────────────────────────────
        if (mime === "application/pdf" || name.endsWith(".pdf")) {
            const data = await pdfParse(buffer);
            const text = data.text.trim().slice(0, 20000); // max 20k char
            return NextResponse.json({
                type: "pdf",
                name,
                content: text,
                pages: data.numpages,
            });
        }

        // ── Word (.docx) ──────────────────────────────────────
        if (
            mime ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            name.endsWith(".docx")
        ) {
            const result = await mammoth.extractRawText({ buffer });
            const text = result.value.trim().slice(0, 20000);
            return NextResponse.json({ type: "word", name, content: text });
        }

        // ── Görsel (PNG / JPG / WEBP) ─────────────────────────
        if (mime.startsWith("image/")) {
            const base64 = buffer.toString("base64");
            const dataUrl = `data:${mime};base64,${base64}`;
            return NextResponse.json({ type: "image", name, dataUrl });
        }

        return NextResponse.json(
            { error: "Desteklenmeyen dosya türü. PDF, Word (.docx) veya görsel (PNG/JPG) yükleyin." },
            { status: 415 }
        );
    } catch (err) {
        console.error("Upload error:", err);
        return NextResponse.json(
            { error: "Dosya işlenirken hata oluştu." },
            { status: 500 }
        );
    }
}
