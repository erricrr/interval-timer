import { useEffect } from "react";
import { audioEngine } from "../lib/audio";

/** Resume Web Audio after mobile backgrounding / tab switch */
export function useAudioLifecycle() {
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible") {
        void audioEngine.resumeAudioContext();
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, []);
}
