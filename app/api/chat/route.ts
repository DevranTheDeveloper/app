import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { agents } from "@/lib/agents";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function getTurkishDateTime(): string {
    const now = new Date();

    const dateStr = now.toLocaleDateString("tr-TR", {
        timeZone: "Europe/Istanbul",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const timeStr = now.toLocaleTimeString("tr-TR", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
    });

    return `[SİSTEM BİLGİSİ — Güncel Tarih ve Saat]
Bugünün tarihi: ${dateStr}
Şu anki saat: ${timeStr} (Türkiye saati, UTC+3)
---\n`;
}

export async function POST(req: NextRequest) {
    try {
        const { messages, agentId } = await req.json();

        const agent = agents.find((a) => a.id === agentId);
        if (!agent) {
            return NextResponse.json({ error: "Agent bulunamadı" }, { status: 400 });
        }

        const systemPromptWithDate = getTurkishDateTime() + agent.systemPrompt;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPromptWithDate },
                ...messages,
            ],
            temperature: 0.7,
            max_tokens: 2048,
        });

        const reply = completion.choices[0].message.content;
        return NextResponse.json({ reply });
    } catch (error) {
        console.error("Groq API error:", error);
        return NextResponse.json(
            { error: "AI ile bağlantı kurulamadı. API key'inizi kontrol edin." },
            { status: 500 }
        );
    }
}
