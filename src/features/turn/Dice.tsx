export function Dice({
  values,
  rolling = false,
}: {
  values: [number, number] | null;
  rolling?: boolean;
}) {
  const dots: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return (
    <div
      className={`dice-pair ${rolling ? 'rolling' : ''}`}
      data-rolling={rolling}
      aria-label={
        rolling
          ? 'Кубики вращаются'
          : values
            ? `Кубики: ${values.join(' и ')}`
            : 'Кубики ещё не брошены'
      }
    >
      {(values ?? [1, 1]).map((value, i) => (
        <div className="die" data-value={value} key={i}>
          {Array.from({ length: 9 }, (_, j) => (
            <i key={j} className={dots[value]?.includes(j) ? 'pip' : ''} />
          ))}
        </div>
      ))}
    </div>
  );
}
