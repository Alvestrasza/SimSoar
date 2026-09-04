"use client";

import type {ReactNode} from "react";
import {useEffect, useRef} from "react";

type ClosableNavigationMenuProps = {
  children: ReactNode;
  className: string;
  panelClassName: string;
  summary: ReactNode;
  summaryAriaLabel?: string;
  summaryTitle?: string;
};

export default function ClosableNavigationMenu({
  children,
  className,
  panelClassName,
  summary,
  summaryAriaLabel,
  summaryTitle
}: ClosableNavigationMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeMenu(event: PointerEvent) {
      const details = detailsRef.current;

      if (details?.open && !details.contains(event.target as Node)) {
        details.open = false;
      }
    }

    function closeMenuWithKeyboard(event: KeyboardEvent) {
      const details = detailsRef.current;

      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenuWithKeyboard);

    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenuWithKeyboard);
    };
  }, []);

  function closeAfterSelection(event: React.MouseEvent<HTMLDivElement>) {
    const selectedControl = (event.target as Element).closest("a, button");

    if (selectedControl) {
      detailsRef.current?.removeAttribute("open");
    }
  }

  return (
    <details className={className} ref={detailsRef}>
      <summary aria-label={summaryAriaLabel} title={summaryTitle}>
        {summary}
      </summary>
      <div className={panelClassName} onClick={closeAfterSelection}>
        {children}
      </div>
    </details>
  );
}
