import { useEffect, useState } from 'react';
import DistrictMap from './DistrictMap';
import DistrictInfo from './DistrictInfo';
import useLampangBoundaries from '../hooks/useLampangBoundaries';

export default function MapSection({ districts, selected, onSelect, onAsk, tambons, reports, onCrop, onNavigate }) {
  const [selectedTambon, setSelectedTambon] = useState(null);
  const boundaryState = useLampangBoundaries();
  useEffect(() => { setSelectedTambon(null); }, [selected]);
  const selectedBoundary = boundaryState.features.find(f =>
    f.districtCode === selected && (f.code === selectedTambon ||
      tambons.some(t => t.id === selectedTambon && (t.id === f.code || t.tambon.replace(/^ตำบล/, '') === f.name)))
  ) || null;
  return <section className="sec sec--map" id="map"><div className="wrap">
    <div className="sec-head" data-reveal>
      <span className="kicker">สำรวจจากแผนที่</span>
      <h2>แผนที่อำเภอและตำบลของลำปาง</h2>
      <p className="subtle">คลิกอำเภอเพื่อดูเส้นแบ่งตำบลจริง เลือกพื้นที่สีบนแผนที่เพื่อดูรายละเอียดทางขวา และกดชื่อพืชเพื่อเปิดคู่มือปลูก</p>
    </div>
    <div className="map-grid" data-reveal>
      <DistrictMap districts={districts} selected={selected} onSelect={onSelect} tambons={tambons} selectedTambon={selectedTambon} onChooseTambon={setSelectedTambon} boundaryState={boundaryState} />
      <DistrictInfo districts={districts} selected={selected} onSelect={onSelect} onAsk={onAsk} tambons={tambons} reports={reports} selectedTambon={selectedTambon} selectedBoundary={selectedBoundary} onChooseTambon={setSelectedTambon} onCrop={onCrop} onNavigate={onNavigate} />
    </div>
  </div></section>;
}
