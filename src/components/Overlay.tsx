import React from "react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface OverlayProps {
  className?: string;
  onClick?: () => void;
}

export function Overlay({ className, onClick }: OverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed inset-0 bg-text-subtle/60 backdrop-blur-sm z-[40]",
        className
      )}
      onClick={onClick}
    />
  );
}
