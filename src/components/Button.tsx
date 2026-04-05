import React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "accent"
    | "solid"
    | "white"
    | "upload";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
};

export const CloseButton = ({ onClose }: { onClose: () => void }) => (
  <button
    onClick={onClose}
    className="p-3 glass rounded-full text-text-muted hover:text-text"
    aria-label="Close"
  >
    <X size={24} />
  </button>
);

export const Button = ({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) => {
  const variants = {
    primary: "bg-text-subtle/20 text-text hover:bg-text-subtle/30 border border-text-subtle/20",
    secondary:
      "bg-text-subtle/10 text-text-muted hover:text-text hover:bg-text-subtle/20 border border-text-subtle/10",
    ghost: "text-text-subtle hover:text-text hover:bg-text-subtle/10",
    accent:
      "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20",
    solid: "bg-accent text-bg hover:bg-accent/90 border-none",
    white: "bg-text text-bg hover:bg-text/90 border-none",
    danger:
      "bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 border border-rose-400/20",
    upload:
      "bg-accent text-bg hover:bg-accent/90 border-none shadow-lg shadow-accent/20",
  };

  const sizes = {
    xs: "px-2 py-1 text-[10px] uppercase tracking-wider font-medium",
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-8 py-5 text-lg font-black tracking-[0.2em]",
    icon: "p-2",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};
