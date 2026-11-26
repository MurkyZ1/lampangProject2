import { useMemo, useState } from 'react';
import { ArrowLeft, Hand, Minus, MousePointerClick, Plus, RotateCcw, Tag } from 'lucide-react';
import { LAMPANG_MAP, ZONE_LABEL } from '../data/districts';
import {
  BOUNDARY_ATTRIBUTION, BOUNDARY_SOURCE,
  createBoundaryProjection, labelPosition, svgPathOfFeature,
} from '../services/lampangBoundaryService';
import useZoomPan from '../hooks/useZoomPan';

const labelFix = { '5201': [0, 10], '5203': [-4, 0], '5211': [6, 4], '5212': [-6, 0] };
const TAMBON_COLORS = ['#E6F2C8', '#BBEAD1', '#F6E8B4', '#BBDFF3', '#F0D6EE', '#FFE2CC', '#D2E5BD', '#B8D9D5', '#FADCC3', '#DCD2F6', '#E8F1B7', '#F4CFCF', '#D1E9F0'];
const districtName = value => String(value || '').replace(/^อำเภอ/, '').trim();
const tambonName = value => String(value || '').replace(/^ตำบล/, '').trim();
function sameTambon(geometry, row) {
  return geometry.code === row.id || (tambonName(geometry.name) === tambonName(row.tambon) && geometry.districtCode);
}
const tipPos = e => ({ x: Math.min(e.clientX + 16, window.innerWidth - 260), y: e.clientY + 18 });

function ZoomControls({ zp, label }) {
  return <div className="map-zoom" role="group" aria-label={`ควบคุมการซูม${label}`}>
    <button type="button" className="icon-btn" onClick={zp.zoomIn} disabled={!zp.canZoomIn} aria-label="ซูมเข้า" data-tip="ซูมเข้า"><Plus /></button>
    <button type="button" className="icon-btn" onClick={zp.zoomOut} disabled={!zp.canZoomOut} aria-label="ซูมออก" data-tip="ซูมออก"><Minus /></button>
    <button type="button" className="icon-btn" onClick={zp.reset} disabled={!zp.canZoomOut} aria-label="รีเซ็ตแผนที่" data-tip="รีเซ็ต"><RotateCcw /></button>
  </div>;
}

export default function DistrictMap({
  districts, selected, onSelect, tambons = [], selectedTambon,
  onChooseTambon, boundaryState,
}) {
  const [tip, setTip] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
  const [hovered, setHovered] = useState(null);
  const selectedDistrict = districts.find(d => d.code === selected);
  const selectedGeometries = useMemo(
    () => (boundaryState?.features || []).filter(f => f.districtCode === selected),
    [boundaryState?.features, selected],
  );
  const project = useMemo(() => createBoundaryProjection(selectedGeometries), [selectedGeometries]);
  const mapPieces = useMemo(() => selectedGeometries.map(f => ({
    ...f, path: svgPathOfFeature(f, project), label: labelPosition(f, project),
  })), [selectedGeometries, project]);
  const importedRows = tambons.filter(t => selectedDistrict && districtName(t.district) === districtName(selectedDistrict.th));
  const rowOf = f => importedRows.find(t => sameTambon(f, t));
  const isActive = f => {
    const row = rowOf(f);
    return selectedTambon === f.code || (row && selectedTambon === row.id);
  };
  const missingShapes = importedRows.filter(row => !row.village && !mapPieces.some(shape => sameTambon(shape, row)));
  const villages = importedRows.filter(row => row.village);
  const isZoomed = Boolean(selectedDistrict);
  const mapReady = isZoomed && mapPieces.length > 0;
  const activePiece = mapPieces.find(isActive);
  const choose = f => {
    const imported = rowOf(f);
    onChooseTambon(imported?.id || f.code);
    setTip(null);
  };

  const provinceZp = useZoomPan({ width: LAMPANG_MAP.w, height: LAMPANG_MAP.h, resetKey: 'province' });
  const tambonZp = useZoomPan({ width: 560, height: 790, resetKey: selected });

  const districtTip = (e, d) => setTip({
    ...tipPos(e), title: d.th, sub: ZONE_LABEL[d.zone] || 'ยังไม่มีข้อมูล',
    rows: [['pH', d.ph], ['พืชเด่น', (d.crops || []).slice(0, 3).join(' · ')]].filter(([, v]) => v),
    hint: 'คลิกเพื่อดูแผนที่ตำบล',
  });
  const tambonTip = (e, f) => {
    const row = rowOf(f);
    setTip({
      ...tipPos(e), title: `ต.${f.name}`, sub: `อ.${selectedDistrict?.th || ''}`,
      rows: row ? [['ดิน', row.soilType], ['pH', row.ph], ['พืช', (row.crops || []).slice(0, 3).join(' · ')]].filter(([, v]) => v) : [],
      hint: row ? 'คลิกเพื่อดูรายละเอียด' : 'ยังไม่มีข้อมูลดินของตำบลนี้',
    });
  };

  return <div className={`map-card ${isZoomed ? 'map-card-zoom' : ''}`}>
    <div className="map-toolbar">
      {isZoomed
        ? <button className="btn btn-ghost btn-sm map-back" type="button" onClick={() => onSelect(null)}><ArrowLeft aria-hidden="true" />กลับแผนที่จังหวัด</button>
        : <span className="map-hint"><MousePointerClick aria-hidden="true" />คลิกอำเภอเพื่อดูแผนที่ตำบล</span>}
      {isZoomed && <span className="map-hint map-hint--soft">อ.{selectedDistrict.th} · แบ่งเขตตำบล</span>}
    </div>

    {mapReady ? <div className="geo-map-shell fade-zoom-in" key={`tambon-${selected}`}>
      <div className="geo-map-topline"><span className="badge badge--green">ขอบเขตตำบลจริง</span><strong>อำเภอ{selectedDistrict.th}</strong><small>{mapPieces.length} ตำบล</small></div>
      <div className={`map-stage ${tambonZp.className}`}>
        <svg ref={tambonZp.svgRef} className="map-svg geo-subdistricts" viewBox="0 0 560 790" role="group" aria-label={`แผนที่ตำบลในอำเภอ${selectedDistrict.th}`} {...tambonZp.handlers}>
          <g className="zoom-layer" transform={tambonZp.transform} style={{ '--k': tambonZp.view.k }}>
            {mapPieces.map((f, index) => <path
              key={f.code}
              d={f.path}
              className={`geo-tambon ${isActive(f) ? 'active' : ''} ${hovered === f.code ? 'is-hover' : ''} ${rowOf(f) ? 'has-data' : ''}`}
              fill={TAMBON_COLORS[index % TAMBON_COLORS.length]}
              fillRule="evenodd"
              role="button"
              tabIndex={0}
              aria-label={`ดูข้อมูลตำบล${f.name}`}
              aria-pressed={Boolean(isActive(f))}
              onClick={() => choose(f)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(f); } }}
              onPointerMove={e => e.pointerType === 'mouse' && tambonTip(e, f)}
              onPointerLeave={() => setTip(null)}
              onFocus={e => { const r = e.currentTarget.getBoundingClientRect(); tambonTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, f); }}
              onBlur={() => setTip(null)}
            />)}
            {activePiece && <path className="geo-tambon-outline" d={activePiece.path} fillRule="evenodd" aria-hidden="true" />}
            {showLabels && mapPieces.filter(f => f.label.area > 240).map(f => <text
              key={`label-${f.code}`}
              className={`geo-tambon-label ${isActive(f) ? 'active' : ''}`}
              x={f.label.x}
              y={f.label.y}
              style={{ fontSize: (f.label.area < 1100 ? 10 : f.label.area < 2200 ? 12 : 14) / Math.sqrt(tambonZp.view.k) }}
            >{f.name}</text>)}
          </g>
        </svg>
        <ZoomControls zp={tambonZp} label="แผนที่ตำบล" />
        {tambonZp.hint && <div className="map-wheel-hint" role="status"><Hand aria-hidden="true" />กด Ctrl + เลื่อนล้อเมาส์เพื่อซูม</div>}
      </div>
      <div className="geo-map-controls">
        <label className="switch"><input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} /><span className="switch-track" aria-hidden="true" /><Tag aria-hidden="true" /> แสดงชื่อตำบล</label>
        <span>สีใช้แยกขอบเขต ไม่ได้แสดงคุณภาพดิน</span>
      </div>
    </div> : isZoomed ? <div className="geo-map-wait" role="status">
      {boundaryState?.loading ? <div className="map-skeleton" aria-hidden="true"><span /><span /><span /><span /></div> : <span className="geo-map-placeholder" aria-hidden="true"><RotateCcw /></span>}
      <h3>{boundaryState?.loading ? 'กำลังโหลดแผนที่ระดับตำบล…' : 'ยังแสดงเส้นแบ่งตำบลไม่ได้'}</h3>
      <p>{boundaryState?.loading ? 'กำลังอ่านเส้นขอบเขตจากชุดข้อมูล GeoThai' : boundaryState?.error || 'ไม่พบรูปทรงตำบลของอำเภอนี้ในแหล่งข้อมูล'}</p>
      <p className="subtle">สามารถเลือกข้อมูลตำบลจากรายการด้านล่างได้เมื่อมีไฟล์ข้อมูลนำเข้า</p>
    </div> : <div className={`map-stage map-stage--province fade-zoom-in ${provinceZp.className}`} key="province">
      <svg ref={provinceZp.svgRef} className="map-svg province-map" viewBox={`0 0 ${LAMPANG_MAP.w} ${LAMPANG_MAP.h}`} role="group" aria-label="แผนที่จังหวัดลำปาง 13 อำเภอ" {...provinceZp.handlers}>
        <defs>
          <filter id="district-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#1d3b26" floodOpacity=".22" /></filter>
        </defs>
        <g className="zoom-layer" transform={provinceZp.transform}>
          {districts.map(d => <path
            key={d.code}
            d={d.d}
            data-zone={d.zone || ''}
            className={hovered === d.code ? 'is-hover' : ''}
            role="button"
            tabIndex={0}
            aria-label={`เลือกอำเภอ${d.th}`}
            onClick={() => onSelect(d.code)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.code); } }}
            onPointerEnter={() => setHovered(d.code)}
            onPointerMove={e => e.pointerType === 'mouse' && districtTip(e, d)}
            onPointerLeave={() => { setHovered(null); setTip(null); }}
            onFocus={e => { setHovered(d.code); const r = e.currentTarget.getBoundingClientRect(); districtTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, d); }}
            onBlur={() => { setHovered(null); setTip(null); }}
          />)}
          {hovered && (() => { const d = districts.find(x => x.code === hovered); return d ? <path className="district-hover-outline" d={d.d} filter="url(#district-shadow)" aria-hidden="true" /> : null; })()}
          {districts.map(d => {
            const [dx, dy] = labelFix[d.code] || [0, 0];
            return <text key={`label-${d.code}`} className={`district-label ${hovered === d.code ? 'is-hover' : ''}`} x={d.cx + dx} y={d.cy + dy + 5} style={{ fontSize: 15 / Math.sqrt(provinceZp.view.k) }}>{d.th}</text>;
          })}
        </g>
      </svg>
      <ZoomControls zp={provinceZp} label="แผนที่จังหวัด" />
      {provinceZp.hint && <div className="map-wheel-hint" role="status"><Hand aria-hidden="true" />กด Ctrl + เลื่อนล้อเมาส์เพื่อซูม</div>}
    </div>}

    {!isZoomed && <div className="legend" aria-label="คำอธิบายสีของแผนที่">
      <span className="legend-title">สีตามลักษณะพื้นที่</span>
      <div><i style={{ background: 'var(--z-lowland)' }} />ที่ราบลุ่ม</div>
      <div><i style={{ background: 'var(--z-foothill)' }} />ที่ราบเชิงเขา</div>
      <div><i style={{ background: 'var(--z-highland)' }} />ที่สูง / ภูเขา</div>
    </div>}
    {isZoomed && <div className="map-tambon-picker">
      <div className="map-picker-head"><strong>เลือกตำบลเพื่อดูข้อมูลด้านขวา</strong><small>{mapPieces.length ? `${mapPieces.length} เขตตำบล` : `${importedRows.length} ระเบียนนำเข้า`}</small></div>
      {mapPieces.length ? <div className="map-tambon-list">
        {mapPieces.map(f => <button type="button" key={f.code} className={`chip-btn ${isActive(f) ? 'active' : ''}`} onClick={() => choose(f)} onPointerEnter={() => setHovered(f.code)} onPointerLeave={() => setHovered(null)}>ต.{f.name}</button>)}
        {missingShapes.map(t => <button type="button" key={`import-${t.id}`} className={`chip-btn ${selectedTambon === t.id ? 'active' : ''}`} onClick={() => onChooseTambon(t.id)}>ต.{t.tambon}{t.village ? ` · ${t.village}` : ''}</button>)}
      </div> : importedRows.length ? <div className="map-tambon-list">
        {importedRows.map(t => <button type="button" key={t.id} className={`chip-btn ${selectedTambon === t.id ? 'active' : ''}`} onClick={() => onChooseTambon(t.id)}>ต.{t.tambon}{t.village ? ` · ${t.village}` : ''}</button>)}
      </div> : <p className="subtle">ข้อมูลชื่อและรูปทรงตำบลอยู่ระหว่างโหลด ส่วนรายละเอียดดินต้องนำเข้าไฟล์ข้อมูลของคุณ</p>}
      {villages.length > 0 && mapPieces.length > 0 && <div className="geo-village-list">
        <strong>ข้อมูลหมู่บ้าน/ชุมชนจาก Data ที่นำเข้า</strong>
        <div className="map-tambon-list">{villages.map(t => <button type="button" key={`village-${t.id}`} className={`chip-btn ${selectedTambon === t.id ? 'active' : ''}`} onClick={() => onChooseTambon(t.id)}>ต.{t.tambon} · {t.village}</button>)}</div>
      </div>}
      {mapReady && <p className="geo-source">ที่มาขอบเขต: <a href={BOUNDARY_SOURCE} target="_blank" rel="noopener noreferrer">{BOUNDARY_ATTRIBUTION}</a> · ฉบับปี 2022/รหัสปี 2026</p>}
    </div>}
    {tip && <div className="map-tooltip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
      <strong>{tip.title}</strong>{tip.sub && <span className="map-tooltip-sub">{tip.sub}</span>}
      {tip.rows?.length > 0 && <dl>{tip.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {tip.hint && <small>{tip.hint}</small>}
    </div>}
  </div>;
}
