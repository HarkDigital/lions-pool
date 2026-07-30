"use client";

// Long-form Commissioner copy: the first N words show, the rest folds behind
// a Read more / Show less toggle. Mother Superior types long messages.

import { useState } from "react";

export function ExpandableText({ text, words = 100 }: { text: string; words?: number }) {
  const [open, setOpen] = useState(false);
  const all = text.trim().split(/\s+/);
  const needsFold = all.length > words;
  const shown = open || !needsFold ? text : all.slice(0, words).join(" ") + "…";

  return (
    <div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-silver">{shown}</p>
      {needsFold && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-2 text-sm font-bold text-sky underline-offset-2 transition hover:underline"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
