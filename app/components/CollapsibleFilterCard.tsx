"use client";

import type {ReactNode} from "react";
import {useState} from "react";

type CollapsibleFilterCardProps = {
  children: ReactNode;
  collapseLabel: string;
  expandLabel: string;
  initiallyOpen: boolean;
  resultLabel: string;
  title: string;
};

export default function CollapsibleFilterCard({
  children,
  collapseLabel,
  expandLabel,
  initiallyOpen,
  resultLabel,
  title
}: CollapsibleFilterCardProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const panelId = "advanced-flight-search";

  return (
    <section className="card flightFilterCard">
      <div className="cardHead flightFilterHead">
        <div>
          <span className="cardTitle">{title}</span>
          <span className="muted flightFilterResult">{resultLabel}</span>
        </div>
        <button
          aria-controls={panelId}
          aria-expanded={isOpen}
          className="btn btnSecondary flightFilterToggle"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
          {isOpen ? collapseLabel : expandLabel}
        </button>
      </div>
      <div hidden={!isOpen} id={panelId}>
        {children}
      </div>
    </section>
  );
}
