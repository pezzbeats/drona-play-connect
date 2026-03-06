import { useConversation } from "@elevenlabs/react";
import { useCallback, useState } from "react";
import { Mic, MicOff, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const AGENT_ID = "agent_2101kk1n1zmfezxswwp4xxf5d0ew";

export function VoiceAgent() {
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => setIsConnecting(false),
    onDisconnect: () => setIsConnecting(false),
    onError: () => setIsConnecting(false),
  });

  const isConnected = conversation.status === "connected";

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
      });
    } catch {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return (
    <div className="fixed bottom-5 right-5 z-[99999] flex items-center gap-2">
      {/* Idle nudge label — inline to the left of the button, never above page buttons */}
      {!isConnected && !isConnecting && (
        <p className="text-sm font-display font-bold tracking-wide animate-fade-in pointer-events-none"
          style={{ color: 'hsl(var(--primary))', textShadow: '0 0 12px hsl(var(--primary) / 0.8), 0 0 24px hsl(var(--primary) / 0.5)' }}>
          Need Help? 🎙️
        </p>
      )}
      {/* Status label */}
      {isConnected && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 border border-border backdrop-blur-md text-xs font-body text-foreground/80 shadow-glass animate-fade-in">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              conversation.isSpeaking
                ? "bg-primary animate-pulse"
                : "bg-success"
            )}
          />
          {conversation.isSpeaking ? "Speaking…" : "Listening…"}
        </div>
      )}

      {/* Main button */}
      <button
        onClick={isConnected ? stopConversation : startConversation}
        disabled={isConnecting}
        aria-label={isConnected ? "End voice conversation" : "Start voice conversation"}
        className={cn(
          "relative flex items-center justify-center w-14 h-14 rounded-full shadow-glass transition-all duration-300 flex-shrink-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          isConnected
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse-glow"
            : "btn-gradient text-primary-foreground shadow-glow-primary hover:-translate-y-0.5 hover:shadow-[0_0_30px_hsl(355_80%_55%/0.6)]"
        )}
      >
        {isConnecting ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : isConnected ? (
          <X className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
