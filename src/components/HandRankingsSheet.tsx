"use client";

import { useEffect, useId, useRef, useState } from "react";

export const HAND_RANKINGS = [
  {
    name: "Royal flush",
    example: "A♠ K♠ Q♠ J♠ 10♠ — ace-high straight flush",
  },
  {
    name: "Straight flush",
    example: "9♥ 8♥ 7♥ 6♥ 5♥ — five suited in sequence",
  },
  {
    name: "Four of a kind",
    example: "A♦ A♠ A♥ A♣ 9♠ — four of the same rank",
  },
  {
    name: "Full house",
    example: "K♠ K♥ K♦ 7♣ 7♠ — three of a kind plus a pair",
  },
  {
    name: "Flush",
    example: "A♣ J♣ 8♣ 4♣ 2♣ — five of one suit",
  },
  {
    name: "Straight",
    example: "10♠ 9♥ 8♦ 7♣ 6♠ — five in sequence, mixed suits",
  },
  {
    name: "Three of a kind",
    example: "Q♠ Q♥ Q♦ 8♣ 3♠ — three of the same rank",
  },
  {
    name: "Two pair",
    example: "J♠ J♥ 5♦ 5♣ 9♠ — two different pairs",
  },
  {
    name: "One pair",
    example: "10♠ 10♥ K♦ 7♣ 2♠ — two of the same rank",
  },
  {
    name: "High card",
    example: "A♠ K♦ 9♣ 7♥ 4♠ — nothing else; highest card plays",
  },
] as const;

export function HandRankingsButton() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="info-btn"
        aria-label="Hand rankings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="info-btn-glyph" aria-hidden="true">
          i
        </span>
      </button>

      {open ? (
        <div className="rank-sheet" role="presentation">
          <button
            type="button"
            className="rank-sheet-scrim"
            aria-label="Close hand rankings"
            onClick={() => setOpen(false)}
          />
          <div
            className="rank-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="rank-sheet-head">
              <div>
                <p className="rank-sheet-kicker">Hold&apos;em</p>
                <h2 id={titleId} className="rank-sheet-title">
                  Hand rankings
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="rank-sheet-close"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="rank-sheet-lede">Best to worst. Quick refresher.</p>
            <ol className="rank-list">
              {HAND_RANKINGS.map((hand, index) => (
                <li key={hand.name} className="rank-item">
                  <span className="rank-num">{index + 1}</span>
                  <span className="rank-body">
                    <span className="rank-name">{hand.name}</span>
                    <span className="rank-example">{hand.example}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </>
  );
}
