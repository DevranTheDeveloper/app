"use client";

import { useState, useRef, useEffect } from "react";
import { agents, Agent } from "@/lib/agents";
import styles from "./page.module.css";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatHistory = {
  [agentId: string]: Message[];
};

const STORAGE_KEY = "teknofest_chat_history";

export default function Home() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [chatHistory, setChatHistory] = useState<ChatHistory>(() => {
    // Sayfa açılışında localStorage'dan yükle
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = chatHistory[selectedAgent.id] || [];

  // Sohbet değişince localStorage'a kaydet
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    } catch {
      // localStorage dolu olabilir — sessizce geç
    }
  }, [chatHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleAgentSelect = (agent: Agent) => {
    setSelectedAgent(agent);
    setInput("");
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setChatHistory((prev) => ({ ...prev, [selectedAgent.id]: newMessages }));
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, agentId: selectedAgent.id }),
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
        [selectedAgent.id]: [
          ...newMessages,
          { role: "assistant", content: "Bağlantı hatası oluştu." },
        ],
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setChatHistory((prev) => {
      const updated = { ...prev, [selectedAgent.id]: [] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  };

  return (
    <div className={styles.container}>
      {/* Sidebar */}
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
              className={`${styles.agentItem} ${selectedAgent.id === agent.id ? styles.agentItemActive : ""
                }`}
              onClick={() => handleAgentSelect(agent)}
            >
              <span className={styles.agentIcon}>{agent.icon}</span>
              <div className={styles.agentInfo}>
                <div className={styles.agentName}>{agent.name}</div>
                <div className={styles.agentSection}>
                  {agent.section}
                  {agent.points && (
                    <span className={styles.agentPoints}>{agent.points} pt</span>
                  )}
                </div>
              </div>
              {chatHistory[agent.id]?.length > 0 && (
                <span className={styles.agentDot} />
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.modelBadge}>LLaMA 3.3 70B · Groq</div>
        </div>
      </aside>

      {/* Main */}
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
            <button className={styles.clearBtn} onClick={handleClear}>
              Temizle
            </button>
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
                Proje bilgilerini paylaş, ben de bu bölümü yazayım.
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${msg.role === "user" ? styles.messageUser : styles.messageAssistant
                }`}
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
                <div className={styles.typing}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.input}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
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
          <div className={styles.inputHint}>Enter ile gönder · Shift+Enter yeni satır</div>
        </div>
      </main>
    </div>
  );
}
