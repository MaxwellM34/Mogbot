import { useRef, useState, useCallback, useEffect, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";

interface BrowserViewProps {
  frame: string | null;
  streaming: boolean;
  interactive: boolean;
  onClose: () => void;
  onBrowserClick: (x: number, y: number) => void;
  onBrowserType: (text: string) => void;
  onBrowserKey: (key: string) => void;
}

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 900;

export default function BrowserView({
  frame,
  streaming,
  interactive,
  onClose,
  onBrowserClick,
  onBrowserType,
  onBrowserKey,
}: BrowserViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typingText, setTypingText] = useState("");

  const handleImageClick = useCallback(
    (e: MouseEvent<HTMLImageElement>) => {
      if (!interactive) return;
      const img = imgRef.current;
      if (!img) return;

      const rect = img.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * VIEWPORT_WIDTH);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * VIEWPORT_HEIGHT);

      onBrowserClick(x, y);
    },
    [interactive, onBrowserClick]
  );

  const handleTypingSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!typingText.trim()) return;
      onBrowserType(typingText);
      setTypingText("");
    },
    [typingText, onBrowserType]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        onBrowserKey("Tab");
      } else if (e.key === "Escape") {
        e.preventDefault();
        onBrowserKey("Escape");
      }
    },
    [onBrowserKey]
  );

  useEffect(() => {
    if (interactive) {
      inputRef.current?.focus();
    }
  }, [interactive]);

  if (!streaming || !frame) return null;

  // Interactive mode: full-screen modal for CAPTCHA/login/2fa
  if (interactive) {
    return (
      <div className="browser-view-overlay">
        <div className="browser-view-modal">
          <div className="browser-view-header">
            <div className="browser-view-title">
              <span className="browser-view-live-dot" />
              Browser View — Click to interact
            </div>
            <button className="browser-view-done-btn" onClick={onClose}>
              Done
            </button>
          </div>

          <div className="browser-view-content">
            <img
              ref={imgRef}
              className="browser-view-screenshot"
              src={`data:image/jpeg;base64,${frame}`}
              alt="Live browser view"
              onClick={handleImageClick}
              draggable={false}
            />
          </div>

          <div className="browser-view-controls">
            <form className="browser-view-type-form" onSubmit={handleTypingSubmit}>
              <input
                ref={inputRef}
                type="text"
                className="browser-view-type-input"
                placeholder="Type text and press Enter to send to browser..."
                value={typingText}
                onChange={(e) => setTypingText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="submit"
                className="browser-view-send-btn"
                disabled={!typingText.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Passive mode: inline panel showing what the browser is doing
  return (
    <div className="browser-view-panel">
      <div className="browser-view-panel-header">
        <span className="browser-view-live-dot" />
        <span>Browser</span>
      </div>
      <img
        className="browser-view-panel-screenshot"
        src={`data:image/jpeg;base64,${frame}`}
        alt="Browser view"
        draggable={false}
      />
    </div>
  );
}
