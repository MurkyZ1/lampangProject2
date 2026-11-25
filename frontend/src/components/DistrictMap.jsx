import { useMemo, useState } from 'react';
import { LAMPANG_MAP, ZONE_LABEL } from '../data/districts';
import {
  BOUNDARY_ATTRIBUTION, BOUNDARY_SOURCE,
  createBoundaryProjection, labelPosition, svgPathOfFeature,
} from '../services/lampangBoundaryService';

const labelFix = { '5201': [0, 10], '5203': [-4, 0], '5211': [6, 4], '5212': [-6, 0] };
const TAMBON_COLORS = ['#E6F2C8', '#BBEAD1', '#F6E8B4', '#BBDFF3', '#F0D6EE', '#FFE2CC', '#D2E5BD', '#B8D9D5', '#FADCC3', '#DCD2F6', '#E8F1B7', '#F4CFCF', '#D1E9F0'];
const districtName = value => String(value || '').replace(/^อำเภอ/, '').trim();
const tambonName = value => String(value || '').replace(/^ตำบล/, '').trim();
function sameTambon(geometry, row) {
  return geometry.code === row.id || (tambonName(geometry.name) === tambonName(row.tambon) && geometry.districtCode);
}

export default function DistrictMap({
  districts, selected, onSelect, tambons = [], selectedTambon,
  onChooseTambon, boundaryState,
}) {
  const [tip, setTip] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
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
  const isActive = f => {
    const row = importedRows.find(t => sameTambon(f, t));
    return selectedTambon === f.code || (row && selectedTambon === row.id);
  };
  const missingShapes = importedRows.filter(row => !row.village && !mapPieces.some(shape => sameTambon(shape, row)));
  const villages = importedRows.filter(row => row.village);
  const isZoomed = Boolean(selectedDistrict);
  const mapReady = isZoomed && mapPieces.length > 0;
  const choose = f => {
    const imported = importedRows.find(t => sameTambon(f, t));
    onChooseTambon(imported?.id || f.code);
    setTip(null);
  };
  return <div className={`map-card ${isZoomed ? 'map-card-zoom' : ''}`}>
    {isZoomed ? <>
      <button className="map-back" type="button" onClick={() => onSelect(null)}>← กลับแผนที่จังหวัด</button>
      <div className="map-hint">อ.{selectedDistrict.th} · แบ่งเขตตำบล</div>
    </> : <div className="map-hint">คลิกอำเภอเพื่อดูแผนที่ตำบล</div>}

    {mapReady ? <div className="geo-map-shell">
      <div className="geo-map-topline"><span className="geo-map-kicker">ขอบเขตตำบลจริง</span><strong>อำเภอ{selectedDistrict.th}</strong><small>{mapPieces.length} ตำบล</small></div>
      <svg className="map-svg geo-subdistricts" viewBox="0 0 560 790" role="group" aria-label={`แผนที่ตำบลในอำเภอ${selectedDistrict.th}`}>
        {mapPieces.map((f, index) => <path
          key={f.code}
          d={f.path}
          className={`geo-tambon ${isActive(f) ? 'active' : ''}`}
          fill={TAMBON_COLORS[index % TAMBON_COLORS.length]}
          fillRule="evenodd"
          role="button"
          tabIndex={0}
          aria-label={`ดูข้อมูลตำบล${f.name}`}
          aria-pressed={Boolean(isActive(f))}
          onClick={() => choose(f)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(f); } }}
          onPointerMove={e => setTip({ text: `ต.${f.name} · คลิกเพื่อดูรายละเอียด`, x: e.clientX + 14, y: e.clientY + 14 })}
          onPointerLeave={() => setTip(null)}
          onBlur={() => setTip(null)}
        />)}
        {showLabels && mapPieces.filter(f => f.label.area > 240).map(f => <text
          key={`label-${f.code}`}
          className="geo-tambon-label"
          x={f.label.x}
          y={f.label.y}
          style={{ fontSize: f.label.area < 1100 ? 10 : f.label.area < 2200 ? 12 : 14 }}
        >{f.name}</text>)}
      </svg>
      <div className="geo-map-controls"><label><input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} /> แสดงชื่อตำบล</label><span>สีใช้แยกขอบเขต ไม่ได้แสดงคุณภาพดิน</span></div>
    </div> : isZoomed ? <div className="geo-map-wait" role="status">
      <span className="geo-map-placeholder">◈</span>
      <h3>{boundaryState?.loading ? 'กำลังโหลดแผนที่ระดับตำบล…' : 'ยังแสดงเส้นแบ่งตำบลไม่ได้'}</h3>
      <p>{boundaryState?.loading ? 'กำลังอ่านเส้นขอบเขตจากชุดข้อมูล GeoThai' : boundaryState?.error || 'ไม่พบรูปทรงตำบลของอำเภอนี้ในแหล่งข้อมูล'}</p>
      <p className="subtle">สามารถเลือกข้อมูลตำบลจากรายการด้านล่างได้เมื่อมีไฟล์ข้อมูลนำเข้า</p>
    </div> : <svg className="map-svg province-map" viewBox={`0 0 ${LAMPANG_MAP.w} ${LAMPANG_MAP.h}`} role="group" aria-label="แผนที่จังหวัดลำปาง 13 อำเภอ">
      {districts.map(d => <path
        key={d.code}
        d={d.d}
        data-zone={d.zone || ''}
        role="button"
        tabIndex={0}
        aria-label={`เลือกอำเภอ${d.th}`}
        onClick={() => onSelect(d.code)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.code); } }}
        onPointerMove={e => setTip({ text: `${d.th} · ${ZONE_LABEL[d.zone] || 'ยังไม่มีข้อมูล'}`, x: e.clientX + 14, y: e.clientY + 14 })}
        onPointerLeave={() => setTip(null)}
        onBlur={() => setTip(null)}
      />)}
      {districts.map(d => {
        const [dx, dy] = labelFix[d.code] || [0, 0];
        return <text key={`label-${d.code}`} x={d.cx + dx} y={d.cy + dy + 5}>{d.th}</text>;
      })}
    </svg>}

    {!isZoomed && <div className="legend">
      <div><i style={{ background: 'var(--z-lowland)' }} />ที่ราบลุ่ม</div>
      <div><i style={{ background: 'var(--z-foothill)' }} />ที่ราบเชิงเขา</div>
      <div><i style={{ background: 'var(--z-highland)' }} />ที่สูง / ภูเขา</div>
    </div>}
    {isZoomed && <div className="map-tambon-picker">
      <div className="map-picker-head"><strong>เลือกตำบลเพื่อดูข้อมูลด้านขวา</strong><small>{mapPieces.length ? `${mapPieces.length} เขตตำบล` : `${importedRows.length} ระเบียนนำเข้า`}</small></div>
      {mapPieces.length ? <div className="map-tambon-list">
        {mapPieces.map(f => <button type="button" key={f.code} className={isActive(f) ? 'active' : ''} onClick={() => choose(f)}>ต.{f.name}</button>)}
        {missingShapes.map(t => <button type="button" key={`import-${t.id}`} className={selectedTambon === t.id ? 'active' : ''} onClick={() => onChooseTambon(t.id)}>ต.{t.tambon}{t.village ? ` · ${t.village}` : ''}</button>)}
      </div> : importedRows.length ? <div className="map-tambon-list">
        {importedRows.map(t => <button type="button" key={t.id} className={selectedTambon === t.id ? 'active' : ''} onClick={() => onChooseTambon(t.id)}>ต.{t.tambon}{t.village ? ` · ${t.village}` : ''}</button>)}
      </div> : <p className="subtle">ข้อมูลชื่อและรูปทรงตำบลอยู่ระหว่างโหลด ส่วนรายละเอียดดินต้องนำเข้าไฟล์ข้อมูลของคุณ</p>}
      {villages.length > 0 && mapPieces.length > 0 && <div className="geo-village-list">
        <strong>ข้อมูลหมู่บ้าน/ชุมชนจาก Data ที่นำเข้า</strong>
        <div className="map-tambon-list">{villages.map(t => <button type="button" key={`village-${t.id}`} className={selectedTambon === t.id ? 'active' : ''} onClick={() => onChooseTambon(t.id)}>ต.{t.tambon} · {t.village}</button>)}</div>
      </div>}
      {mapReady && <p className="geo-source">ที่มาขอบเขต: <a href={BOUNDARY_SOURCE} target="_blank" rel="noopener noreferrer">{BOUNDARY_ATTRIBUTION}</a> · ฉบับปี 2022/รหัสปี 2026</p>}
    </div>}
    {tip && <div className="tip-float active" style={{ left: tip.x, top: tip.y }} aria-hidden="true">{tip.text}</div>}
  </div>;
}
