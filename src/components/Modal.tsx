import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

type ModalVariant = "centered" | "drawer" | "fullscreen";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: ModalVariant;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showCloseButton?: boolean;
  closeButtonClassName?: string;
  backdropClassName?: string;
  style?: React.CSSProperties;
}

const CloseButton = ({ onClose, className }: { onClose: () => void; className?: string }) => (
  <button
    onClick={onClose}
    className={cn(
      "p-3 glass rounded-full text-text-muted hover:text-text transition-colors",
      className
    )}
    aria-label="Close"
  >
    <X size={24} />
  </button>
);

export function Modal({
  isOpen,
  onClose,
  variant = "centered",
  title,
  children,
  className,
  contentClassName,
  showCloseButton = true,
  closeButtonClassName,
  backdropClassName,
  style,
}: ModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen && variant !== "drawer") {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";

      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen, variant]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const backdropContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed inset-0 bg-text-subtle/60 backdrop-blur-sm z-[100]",
        backdropClassName
      )}
      onClick={onClose}
    />
  );

  if (variant === "drawer") {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {backdropContent}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={style}
              className={cn(
                "fixed right-0 top-0 bottom-0 w-full max-w-[90vw] sm:max-w-sm md:max-w-md glass border-l border-text-subtle/10 z-[101] flex flex-col shadow-2xl",
                className
              )}
            >
              {(title || showCloseButton) && (
                <div className="p-4 sm:p-6 border-b border-text-subtle/10 flex items-center justify-between shrink-0">
                  {title && <div className="flex-1 min-w-0 pr-4">{title}</div>}
                  {showCloseButton && <CloseButton onClose={onClose} className={closeButtonClassName} />}
                </div>
              )}
              <div className={cn("flex-1 overflow-y-auto", contentClassName)}>
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  if (variant === "fullscreen") {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[100] bg-text-subtle/60 backdrop-blur-sm p-3 sm:p-4 flex flex-col items-center justify-center",
              className
            )}
          >
            <div
              className={cn(
                "w-full max-w-[calc(100vw-1.5rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full max-h-[92vh] sm:max-h-[90vh] glass p-4 sm:p-5 rounded-2xl sm:rounded-[2.5rem] neo-shadow relative",
                contentClassName
              )}
            >
              {(title || showCloseButton) && (
                <div className="flex justify-between items-center mb-4 sm:mb-6 shrink-0">
                  {title && <div className="flex-1 min-w-0">{title}</div>}
                  {showCloseButton && <CloseButton onClose={onClose} className={closeButtonClassName} />}
                </div>
              )}
              <div className="flex-1 overflow-y-auto pr-2 sm:pr-4 custom-scrollbar">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // centered variant (default)
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {backdropContent}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4",
              className
            )}
          >
            <div
              className={cn(
                "glass border border-text-subtle/10 rounded-2xl p-6 max-w-md w-full pointer-events-auto shadow-2xl max-h-[70vh] overflow-y-auto",
                contentClassName
              )}
            >
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between mb-4">
                  {title && <div className="flex-1 pr-4">{title}</div>}
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className={cn(
                        "text-text-subtle/40 hover:text-text transition-colors shrink-0",
                        closeButtonClassName
                      )}
                      aria-label="Close"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ConfirmModalProps extends Omit<ModalProps, "children" | "variant"> {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirmVariant?: "danger" | "solid" | "accent";
}

export function ConfirmModal({
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  confirmVariant = "danger",
  ...modalProps
}: ConfirmModalProps) {
  const confirmStyles = {
    danger: "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20",
    solid: "bg-accent text-bg hover:bg-accent/90",
    accent: "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20",
  };

  return (
    <Modal variant="centered" {...modalProps}>
      <div className="mb-4">
        <p className="text-sm text-text-muted">{message}</p>
      </div>
      <div className="flex gap-3">
        <button
          className="py-1.5 px-4 rounded-xl bg-text-subtle/10 text-text hover:bg-text-subtle/20 border border-text-subtle/10 transition-all duration-200 active:scale-95 text-sm whitespace-nowrap"
          onClick={modalProps.onClose}
        >
          {cancelLabel}
        </button>
        <button
          className={cn(
            "flex-1 py-1.5 px-4 rounded-xl font-medium transition-all duration-200 active:scale-95 text-sm whitespace-nowrap",
            confirmStyles[confirmVariant]
          )}
          onClick={() => {
            onConfirm();
            modalProps.onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" fill="currentColor">
    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const handleLogin = async () => {
    try {
      const { signInWithPopup } = await import("firebase/auth");
      const { auth, provider } = await import("../lib/firebase");
      await signInWithPopup(auth, provider);
      onClose();
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="centered"
      title={<h3 className="text-lg font-bold text-text">Sign in to Save</h3>}
    >
      <div className="mb-6">
        <p className="text-sm text-text-muted">
          To save your workout sessions and sync across devices, please sign in with your Google account.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <button
          className="w-full py-3 px-4 bg-accent text-bg font-bold rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all duration-200"
          onClick={handleLogin}
        >
          <GoogleIcon />
          Sign in with Google
        </button>
        <button
          className="w-full py-3 px-4 rounded-xl bg-text-subtle/10 text-text hover:bg-text-subtle/20 border border-text-subtle/10 transition-all duration-200 active:scale-95"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
