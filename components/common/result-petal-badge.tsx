"use client";

import { useId } from "react";

const RESULT_PETAL_PATH =
  "M24 1C26.65 1 29.25 3.66 31.96 4.78C34.67 5.91 38.39 5.86 40.26 7.74C42.14 9.61 42.09 13.33 43.22 16.04C44.34 18.75 47 21.35 47 24C47 26.65 44.34 29.25 43.22 31.96C42.09 34.67 42.14 38.39 40.26 40.26C38.39 42.14 34.67 42.09 31.96 43.22C29.25 44.34 26.65 47 24 47C21.35 47 18.75 44.34 16.04 43.22C13.33 42.09 9.61 42.14 7.74 40.26C5.86 38.39 5.91 34.67 4.78 31.96C3.66 29.25 1 26.65 1 24C1 21.35 3.66 18.75 4.78 16.04C5.91 13.33 5.86 9.61 7.74 7.74C9.61 5.86 13.33 5.91 16.04 4.78C18.75 3.66 21.35 1 24 1Z";

export default function ResultPetalBadge({
  correct,
  className = "",
}: {
  correct: boolean;
  className?: string;
}) {
  const badgeId = useId().replace(/:/g, "");
  const fillId = `result-petal-fill-${badgeId}`;
  const borderId = `result-petal-border-${badgeId}`;
  const palette = correct
    ? { from: "#4bab90", to: "#25775f" }
    : { from: "#dc8493", to: "#aa475e" };

  return (
    <span
      aria-hidden="true"
      className={`result-petal-badge ${correct ? "is-correct" : "is-wrong"} ${className}`.trim()}
    >
      <svg
        className="result-petal-badge-mark"
        focusable="false"
        viewBox="0 0 48 48"
      >
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={fillId}
            x1="8"
            x2="40"
            y1="6"
            y2="42"
          >
            <stop offset="0" stopColor={palette.from} />
            <stop offset="1" stopColor={palette.to} />
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={borderId}
            x1="10"
            x2="38"
            y1="6"
            y2="42"
          >
            <stop offset="0" stopColor="#fff" stopOpacity="0.72" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.38" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path
          d={RESULT_PETAL_PATH}
          strokeLinejoin="round"
          strokeWidth="0.85"
          style={{ fill: `url(#${fillId})`, stroke: `url(#${borderId})` }}
        />
        <g
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
          transform="translate(12 12)"
        >
          {correct ? (
            <path
              className="result-petal-badge-glyph"
              d="M5 12.5L9.5 17L19 7.5"
            />
          ) : (
            <>
              <path
                className="result-petal-badge-glyph"
                d="M7.5 7.5L16.5 16.5"
              />
              <path
                className="result-petal-badge-glyph result-petal-badge-cross-2"
                d="M16.5 7.5L7.5 16.5"
              />
            </>
          )}
        </g>
      </svg>
    </span>
  );
}
