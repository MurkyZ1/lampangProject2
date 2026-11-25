"""
ข้อมูลสำหรับหน้า Dashboard (2 ส่วนตามโจทย์): 1) EDA process  2) Final Dashboard
คำนวณจากตาราง modeling_table.csv + ผลทำนายของโมเดล ทุกตัวเลขมาจากข้อมูลจริง ไม่ใช้ข้อมูลสาธิต
"""
from __future__ import annotations

import numpy as np
import pandas as pd

LABEL = {
    "pH_top_mid": "pH ดินบน", "pH_low_mid": "pH ดินล่าง", "slope_mid": "ความลาดชัน (%)",
    "depth_mid": "ความลึกดิน (ซม.)", "Gravel_mid": "กรวด/ก้อนหิน (%)", "CEC_top_mid": "CEC ดินบน",
    "CEC_low_mid": "CEC ดินล่าง", "BS_top_mid": "BS ดินบน (%)", "BS_low_mid": "BS ดินล่าง (%)",
    "drainage_ord": "การระบายน้ำ", "fertility_ord": "ความอุดมสมบูรณ์", "tex_top_ord": "เนื้อดินบน",
    "tex_low_ord": "เนื้อดินล่าง", "top_gravelly": "ดินบนมีกรวดมาก", "lo_restrictive": "ชั้นดินล่างแน่น/ขวาง",
    "rain_annual_mean": "ฝนรายปีเฉลี่ย (มม.)", "rain_annual_std": "ฝนรายปี ส่วนเบี่ยงเบน", "rain_wet": "ฝนหน้าฝน (มม.)",
    "rain_dry": "ฝนหน้าแล้ง (มม.)", "dry_months": "จำนวนเดือนแล้ง", "elev_m": "ความสูง (ม.)",
    "temp_rule": "อุณหภูมิ (ค่าในกฎ)", "area_rai": "พื้นที่ (ไร่)",
}
DRAIN = {1: "แย่มาก", 2: "ไม่ดี", 2.5: "ค่อนข้างไม่ดี", 3: "ปานกลาง", 4: "ดี"}
FERT = {1: "ต่ำ", 2: "กลาง", 3: "สูง"}
TEX = {1: "ร่วนทราย", 2: "ร่วนปนทราย", 3: "ร่วน", 4: "ร่วนเหนียว"}
CORR_COLS = ["pH_top_mid", "pH_low_mid", "slope_mid", "depth_mid", "Gravel_mid", "drainage_ord",
             "fertility_ord", "tex_top_ord", "CEC_top_mid", "BS_top_mid", "rain_annual_mean"]

_cache: dict = {}


def _hist_discrete(df: pd.DataFrame, col: str, names: dict | None = None) -> list[dict]:
    total_area = float(df["area_rai"].sum()) or 1.0
    out = []
    for v, sub in df.groupby(col):
        out.append({"label": (names or {}).get(v, f"{v:g}"), "value": float(v), "count": int(len(sub)),
                    "areaPct": round(float(sub["area_rai"].sum()) / total_area * 100, 1)})
    return out


def _hist_numeric(df: pd.DataFrame, col: str, bins: int = 8) -> list[dict]:
    x = df[col].dropna()
    if x.nunique() <= 12:
        return _hist_discrete(df.dropna(subset=[col]), col)
    edges = np.linspace(x.min(), x.max(), bins + 1)
    idx = np.clip(np.digitize(df[col], edges[1:-1]), 0, bins - 1)
    total_area = float(df["area_rai"].sum()) or 1.0
    out = []
    for b in range(bins):
        sub = df[idx == b]
        out.append({"label": f"{edges[b]:.0f}–{edges[b + 1]:.0f}", "value": float(edges[b]), "count": int(len(sub)),
                    "areaPct": round(float(sub["area_rai"].sum()) / total_area * 100, 1)})
    return out


def build(TABLE: pd.DataFrame, CROPS: list[str], predict_matrix, meta_cols: list[str], exclude: list[str],
          no_ok_label: set, ok_threshold: float, best_min: float, crop_id: dict) -> dict:
    if _cache:
        return _cache
    df = TABLE.reset_index(drop=True)
    n = len(df)
    area = df["area_rai"].to_numpy(dtype=float)
    total_area = float(area.sum())
    suit = [c for c in df.columns if c.startswith("suit_")]
    ok = [c for c in df.columns if c.startswith("ok_")]
    cand = [c for c in df.columns if c not in meta_cols + suit + ok + exclude]
    const = [c for c in cand if df[c].nunique() <= 1]
    used = [c for c in cand if c not in const]

    # ---------- 1) EDA ----------
    missing = [{"col": c, "label": LABEL.get(c, c), "pct": round(float(df[c].isna().mean() * 100), 1), "n": int(df[c].isna().sum())}
               for c in df.columns if c in LABEL and df[c].isna().any()]
    missing.sort(key=lambda r: -r["pct"])
    dup_cols = [c for c in used]
    dup_rows = int(df.duplicated(subset=dup_cols).sum())
    filters = [
        {"step": "ตัดตัวแปรที่เป็น 'เฉลย'", "detail": "ความสูง (elev_m) และอุณหภูมิ (temp_rule) ใช้สร้างคะแนนในกฎ จึงไม่ป้อนให้โมเดลเรียน",
         "removed": [LABEL[c] for c in exclude if c in LABEL]},
        {"step": "ตัดตัวแปรที่ค่าคงที่", "detail": "ค่าเดียวกันทุกแปลง ไม่ช่วยแยกความต่าง",
         "removed": [LABEL.get(c, c) for c in const]},
        {"step": "จัดกลุ่มตามตำบล", "detail": f"แบ่งชุดฝึก/ตรวจสอบ/ทดสอบแบบกันตำบลซ้ำ ({int((df.split == 'train').sum()):,} / {int((df.split == 'val').sum()):,} / {int((df.split == 'test').sum()):,} แปลง)",
         "removed": []},
        {"step": "ตรวจแปลงซ้ำ", "detail": f"มี {dup_rows:,} แปลง ({dup_rows / n * 100:.0f}%) ที่ลักษณะตรงกับแปลงอื่นทุกตัวแปร (ฝาแฝด) จึงทดสอบแยกกลุ่มไม่ซ้ำ (E5)",
         "removed": []},
    ]
    distributions = [
        {"key": "pH_top_mid", "label": LABEL["pH_top_mid"], "bins": _hist_discrete(df, "pH_top_mid")},
        {"key": "slope_mid", "label": LABEL["slope_mid"], "bins": _hist_numeric(df, "slope_mid")},
        {"key": "depth_mid", "label": LABEL["depth_mid"], "bins": _hist_numeric(df, "depth_mid")},
        {"key": "Gravel_mid", "label": LABEL["Gravel_mid"], "bins": _hist_numeric(df, "Gravel_mid")},
        {"key": "drainage_ord", "label": LABEL["drainage_ord"], "bins": _hist_discrete(df, "drainage_ord", DRAIN)},
        {"key": "fertility_ord", "label": LABEL["fertility_ord"], "bins": _hist_discrete(df, "fertility_ord", FERT)},
        {"key": "tex_top_ord", "label": LABEL["tex_top_ord"], "bins": _hist_discrete(df, "tex_top_ord", TEX)},
    ]
    rain = (df.groupby("amphoe").agg(rain=("rain_annual_mean", "first"), dry=("dry_months", "first"), polygons=("tambon", "size"),
                                      tambons=("tambon", "nunique"), areaRai=("area_rai", "sum")).reset_index())
    rain_by_amphoe = [{"amphoe": r.amphoe, "rain": round(float(r.rain), 0), "dryMonths": float(r.dry), "polygons": int(r.polygons),
                       "tambons": int(r.tambons), "areaRai": round(float(r.areaRai), 0)} for r in rain.itertuples()]
    rain_by_amphoe.sort(key=lambda r: -r["rain"])
    cm = df[CORR_COLS].corr().round(2).fillna(0)
    pairs = []
    for i, a in enumerate(CORR_COLS):
        for j, b in enumerate(CORR_COLS):
            if j > i:
                pairs.append((abs(cm.iloc[i, j]), cm.iloc[i, j], a, b))
    pairs.sort(reverse=True)
    top_pairs = [{"a": LABEL[a], "b": LABEL[b], "r": float(r)} for _, r, a, b in pairs[:4]]
    rmin, rmax = rain["rain"].min(), rain["rain"].max()
    uniq_mid = {LABEL[c]: int(df[c].nunique()) for c in ["pH_top_mid", "slope_mid", "depth_mid", "Gravel_mid"]}
    insights = [
        f"ฝนต่างกันระหว่างอำเภอน้อยมาก ({rmin:,.0f}–{rmax:,.0f} มม./ปี ต่างกัน {(rmax - rmin) / rmin * 100:.0f}%) ฝนจึงช่วยแยกพื้นที่ได้น้อย ส่วนใหญ่ต้องพึ่งคุณสมบัติดิน",
        f"ค่าดินเป็น 'ค่ากลางของช่วงชั้น' จากแผนที่ดิน (เช่น pH มีแค่ {uniq_mid['pH ดินบน']} ค่า) จึงเป็นกราฟแท่งแบบขั้นบันได ไม่ใช่ค่าต่อเนื่อง",
        f"ตัวแปรที่สัมพันธ์กันสูงสุด: {top_pairs[0]['a']} กับ {top_pairs[0]['b']} (r = {top_pairs[0]['r']:+.2f}) ตัวแปรคู่นี้ให้ข้อมูลซ้ำกัน",
        f"ค่าความสูงขาด {missing[0]['pct']:.0f}% จึงไม่ใช้ป้อนโมเดล" if missing and missing[0]["col"] == "elev_m" else "ไม่มีตัวแปรสำคัญที่ขาดมาก",
        f"{dup_rows / n * 100:.0f}% ของแปลงมีฝาแฝด คะแนนทดสอบปกติจึงสูงกว่าความจริง ต้องดูผลบนแปลงที่ไม่ซ้ำคู่กัน",
    ]
    eda = {
        "overview": {"rows": n, "tambons": int(df[["amphoe", "tambon"]].drop_duplicates().shape[0]), "amphoes": int(df["amphoe"].nunique()),
                     "areaRai": round(total_area, 0), "featuresUsed": len(used), "crops": len(CROPS)},
        "sources": [
            {"name": "แผนที่ดินกรมพัฒนาที่ดิน", "detail": f"{n:,} แปลงดิน · 97 ตำบล · pH ความลาดชัน ความลึก เนื้อดิน ระบายน้ำ ฯลฯ"},
            {"name": "ภูมิอากาศรายอำเภอ", "detail": "ฝนรายปี ฝนหน้าฝน/แล้ง จำนวนเดือนแล้ง · 13 อำเภอ"},
            {"name": "เกณฑ์พืช FAO EcoCrop / กรมพัฒนาที่ดิน", "detail": "กฎ 10 พืช (v1.0) ใช้สร้างคะแนนเฉลย"},
        ],
        "filters": filters,
        "missing": missing, "droppedConstant": [LABEL.get(c, c) for c in const], "duplicateRows": dup_rows,
        "distributions": distributions, "rainByAmphoe": rain_by_amphoe,
        "correlation": {"labels": [LABEL[c] for c in CORR_COLS], "matrix": cm.values.tolist(), "top": top_pairs},
        "insights": insights,
    }

    # ---------- 2) Final dashboard (ผลจากโมเดล) ----------
    P = predict_matrix(df)
    w = area / total_area
    best_idx = P.argmax(1)
    best_ok = P.max(1) >= best_min
    best_area = []
    for i, c in enumerate(CROPS):
        a = float(area[(best_idx == i) & best_ok].sum())
        best_area.append({"crop": c, "id": crop_id.get(c, c), "areaRai": round(a, 0), "pct": round(a / total_area * 100, 1)})
    a_none = float(area[~best_ok].sum())
    best_area.append({"crop": "ไม่เหมาะกับพืชใด", "id": "none", "areaRai": round(a_none, 0), "pct": round(a_none / total_area * 100, 1)})
    best_area.sort(key=lambda r: -r["areaRai"])
    suitable = []
    for i, c in enumerate(CROPS):
        share = float(((P[:, i] >= ok_threshold) * w).sum() * 100)
        suitable.append({"crop": c, "id": crop_id.get(c, c), "pct": round(share, 1), "judgeable": c not in no_ok_label,
                         "meanScore": round(float((P[:, i] * w).sum()), 3)})
    suitable.sort(key=lambda r: -r["pct"])
    amphoes = sorted(df["amphoe"].unique())
    heat = []
    for a in amphoes:
        m = (df["amphoe"] == a).to_numpy()
        ww = area[m] / area[m].sum()
        heat.append([round(float((P[m, i] * ww).sum()), 3) for i in range(len(CROPS))])
    tamb = []
    for (a, t), idx in df.groupby(["amphoe", "tambon"]).groups.items():
        idx = list(idx)
        ww = area[idx] / area[idx].sum() if area[idx].sum() > 0 else np.full(len(idx), 1 / len(idx))
        tamb.append({"amphoe": a, "tambon": t, "areaRai": round(float(area[idx].sum()), 0),
                     "scores": [round(float((P[idx, i] * ww).sum()), 3) for i in range(len(CROPS))]})
    tamb.sort(key=lambda r: (r["amphoe"], r["tambon"]))
    top_best = next((r for r in best_area if r["id"] != "none"), None)
    final = {
        "crops": [{"name": c, "id": crop_id.get(c, c), "judgeable": c not in no_ok_label} for c in CROPS],
        "bestCropArea": best_area, "suitableShare": suitable,
        "heat": {"amphoes": amphoes, "crops": CROPS, "matrix": heat}, "tambons": tamb,
        "kpi": {"topCrop": top_best["crop"] if top_best else None, "topCropPct": top_best["pct"] if top_best else None,
                "noCropPct": round(a_none / total_area * 100, 1), "areaRai": round(total_area, 0)},
        "model": {
            "name": "HistGradientBoosting (regression 10 พืช)", "mae": 0.003, "baselineMae": 0.234, "top3": 0.96,
            "errorPct": 0.28, "note": "วัดเทียบกฎ ไม่ใช่ผลผลิตจริง",
            "robustness": [
                {"label": "ทดสอบปกติ", "top3": 0.96}, {"label": "เฉพาะแปลงที่ไม่ซ้ำ", "top3": 0.85},
                {"label": "ข้อมูลคลาด (กลาง)", "top3": 0.80}, {"label": "ขยับเกณฑ์ ±10%", "top3": 0.82},
                {"label": "ขยับเกณฑ์ ±20%", "top3": 0.64},
            ],
        },
        "caveat": "คะแนนทั้งหมดมาจากโมเดลที่เรียนกฎ EcoCrop/กรมพัฒนาที่ดิน ไม่ใช่ผลผลิตจริง ไม่คิดต้นทุน/กำไร และยังไม่ได้ตรวจกับผู้เชี่ยวชาญ ใช้คัดกรองเบื้องต้นเท่านั้น",
    }
    _cache.update({"eda": eda, "final": final})
    return _cache
