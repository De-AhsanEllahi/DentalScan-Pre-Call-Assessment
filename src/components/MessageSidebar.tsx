"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, AlertCircle } from "lucide-react";
import { Sender, Message, MessageSidebarProps } from "@/constants/messaging";

export default function MessageSidebar({ threadId: initialThreadId, patientId }: MessageSidebarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [threadId, setThreadId] = useState(initialThreadId);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Shared fetch helper — used on open and after auto-reply
    const fetchMessages = (tid: string) =>
        fetch(`/api/messaging?threadId=${tid}`)
            .then((r) => {
                if (!r.ok) throw new Error(`Failed to load messages (${r.status})`);
                return r.json();
            })
            .then((data) => setMessages(data.messages ?? []))
            .catch((err) => console.error("MessageSidebar: load error", err));

    useEffect(() => {
        if (!isOpen || !threadId) return;
        fetchMessages(threadId);
    }, [isOpen, threadId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isSending) return;

        setSendError(null);

        const tempId = `temp_${Date.now()}`;
        const optimistic: Message = {
            id: tempId,
            content: text,
            sender: Sender.patient,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
        setInput("");
        setIsSending(true);

        try {
            const res = await fetch("/api/messaging", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    threadId,
                    patientId,
                    content: text,
                    sender: Sender.patient,
                }),
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const data = await res.json();

            const resolvedThreadId = data.threadId as string;
            const isNewThread = !threadId && !!resolvedThreadId;

            if (isNewThread) {
                setThreadId(resolvedThreadId);
            }

            setMessages((prev) =>
                prev.map((m) => (m.id === tempId ? (data.message as Message) : m))
            );

            // On first message, refetch after 2.5s so the auto-reply appears automatically
            if (isNewThread) {
                setTimeout(() => fetchMessages(resolvedThreadId), 2500);
            }
        } catch (err) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            setInput(text);
            setSendError("Failed to send. Please try again.");
            console.error("MessageSidebar: send error", err);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 text-white rounded-full p-4 shadow-xl z-50 transition-all
                       bg-[#61a5fa] hover:bg-[#3b8ef8]"
                    title="Message your clinic"
                    aria-label="Open messaging sidebar"
                >
                    <MessageCircle size={22} />
                </button>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            <div
                className={`
          fixed top-0 right-0 h-full w-80 bg-zinc-900 text-white
          shadow-2xl z-40 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
                role="dialog"
                aria-label="Clinic messaging sidebar"
                aria-modal="true"
            >
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between shrink-0 bg-[#61a5fa]">
                    <div>
                        <h2 className="font-bold text-sm">Message Your Clinic</h2>
                        <p className="text-[11px] text-blue-100">We typically reply within 1 hour</p>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="hover:bg-[#3b8ef8] rounded p-1 transition"
                        aria-label="Close sidebar"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 && (
                        <p className="text-center text-zinc-500 text-xs mt-10">
                            No messages yet. Ask your clinic anything!
                        </p>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`
                flex flex-col max-w-[80%] text-sm
                ${msg.sender === "patient" ? "ml-auto items-end" : "mr-auto items-start"}
              `}
                        >
                            <div
                                className={`
                  px-3 py-2 rounded-2xl leading-snug
                  ${msg.sender === "patient"
                                        ? "bg-[#61a5fa] text-white rounded-br-sm"
                                        : "bg-zinc-700 text-zinc-100 rounded-bl-sm"
                                    }
                  ${msg.id.startsWith("temp_") ? "opacity-50" : "opacity-100"}
                `}
                            >
                                {msg.content}
                            </div>
                            <span className="text-[10px] text-zinc-500 mt-1">
                                {msg.sender === "patient" ? "You" : "Clinic"} ·{" "}
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Inline send error */}
                {sendError && (
                    <div className="px-3 pb-1 flex items-center gap-2 text-red-400 text-xs">
                        <AlertCircle size={12} />
                        <span>{sendError}</span>
                    </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-zinc-700 flex gap-2 shrink-0">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            if (sendError) setSendError(null); // clear error on new input
                        }}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 bg-zinc-800 border border-zinc-600 rounded-full
               px-4 py-2 text-sm outline-none
               focus:ring-2 focus:ring-[#61a5fa] placeholder:text-zinc-500"
                        aria-label="Message input"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isSending || !input.trim()}
                        className="bg-[#61a5fa] hover:bg-[#3b8ef8] disabled:opacity-40
               disabled:cursor-not-allowed rounded-full p-2 transition"
                        aria-label="Send message"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </>
    );
}