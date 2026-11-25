/**
 * Boundary geometry from GeoThai/boundaries (OCHA COD-AB / Royal Thai Survey Department).
 * Licensed CC BY 3.0 IGO. Names / codes by GeoThai/data (CC BY 4.0).
 * Source snapshot: v2026.10.23. These are administrative boundaries, NOT soil classes.
 * Copy a downloaded 52.topojson to public/data/lampang-subdistricts.topojson
 * if this site needs to work without connecting to external CDNs.
 */
export const BOUNDARY_ATTRIBUTION = 'GeoThai, from OCHA COD-AB and the Royal Thai Survey Department (boundaries); GeoThai/data (names and codes)';
export const BOUNDARY_SOURCE = 'https://github.com/GeoThai/boundaries/tree/v2026.10.23';
const BASENAME = 'datawrapper/subdistricts/52.topojson';
export const BOUNDARY_URLS = [
  '/data/lampang-subdistricts.topojson',
  `https://cdn.jsdelivr.net/gh/GeoThai/boundaries@v2026.10.23/${BASENAME}`,
  `https://raw.githubusercontent.com/GeoThai/boundaries/v2026.10.23/${BASENAME}`,
];

// The parser below deliberately handles TopoJSON directly. It needs no new npm dependency.
function decodeTopology(topology) {
  if (!topology || topology.type !== 'Topology' || !Array.isArray(topology.arcs)) {
    throw new Error('ไม่ใช่ไฟล์ TopoJSON ที่รองรับ');
  }
  const transform = topology.transform;
  const cache = new Map();
  function arcAt(index) {
    const reversed = index < 0;
    const id = reversed ? ~index : index;
    if (!cache.has(id)) {
      const arc = topology.arcs[id];
      if (!Array.isArray(arc)) throw new Error('ข้อมูลเส้นขอบเขตไม่สมบูรณ์');
      let x = 0, y = 0;
      cache.set(id, arc.map(([a, b]) => {
        if (transform) {
          x += a;
          y += b;
          return [x * transform.scale[0] + transform.translate[0], y * transform.scale[1] + transform.translate[1]];
        }
        return [a, b];
      }));
    }
    const points = cache.get(id);
    return reversed ? [...points].reverse() : points;
  }
  function ringOf(arcIds) {
    const points = [];
    for (const arcId of arcIds) {
      const arc = arcAt(arcId);
      // Arc endpoints are duplicated when adjacent arcs share an endpoint.
      points.push(...(points.length ? arc.slice(1) : arc));
    }
    return points;
  }
  function polygonsOf(geom) {
    if (geom.type === 'Polygon') return [geom.arcs.map(ringOf)];
    if (geom.type === 'MultiPolygon') return geom.arcs.map(p => p.map(ringOf));
    return [];
  }
  const collections = Object.values(topology.objects || {});
  const geometries = collections.flatMap(object => {
    if (object.type === 'GeometryCollection') return object.geometries || [];
    return object.arcs ? [object] : [];
  });
  return geometries.map(g => ({
    properties: { ...(g.properties || {}), ...(g.id != null ? { id: g.id } : {}) },
    polygons: polygonsOf(g),
  }));
}

const asCode = value => value == null ? '' : String(value).trim();
function mapFeature(f) {
  const p = f.properties;
  const code = asCode(p.code || p.tambon_code || p.subdistrict_code || p.adm3_pcode || p.id).replace(/^TH/, '');
  const districtCode = asCode(p.district_code || p.amphoe_code || p.adm2_code || (code.length >= 4 ? code.slice(0, 4) : '')).replace(/^TH/, '');
  const provinceCode = asCode(p.province_code || (districtCode.length >= 2 ? districtCode.slice(0, 2) : '')).replace(/^TH/, '');
  const name = String(p.name_th || p.tambon_th || p.name || p.NAME_THAI || '').replace(/^ตำบล/, '').trim();
  return { code, districtCode, provinceCode, name: name || (code ? `รหัส ${code}` : 'ไม่ระบุชื่อ'), polygons: f.polygons };
}

/** Convert the GeoThai Lampang TopoJSON into geographical subdistrict shapes. */
export function parseLampangTopology(topology) {
  const decoded = decodeTopology(topology).map(mapFeature);
  const selected = decoded.filter(f =>
    (f.provinceCode === '52' || f.districtCode.startsWith('52')) &&
    /^52\d{4}$/.test(f.code) && /^52\d{2}$/.test(f.districtCode) && f.polygons.length
  );
  if (!selected.length) throw new Error('ไฟล์แผนที่ไม่มีขอบเขตตำบลของจังหวัดลำปาง');
  return selected.sort((a, b) => a.code.localeCompare(b.code));
}

export async function fetchLampangBoundaries() {
  const failures = [];
  for (const url of BOUNDARY_URLS) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json, text/plain' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return { features: parseLampangTopology(payload), url };
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }
  throw new Error('โหลดขอบเขตตำบลไม่ได้ กรุณาเชื่อมต่ออินเทอร์เน็ต หรือวางไฟล์ 52.topojson ไว้ที่ frontend/public/data/lampang-subdistricts.topojson');
}

function eachPoint(features, visit) {
  for (const feature of features) {
    for (const polygon of feature.polygons) {
      for (const ring of polygon) for (const point of ring) visit(point);
    }
  }
}
export function createBoundaryProjection(features, width = 560, height = 790, padding = 42) {
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  // Equirectangular correction avoids making northern Thailand look too wide.
  const cosine = Math.cos(18.5 * Math.PI / 180);
  eachPoint(features, ([lon, lat]) => {
    const x = lon * cosine;
    xmin = Math.min(xmin, x); xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, lat); ymax = Math.max(ymax, lat);
  });
  if (!Number.isFinite(xmin)) return () => [width / 2, height / 2];
  const scale = Math.min((width - 2 * padding) / Math.max(xmax - xmin, 0.000001), (height - 2 * padding) / Math.max(ymax - ymin, 0.000001));
  const left = (width - (xmax - xmin) * scale) / 2;
  const top = (height - (ymax - ymin) * scale) / 2;
  return ([lon, lat]) => [left + (lon * cosine - xmin) * scale, top + (ymax - lat) * scale];
}
export function svgPathOfFeature(feature, project) {
  return feature.polygons.map(poly => poly.map(ring => ring.length < 3 ? '' :
    ring.map((coord, i) => {
      const [x, y] = project(coord);
      return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join('') + 'Z'
  ).join('')).join('');
}
function areaAndCentroid(ring, project) {
  const points = ring.map(project);
  let twiceArea = 0, centroidX = 0, centroidY = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i]; const [nx, ny] = points[(i + 1) % points.length];
    const cross = x * ny - nx * y;
    twiceArea += cross; centroidX += (x + nx) * cross; centroidY += (y + ny) * cross;
  }
  if (Math.abs(twiceArea) < 0.01) return { x: points[0]?.[0] ?? 0, y: points[0]?.[1] ?? 0, area: 0 };
  return { x: centroidX / (3 * twiceArea), y: centroidY / (3 * twiceArea), area: Math.abs(twiceArea) / 2 };
}
export function labelPosition(feature, project) {
  const rings = feature.polygons.map(poly => poly[0]).filter(ring => ring && ring.length >= 3);
  if (!rings.length) return { x: 0, y: 0, area: 0 };
  return rings.map(r => areaAndCentroid(r, project)).sort((a, b) => b.area - a.area)[0];
}
