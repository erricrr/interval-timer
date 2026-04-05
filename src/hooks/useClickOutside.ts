import { useEffect, useRef, type RefObject } from "react";

export function useClickOutside(
  isOpen: boolean,
  onClose: () => void,
  excludeRefs: RefObject<HTMLElement | null>[],
) {
  const refsRef = useRef(excludeRefs);
  refsRef.current = excludeRefs;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent | MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const isInsideExcluded = refsRef.current.some(
        (ref) => ref.current && ref.current.contains(target),
      );
      if (!isInsideExcluded) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, onClose]);
}
