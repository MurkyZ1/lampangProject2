export function Skeleton({ h = 16, w = '100%', r, className = '' }) {
  return <span className={`skeleton ${className}`} style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

export function SkeletonCards({ count = 3, h = 140 }) {
  return <div className="skeleton-grid" role="status" aria-label="กำลังโหลดข้อมูล">
    {Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i}>
      <Skeleton h={h} r={14} /><Skeleton h={14} w="70%" /><Skeleton h={12} w="45%" />
    </div>)}
  </div>;
}
