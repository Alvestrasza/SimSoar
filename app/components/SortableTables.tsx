"use client";

import {useEffect} from "react";

type SortDirection = "ascending" | "descending";

function numericValue(text: string): number | null {
  const normalized = text
    .replace(/[▲▼#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(
    /^([-+]?\d+(?:[.,]\d+)?)\s*(?:km|m|m\/s|km\/h|h|olc|punkte|points|flüge|flights)?$/i
  );

  return match ? Number(match[1].replace(",", ".")) : null;
}

function dateValue(text: string, locale: string): number | null {
  const match = text.trim().match(
    /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  const month = locale === "de" ? second : first;
  const day = locale === "de" ? first : second;
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const secondValue = Number(match[6] ?? 0);
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, secondValue);
  const parsed = new Date(timestamp);

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? timestamp
    : null;
}

function comparableValue(cell: HTMLTableCellElement, locale: string) {
  const explicitValue = cell.dataset.sortValue;
  const text = (explicitValue ?? cell.innerText).replace(/\s+/g, " ").trim();
  const number = numericValue(text);

  if (number !== null) return {kind: "number" as const, value: number};

  const date = dateValue(text, locale);
  if (date !== null) return {kind: "number" as const, value: date};

  return {kind: "text" as const, value: text};
}

function sortTable(header: HTMLTableCellElement) {
  const table = header.closest("table");
  const headerRow = header.parentElement;
  const body = table?.tBodies.item(0);

  if (!table || !headerRow || !body) return;

  const columnIndex = Array.from(headerRow.children).indexOf(header);
  if (columnIndex < 0) return;

  const rows = Array.from(body.rows).filter(
    (row) => row.cells.length > 1 && !row.cells[0]?.hasAttribute("colspan")
  );
  if (rows.length < 2) return;

  const direction: SortDirection =
    header.getAttribute("aria-sort") === "ascending"
      ? "descending"
      : "ascending";
  const multiplier = direction === "ascending" ? 1 : -1;
  const locale = document.documentElement.lang === "de" ? "de" : "en";

  rows.sort((leftRow, rightRow) => {
    const leftCell = leftRow.cells.item(columnIndex);
    const rightCell = rightRow.cells.item(columnIndex);
    if (!leftCell || !rightCell) return 0;

    const left = comparableValue(leftCell, locale);
    const right = comparableValue(rightCell, locale);

    if (left.kind === "number" && right.kind === "number") {
      return multiplier * (left.value - right.value);
    }

    return multiplier * String(left.value).localeCompare(String(right.value), locale, {
      numeric: true,
      sensitivity: "base"
    });
  });

  table.querySelectorAll<HTMLTableCellElement>("thead th[aria-sort]").forEach((cell) => {
    cell.setAttribute("aria-sort", cell === header ? direction : "none");
  });
  body.append(...rows);
}

function enhanceTable(table: HTMLTableElement) {
  table.querySelectorAll<HTMLTableCellElement>("thead th").forEach((header) => {
    if (!header.textContent?.trim() || header.dataset.sortable === "false") return;

    header.classList.add("sortableColumn");
    header.tabIndex = 0;
    if (!header.hasAttribute("aria-sort")) header.setAttribute("aria-sort", "none");
  });
}

export default function SortableTables() {
  useEffect(() => {
    const content = document.getElementById("main-content");
    if (!content) return;

    content.querySelectorAll<HTMLTableElement>("table").forEach(enhanceTable);

    function selectHeader(target: EventTarget | null) {
      return target instanceof Element
        ? target.closest<HTMLTableCellElement>("thead th.sortableColumn")
        : null;
    }

    function handleClick(event: MouseEvent) {
      const header = selectHeader(event.target);
      if (!header) return;

      event.preventDefault();
      sortTable(header);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;

      const header = selectHeader(event.target);
      if (!header) return;

      event.preventDefault();
      sortTable(header);
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node instanceof HTMLTableElement) enhanceTable(node);
          node.querySelectorAll<HTMLTableElement>("table").forEach(enhanceTable);
        });
      });
    });

    content.addEventListener("click", handleClick);
    content.addEventListener("keydown", handleKeyDown);
    observer.observe(content, {childList: true, subtree: true});

    return () => {
      content.removeEventListener("click", handleClick);
      content.removeEventListener("keydown", handleKeyDown);
      observer.disconnect();
    };
  }, []);

  return null;
}
