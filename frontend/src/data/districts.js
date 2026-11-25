import { LAMPANG_MAP } from './districtShapes';
import { SAMPLE_DISTRICT_DATA, ZONE_LABEL } from './sampleDistrictData';

// staticShape และ sampleData ถูกแยกไว้เพื่อเปลี่ยนข้อมูล backend ได้ในอนาคต
export const DISTRICT_SHAPES = [...LAMPANG_MAP.districts].sort((a, b) => a.code.localeCompare(b.code));
export const DEMO_DISTRICTS = DISTRICT_SHAPES.map((shape) => ({
  ...shape,
  ...SAMPLE_DISTRICT_DATA[shape.code],
}));
export { LAMPANG_MAP, ZONE_LABEL };
