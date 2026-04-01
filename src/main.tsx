import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";

// Global unhandled rejection handler
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({
    level: 'error',
    type: 'unhandled_rejection',
    message,
    timestamp: new Date().toISOString(),
    stack: error instanceof Error ? error.stack : undefined,
  }));
  // Show non-blocking toast for user awareness
  toast.error('Something went wrong', { description: message.slice(0, 100) });
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error(JSON.stringify({
    level: 'error',
    type: 'uncaught_error',
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    col: event.colno,
    timestamp: new Date().toISOString(),
  }));
});

createRoot(document.getElementById("root")!).render(<App />);
