interface ListeningWaveProps {
  className?: string;
}

const BARS = [
  {
    x: 2,
    heights: "5;13;8;16;5",
    positions: "9.5;5.5;8;4;9.5",
    duration: "0.72s",
  },
  {
    x: 7,
    heights: "8;18;6;12;8",
    positions: "8;3;9;6;8",
    duration: "0.86s",
  },
  {
    x: 12,
    heights: "6;12;17;7;6",
    positions: "9;6;3.5;8.5;9",
    duration: "0.78s",
  },
  {
    x: 17,
    heights: "9;15;6;13;9",
    positions: "7.5;4.5;9;5.5;7.5",
    duration: "0.68s",
  },
];

export default function ListeningWave({
  className = "size-5",
}: ListeningWaveProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {BARS.map((bar, index) => (
        <rect key={bar.x} height="6" rx="1.5" width="3" x={bar.x} y="9">
          <animate
            attributeName="height"
            begin={`${index * 0.08}s`}
            dur={bar.duration}
            repeatCount="indefinite"
            values={bar.heights}
          />
          <animate
            attributeName="y"
            begin={`${index * 0.08}s`}
            dur={bar.duration}
            repeatCount="indefinite"
            values={bar.positions}
          />
        </rect>
      ))}
    </svg>
  );
}
