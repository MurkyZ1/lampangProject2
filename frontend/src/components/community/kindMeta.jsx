import { Bug, Droplets, MessageSquare, Sprout, Sun, Wheat } from 'lucide-react';

// ไอคอนและโทนสีของประเภทรายงาน (ชื่อประเภทเดิมจาก backend ไม่เปลี่ยน)
export const KIND_META = {
  'อัปเดตการปลูก': { icon: Sprout, tone: 'green' },
  'ดินแห้ง': { icon: Sun, tone: 'soil' },
  'น้ำไม่เพียงพอ': { icon: Droplets, tone: 'water' },
  'พบโรคหรือแมลง': { icon: Bug, tone: 'danger' },
  'เริ่มเก็บเกี่ยว': { icon: Wheat, tone: 'sun' },
  'ข้อเสนอแนะ': { icon: MessageSquare, tone: 'ink' },
};
export const kindMeta = kind => KIND_META[kind] || { icon: MessageSquare, tone: 'ink' };

export function KindChip({ kind }) {
  const { icon: Icon, tone } = kindMeta(kind);
  return <span className={`kind-chip kind-chip--${tone}`}><Icon aria-hidden="true" />{kind}</span>;
}
