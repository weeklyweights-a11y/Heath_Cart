import { ReactNode } from "react";

interface ChatBubbleProps {
  role: "user" | "assistant";
  children: ReactNode;
  footer?: ReactNode;
}

export default function ChatBubble({ role, children, footer }: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser ? "bg-white text-text shadow-sm" : "bg-cream text-text"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{children}</p>
        {footer && <div className="mt-3 space-y-2">{footer}</div>}
      </div>
    </div>
  );
}
