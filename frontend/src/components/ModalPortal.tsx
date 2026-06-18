import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface ModalPortalProps {
  children: ReactNode;
  /** When false, renders nothing. Omit to always render (caller gates with conditional). */
  isOpen?: boolean;
  onBackdropClick?: () => void;
  zIndexClass?: string;
  backdropClassName?: string;
  contentClassName?: string;
}

const DEFAULT_BACKDROP = "bg-slate-900/50 backdrop-blur-sm";

/**
 * Full-screen modal shell portaled to document.body.
 * Compensates for app-wide body zoom (0.8) via min-h-[125vh] on the backdrop.
 */
export function ModalPortal({
  children,
  isOpen = true,
  onBackdropClick,
  zIndexClass = "z-[200]",
  backdropClassName = DEFAULT_BACKDROP,
  contentClassName = "p-4",
}: ModalPortalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center ${contentClassName}`}
      role="presentation"
    >
      <div
        className={`absolute inset-0 min-h-[125vh] w-full ${backdropClassName}`}
        aria-hidden
        onClick={onBackdropClick}
      />
      <div className="relative z-10 flex max-h-[100vh] w-full flex-col items-center justify-center overflow-y-auto">
        {children}
      </div>
    </div>,
    document.body,
  );
}
