import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { ChatCompletionTool, ChatCompletionContentPart } from "groq-sdk/resources/chat/completions";
import { tavily } from "@tavily/core";
import { agents } from "@/lib/agents";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY || "" });

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
    return `[SİSTEM BİLGİSİ — Güncel Tarih ve Saat]\nBugünün tarihi: ${dateStr}\nŞu anki saat: ${timeStr} (Türkiye saati, UTC+3)\n---\n`;
}

async function webSearch(query: string): Promise<string> {
    try {
        const result = await tavilyClient.search(query, {
            maxResults: 5,
            searchDepth: "advanced",
        });
        if (!result.results || result.results.length === 0) return "Arama sonucu bulunamadı.";
        return result.results
            .map((r, i) => `[${i + 1}] ${r.title}\nKaynak: ${r.url}\n${r.content}`)
            .join("\n\n---\n\n");
    } catch (err) {
        console.error("Tavily error:", err);
        return "Arama sırasında hata oluştu.";
    }
}

const tools: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "web_search",
            description:
                "Gerçek zamanlı web araması yap. Güncel teknoloji, bileşen fiyatları, Teknofest duyuruları veya bilgi kesim tarihinden sonraki konular için kullan.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Aranacak sorgu. Teknik konular için İngilizce daha iyi sonuç verir.",
                    },
                },
                required: ["query"],
            },
        },
    },
];

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, agentId, fileContent, fileType, fileDataUrl } = body;

        const agent = agents.find((a) => a.id === agentId);
        if (!agent) {
            return NextResponse.json({ error: "Agent bulunamadı" }, { status: 400 });
        }

        const systemContent =
            getTurkishDateTime() +
            agent.systemPrompt +
            `\n\nWEB ARAMA YETKİNLİĞİ: Güncel bilgiye ihtiyaç duyduğunda web_search aracını kullan.` +
            (fileContent
                ? `\n\nKULLANICI DOSYA İÇERİĞİ (${fileType?.toUpperCase()}):\n---\n${fileContent}\n---\nKullanıcı bu dosyanın içeriğini sana iletmiştir. Yanıtında bu içeriği analiz et ve değerlendir.`
                : "");

        // Görsel varsa vision modeli kullan
        const isVision = fileType === "image" && !!fileDataUrl;
        const model = isVision ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile";

        // Son kullanıcı mesajını bul, görselle zenginleştir
        let groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
            { role: "system", content: systemContent },
        ];

        if (isVision) {
            // Vision: metin + görsel içerikli mesaj oluştur
            const textMessages = messages.slice(0, -1);
            const lastMsg = messages[messages.length - 1];
            groqMessages = [
                { role: "system", content: systemContent },
                ...textMessages,
                {
                    role: "user",
                    content: [
                        { type: "text", text: lastMsg?.content || "Bu görseli analiz et." },
                        { type: "image_url", image_url: { url: fileDataUrl } },
                    ] as ChatCompletionContentPart[],
                },
            ];
        } else {
            groqMessages = [
                { role: "system", content: systemContent },
                ...messages,
            ];
        }

        let response = await groq.chat.completions.create({
            model,
            messages: groqMessages,
            ...(isVision ? {} : { tools, tool_choice: "auto" }),
            temperature: 0.7,
            max_tokens: 2048,
        });

        let assistantMessage = response.choices[0].message;

        // Tool calling döngüsü (sadece metin modeli için)
        if (!isVision) {
            const MAX_ITERATIONS = 3;
            let iteration = 0;
            while (
                assistantMessage.tool_calls &&
                assistantMessage.tool_calls.length > 0 &&
                iteration < MAX_ITERATIONS
            ) {
                iteration++;
                groqMessages.push(assistantMessage as Groq.Chat.ChatCompletionMessageParam);
                for (const toolCall of assistantMessage.tool_calls) {
                    if (toolCall.function.name === "web_search") {
                        const args = JSON.parse(toolCall.function.arguments);
                        const searchResult = await webSearch(args.query);
                        groqMessages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: searchResult,
                        });
                    }
                }
                response = await groq.chat.completions.create({
                    model,
                    messages: groqMessages,
                    tools,
                    tool_choice: "auto",
                    temperature: 0.7,
                    max_tokens: 2048,
                });
                assistantMessage = response.choices[0].message;
            }
        }

        const reply = assistantMessage.content || "Yanıt üretilemedi.";
        return NextResponse.json({ reply });
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json(
            { error: "AI ile bağlantı kurulamadı. API key'lerinizi kontrol edin." },
            { status: 500 }
        );
    }
}
