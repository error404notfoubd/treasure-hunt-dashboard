export function SkeletonLine({ className = "" }) {
  return (
    <div className={`h-3 rounded-md bg-surface-3 animate-pulse ${className}`} />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="card px-5 py-4">
      <div className="h-2.5 w-20 rounded bg-surface-3 animate-pulse" />
      <div className="h-7 w-16 rounded bg-surface-3 animate-pulse mt-2" />
      <div className="h-2 w-14 rounded bg-surface-3 animate-pulse mt-2" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-3 rounded-md bg-surface-3 animate-pulse"
            style={{ width: `${50 + Math.random() * 40}%`, animationDelay: `${i * 75}ms` }}
          />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTableRows({ rows = 8, cols = 6 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <SkeletonTableRow key={i} cols={cols} />
  ));
}

export function SkeletonRoleCard() {
  return (
    <div className="card p-5">
      <div className="h-7 w-7 rounded bg-surface-3 animate-pulse mb-2" />
      <div className="h-3.5 w-16 rounded bg-surface-3 animate-pulse" />
      <div className="h-2.5 w-full rounded bg-surface-3 animate-pulse mt-2" />
      <div className="h-2.5 w-3/4 rounded bg-surface-3 animate-pulse mt-1.5" />
      <div className="h-2.5 w-10 rounded bg-surface-3 animate-pulse mt-3" />
      <div className="space-y-1.5 mt-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-2.5 w-24 rounded bg-surface-3 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonAuditEntry() {
  return (
    <div className="flex gap-3 items-start py-3 border-b border-surface-3/40 last:border-b-0">
      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-surface-3 animate-pulse" />
      <div className="min-w-0 flex-1">
        <div className="h-3.5 w-3/4 rounded bg-surface-3 animate-pulse" />
        <div className="h-2.5 w-1/3 rounded bg-surface-3 animate-pulse mt-1.5" />
      </div>
    </div>
  );
}
