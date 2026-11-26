// กราฟแบบเบา ๆ ด้วย CSS/SVG ไม่ใช้ไลบรารีเพิ่ม (ค่าตัวเลขและสูตรเดิมทั้งหมด)
import { useState } from 'react';

export const fmt = (n) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });

export function Kpi({ label, value, hint, icon: Icon, tone = 'green' }) {
  return <div className={`kpi kpi--${tone}`}>
    <div className="kpi-top"><span>{label}</span>{Icon && <i className="kpi-icon" aria-hidden="true"><Icon /></i>}</div>
    <strong>{value}</strong>
    {hint && <small>{hint}</small>}
  </div>;
}

export function Histogram({ bins, xTitle, yTitle = 'จำนวนแปลงดิน', unit = 'แปลง' }) {
  const max = Math.max(...bins.map((b) => b.count), 1);
  const total = bins.reduce((s, b) => s + b.count, 0) || 1;
  const [hover, setHover] = useState(null);
  return (
    <figure className="hist-wrap">
      <div className="hist-y">{yTitle}</div>
      <div className={`hist ${hover !== null ? 'has-hover' : ''}`} role="img" aria-label="กราฟแท่งการกระจายค่า">
        {bins.map((b, i) => (
          <div className={`hist-col ${hover === i ? 'is-hover' : ''}`} key={b.label} style={{ '--i': i }} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="hist-num">{fmt(b.count)}<small>{(b.count / total * 100).toFixed(0)}%</small></span>
            <div className="hist-bar" style={{ height: `${Math.max(2, (b.count / max) * 100)}%` }} />
            <span className="hist-lab">{b.label}</span>
            {hover === i && <span className="chart-tip" role="tooltip"><b>{b.label}</b>{fmt(b.count)} {unit}<br />{b.areaPct}% ของพื้นที่</span>}
          </div>
        ))}
      </div>
      {xTitle && <figcaption className="hist-x">{xTitle}</figcaption>}
    </figure>
  );
}

export function BarList({ rows, valueKey = 'pct', labelKey = 'label', suffix = '%', muted = () => false, max, display }) {
  const top = max ?? Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <div className="bar-chart">
      {rows.map((r, i) => (
        <div className={`bar-row${muted(r) ? ' is-muted' : ''}`} key={r[labelKey]} style={{ '--i': i }}>
          <span className="bar-name" title={r[labelKey]}>{r[labelKey]}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r[valueKey] / top) * 100}%` }} /></div>
          <span className="bar-number">{display?.(r) ?? `${r[valueKey].toLocaleString('th-TH', { maximumFractionDigits: 1 })}${suffix}`}</span>
        </div>
      ))}
    </div>
  );
}

// ช่องสี: ค่าสูง = เขียวเข้ม (ลำดับสีเดียว) ; diverging = แดง/เขียวสำหรับ correlation
export function Heatmap({ rows, cols, matrix, diverging = false, decimals = 2, onCell }) {
  const [hover, setHover] = useState(null);
  const color = (v) => {
    if (diverging) {
      const a = Math.min(1, Math.abs(v));
      return v >= 0 ? `rgba(46,125,50,${a * 0.85})` : `rgba(198,40,40,${a * 0.85})`;
    }
    return `rgba(46,125,50,${Math.min(1, v) * 0.9})`;
  };
  return (
    <div className="table-scroll">
      <table className="heat" onPointerLeave={() => setHover(null)}>
        <thead><tr><th />{cols.map((c, j) => <th key={c} className={hover?.[1] === j ? 'is-hover' : ''}><span>{c}</span></th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r} className={hover?.[0] === i ? 'is-hover' : ''}>
              <th>{r}</th>
              {matrix[i].map((v, j) => (
                <td key={j} style={{ background: color(v), color: Math.abs(v) > 0.55 ? '#fff' : 'inherit', '--i': i + j }} className={hover && (hover[0] === i || hover[1] === j) ? (hover[0] === i && hover[1] === j ? 'is-cell' : 'is-line') : ''} onPointerEnter={() => setHover([i, j])} onClick={onCell ? () => onCell(i, j) : undefined} title={`${r} × ${cols[j]}: ${v}`}>
                  {v.toFixed(decimals)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
