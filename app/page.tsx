"use client";

import { useState, useRef, useEffect } from "react";
import { agents, Agent } from "@/lib/agents";
import { exportToPDF, exportToWord } from "@/lib/exporter";
import styles from "./page.module.css";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatHistory = {
  [agentId: string]: Message[];
};

type UploadedFile = {
  name: string;
  type: "pdf" | "word" | "image";
  content?: string;   // PDF / Word metin
  dataUrl?: string;   // Görsel base64
  pages?: number;
};

const STORAGE_KEY = "teknofest_chat_history";

export default function Home() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [chatHistory, setChatHistory] = useState<ChatHistory>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = chatHistory[selectedAgent.id] || [];

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory)); } catch { /* ignore */ }
  }, [chatHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleAgentSelect = (agent: Agent) => {
    setSelectedAgent(agent);
    setInput("");
    setUploadedFile(null);
  };

  // ── Dosya Yükleme ─────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setUploadedFile({
        name: data.name,
        type: data.type,
        content: data.content,
        dataUrl: data.dataUrl,
        pages: data.pages,
      });
    } catch { alert("Dosya yüklenemedi."); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Mesaj Gönder ──────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const displayContent = uploadedFile
      ? `${text}\n\n📎 Dosya: ${uploadedFile.name}`
      : text;

    const newMessages: Message[] = [...messages, { role: "user", content: displayContent }];
    setChatHistory((prev) => ({ ...prev, [selectedAgent.id]: newMessages }));
    setInput("");
    const sentFile = uploadedFile;
    setUploadedFile(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          agentId: selectedAgent.id,
          fileContent: sentFile?.content ?? null,
          fileType: sentFile?.type ?? null,
          fileDataUrl: sentFile?.dataUrl ?? null,
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "Bir hata oluştu.";
      setChatHistory((prev) => ({
        ...prev,
        [selectedAgent.id]: [...newMessages, { role: "assistant", content: reply }],
      }));
    } catch {
      setChatHistory((prev) => ({
        ...prev,
        [selectedAgent.id]: [...newMessages, { role: "assistant", content: "Bağlantı hatası oluştu." }],
      }));
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClear = () => {
    setChatHistory((prev) => {
      const updated = { ...prev, [selectedAgent.id]: [] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    setUploadedFile(null);
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  };

  // ── Export ────────────────────────────────────────────
  const handleExportPDF = () => exportToPDF(messages, selectedAgent.name);
  const handleExportWord = () => exportToWord(messages, selectedAgent.name);

  const fileIcon = (type: UploadedFile["type"]) =>
    type === "pdf" ? "📄" : type === "word" ? "📝" : "🖼️";

  return (
    <div className={styles.container}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>🚀</span>
          <div>
            <div className={styles.logoTitle}>Teknofest</div>
            <div className={styles.logoSub}>Rapor Asistanı</div>
          </div>
        </div>

        <div className={styles.agentLabel}>Uzman Seç</div>

        <nav className={styles.agentList}>
          {agents.map((agent) => (
            <button
              key={agent.id}
              className={`${styles.agentItem} ${selectedAgent.id === agent.id ? styles.agentItemActive : ""}`}
              onClick={() => handleAgentSelect(agent)}
            >
              <span className={styles.agentIcon}>{agent.icon}</span>
              <div className={styles.agentInfo}>
                <div className={styles.agentName}>{agent.name}</div>
                <div className={styles.agentSection}>
                  {agent.section}
                  {agent.points && <span className={styles.agentPoints}>{agent.points} pt</span>}
                </div>
              </div>
              {chatHistory[agent.id]?.length > 0 && <span className={styles.agentDot} />}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.modelBadge}>LLaMA 3.3 70B · Groq</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <span className={styles.chatHeaderIcon}>{selectedAgent.icon}</span>
            <div>
              <div className={styles.chatHeaderName}>{selectedAgent.name}</div>
              <div className={styles.chatHeaderSection}>
                {selectedAgent.section}
                {selectedAgent.points && ` — ${selectedAgent.points} Puan`}
              </div>
            </div>
          </div>

          {messages.length > 0 && (
            <div className={styles.headerActions}>
              <button className={styles.exportBtn} onClick={handleExportPDF} title="PDF olarak indir">
                ⬇ PDF
              </button>
              <button className={styles.exportBtn} onClick={handleExportWord} title="Word olarak indir">
                ⬇ Word
              </button>
              <button className={styles.clearBtn} onClick={handleClear}>Temizle</button>
            </div>
          )}
        </header>

        {/* Messages */}
        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>{selectedAgent.icon}</div>
              <div className={styles.emptyTitle}>{selectedAgent.name} Uzmanı</div>
              <div className={styles.emptyDesc}>{selectedAgent.description}</div>
              <div className={styles.emptyHint}>
                Proje bilgilerini yaz veya 📎 ile dosya/görsel ekle.
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${msg.role === "user" ? styles.messageUser : styles.messageAssistant}`}
            >
              {msg.role === "assistant" && (
                <div className={styles.messageAvatar}>{selectedAgent.icon}</div>
              )}
              <div className={styles.messageBubble}>
                <pre className={styles.messageText}>{msg.content}</pre>
              </div>
              {msg.role === "user" && (
                <div className={styles.messageAvatarUser}>Sen</div>
              )}
            </div>
          ))}

          {loading && (
            <div className={`${styles.message} ${styles.messageAssistant}`}>
              <div className={styles.messageAvatar}>{selectedAgent.icon}</div>
              <div className={styles.messageBubble}>
                <div className={styles.typing}><span /><span /><span /></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Yüklenen Dosya Badge */}
        {uploadedFile && (
          <div className={styles.fileBadge}>
            <span className={styles.fileBadgeIcon}>{fileIcon(uploadedFile.type)}</span>
            <span className={styles.fileBadgeName}>{uploadedFile.name}</span>
            {uploadedFile.pages && (
              <span className={styles.fileBadgeMeta}>{uploadedFile.pages} sayfa</span>
            )}
            {uploadedFile.type === "image" && uploadedFile.dataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={uploadedFile.dataUrl} alt="Önizleme" className={styles.filePreviewThumb} />
            )}
            <button className={styles.fileBadgeRemove} onClick={() => setUploadedFile(null)}>✕</button>
          </div>
        )}

        {/* Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            {/* Dosya yükleme butonu */}
            <button
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="PDF, Word veya görsel yükle"
            >
              {uploading ? "⏳" : "📎"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <textarea
              ref={textareaRef}
              className={styles.input}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder={`${selectedAgent.name} uzmanına yaz…`}
              rows={1}
              disabled={loading}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!input.trim() || loading}
            >
              ↑
            </button>
          </div>
          <div className={styles.inputHint}>
            Enter ile gönder · Shift+Enter yeni satır · 📎 PDF / Word / Görsel ekle
          </div>
        </div>
      </main>
    </div>
  );
}
