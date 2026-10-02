interface MoveReport {
  ply: number;
  move: string;
  mover: string;
  classification: string;
}

interface TurningPoint {
  ply: number;
  move: string;
  classification: string;
  explanation: string;
}

export interface MatchReport {
  moves: MoveReport[];
  eval_graph: number[];
  white_accuracy: number;
  black_accuracy: number;
  white_performance: number;
  black_performance: number;
  turning_points: TurningPoint[];
}

const CLASSIFICATION_COLOR: Record<string, string> = {
  Brilliant: "#7FA592",
  Best: "#7FA592",
  Good: "#E8E2D3",
  Inaccuracy: "#B08D57",
  Mistake: "#B08D57",
  Blunder: "#C1544A",
};

function EvalGraph({ evals }: { evals: number[] }) {
  const width = 240;
  const height = 56;
  const clamp = (cp: number) => Math.max(-600, Math.min(600, cp));
  const denom = Math.max(evals.length - 1, 1);
  const points = evals
    .map((cp, i) => {
      const x = (i / denom) * width;
      const y = height / 2 - (clamp(cp) / 600) * (height / 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height}>
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#B08D57" strokeOpacity="0.3" />
      <polyline points={points} fill="none" stroke="#7FA592" strokeWidth="2" />
    </svg>
  );
}

export default function MatchReportView({ report }: { report: MatchReport }) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-lg text-verdigris">Match Report</h2>
        <EvalGraph evals={report.eval_graph} />
      </div>

      <div className="flex justify-between text-sm">
        <div>
          <p className="text-brass/70">White</p>
          <p>{report.white_accuracy}% accuracy</p>
          <p className="text-parchment/60">~{report.white_performance} performance</p>
        </div>
        <div className="text-right">
          <p className="text-brass/70">Black</p>
          <p>{report.black_accuracy}% accuracy</p>
          <p className="text-parchment/60">~{report.black_performance} performance</p>
        </div>
      </div>

      {report.turning_points.length > 0 && (
        <div>
          <h3 className="font-display text-base text-verdigris">Turning points</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {report.turning_points.map((tp) => (
              <li key={tp.ply}>
                <span style={{ color: CLASSIFICATION_COLOR[tp.classification] }}>
                  {tp.classification}
                </span>{" "}
                <span className="text-parchment/70">(move {tp.ply})</span>
                <p className="text-parchment/80">{tp.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="font-display text-base text-verdigris">Moves</h3>
        <ol className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm tabular-nums">
          {report.moves.map((m) => (
            <li key={m.ply} className="flex justify-between gap-2">
              <span className="text-brass/50">{m.ply}.</span>
              <span className="flex-1">{m.move}</span>
              <span style={{ color: CLASSIFICATION_COLOR[m.classification] }}>{m.classification}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
