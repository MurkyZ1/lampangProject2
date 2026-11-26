"""
ลำปาง · ปลูกดี — Backend (FastAPI) ของโมเดลแนะนำความเหมาะสมของพืช
------------------------------------------------------------------
รัน:   pip install -r requirements.txt
       uvicorn main:app --host 127.0.0.1 --port 8000 --reload
เอกสาร API อัตโนมัติ: http://127.0.0.1:8000/docs

โมเดล = HistGradientBoosting (regression 10 พืช) เรียนรู้ "คะแนนความเหมาะสม 0–1"
ที่สร้างจากกฎ FAO EcoCrop / กรมพัฒนาที่ดิน v1.0 (เป็น surrogate ของกฎ ไม่ใช่ผลผลิตจริง)
ไม่ใช้ต้นทุน/กำไร และไม่ใช้ข้อมูลว่าลำปางปลูกอะไรอยู่ตอนนี้
"""
from __future__ import annotations

import os
import warnings
from pathlib import Path
from typing import Literal, Optional

import joblib
import numpy as np
import pandas as pd
import sklearn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor

BASE = Path(__file__).parent


def _load_env(path: Path) -> None:
    """อ่านค่าจากไฟล์ .env (บรรทัด KEY=VALUE) โดยไม่ต้องติดตั้งแพ็กเกจเพิ่ม · ค่าที่ตั้งใน environment มีสิทธิ์เหนือกว่า"""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env(BASE / ".env")
import community  # noqa: E402  (ต้องโหลด .env ก่อน เพราะอ่านค่า ADMIN_* / COMMUNITY_DATA_FILE)
DATA = Path(os.getenv("MODEL_DATA", BASE / "data" / "modeling_table.csv"))
MODEL_FILE = Path(os.getenv("MODEL_FILE", BASE / "model.joblib"))
OK_THRESHOLD = 0.6      # คะแนน ≥ 0.6 = "เหมาะ"
BEST_MIN = 0.4          # ต่ำกว่า 0.4 = ไม่แนะนำพืชใดเลย
RULES_VERSION = "v1.0-237d1c2ddf0f"
SEED = 42

META = ["amphoe", "tambon", "group", "area_rai", "split", "rules_version", "best_crop", "best_score"]
EXCLUDE = ["elev_m", "temp_rule"]            # ใช้สร้างเฉลยในกฎ แต่ไม่ใช่ feature ของโมเดล

# ชื่อไทย -> id ที่ frontend ใช้ใน src/data/cropGuide.js / cropLookup.js
CROP_ID = {
    "มันสำปะหลัง": "cassava", "ข้าวโพดเลี้ยงสัตว์": "maize", "ลำไย": "longan",
    "สับปะรด": "pineapple", "กระเทียม": "garlic", "ถั่วเหลือง": "soybean",
    "มะม่วง": "mango", "ข้าวนาปี": "rice", "อ้อยโรงงาน": "sugarcane",
    "กาแฟอาราบิกา": "arabica",
}
# พืชที่ไม่มีแปลงไหนถึง 0.6 ในลำปาง (ฝนน้อยกว่าที่พืชต้องการ) -> คะแนนเรียงอันดับได้ แต่ไม่ควรตัดสิน เหมาะ/ไม่เหมาะ
NO_OK_LABEL = {"ลำไย", "อ้อยโรงงาน", "กาแฟอาราบิกา"}

DRAINAGE = {"แย่มาก": 1, "ไม่ดี": 2, "ค่อนข้างไม่ดี": 2.5, "ปานกลาง": 3, "ดี": 4}
FERTILITY = {"ต่ำ": 1, "กลาง": 2, "สูง": 3}
TEXTURE = {"ทราย": 1, "ร่วนปนทราย": 2, "ร่วน": 3, "ร่วนเหนียวปนทราย": 3.5, "ร่วนเหนียว": 4,
           "เหนียวปนทราย": 4.5, "เหนียวปนทรายแป้ง": 5, "เหนียว": 5}


# ───────────────────────── โหลด / ฝึกโมเดล ─────────────────────────
def load_table() -> pd.DataFrame:
    if not DATA.exists():
        raise RuntimeError(f"ไม่พบไฟล์ข้อมูล {DATA}")
    return pd.read_csv(DATA, encoding="utf-8-sig")


def train(df: pd.DataFrame) -> dict:
    suit = [c for c in df.columns if c.startswith("suit_")]
    ok = [c for c in df.columns if c.startswith("ok_")]
    feats = [c for c in df.columns if c not in META + suit + ok + EXCLUDE]
    feats = [c for c in feats if df[c].nunique() > 1]
    model = MultiOutputRegressor(
        HistGradientBoostingRegressor(max_iter=200, learning_rate=0.08, random_state=SEED))
    model.fit(df[feats], df[suit].values)       # ฝึกด้วยข้อมูลทั้งหมด (train+val+test) เพื่อใช้งานจริง
    bundle = {"model": model, "features": feats, "crops": [c[5:] for c in suit],
              "sklearn": sklearn.__version__, "medians": df[feats].median().to_dict(), "rules_version": RULES_VERSION,
              "ranges": {c: [float(df[c].min()), float(df[c].max())] for c in feats}}
    joblib.dump(bundle, MODEL_FILE)
    return bundle


def get_bundle() -> dict:
    # ใช้ไฟล์โมเดลที่เซฟไว้ก็ต่อเมื่อ sklearn เวอร์ชันตรงกับเครื่องนี้ ไม่งั้นฝึกใหม่ (~6 วินาที)
    if MODEL_FILE.exists():
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error")
                b = joblib.load(MODEL_FILE)
            if b.get("sklearn") == sklearn.__version__:
                return b
        except Exception:
            pass
    return train(load_table())


TABLE = load_table()
BUNDLE = get_bundle()
FEATURES: list[str] = BUNDLE["features"]
CROPS: list[str] = BUNDLE["crops"]


def predict_matrix(X: pd.DataFrame) -> np.ndarray:
    return np.clip(BUNDLE["model"].predict(X[FEATURES]), 0, 1)


def label_for(score: float) -> str:
    return "เหมาะ" if score >= OK_THRESHOLD else ("พอใช้ / ก้ำกึ่ง" if score >= 0.3 else "ไม่เหมาะ")


def rank(scores: np.ndarray, top: Optional[int] = None) -> list[dict]:
    order = np.argsort(-scores)
    out = []
    for i in order[: top or len(order)]:
        c, s = CROPS[i], float(scores[i])
        out.append({
            "crop": c, "id": CROP_ID.get(c, c), "score": round(s, 3),
            "label": label_for(s),
            "suitable": (s >= OK_THRESHOLD) if c not in NO_OK_LABEL else None,
            "note": "ฝนลำปางน้อยกว่าที่พืชนี้ต้องการ ใช้ดูอันดับได้ แต่ไม่ควรตัดสิน เหมาะ/ไม่เหมาะ จากคะแนนนี้"
                    if c in NO_OK_LABEL else None,
        })
    return out


CAVEAT = ("ผลนี้มาจากโมเดลที่เรียนรู้กฎ FAO EcoCrop/กรมพัฒนาที่ดิน ไม่ใช่ผลผลิตจริง "
          "ไม่คิดต้นทุน/กำไร และไม่ได้ตรวจกับผู้เชี่ยวชาญ ใช้คัดกรองเบื้องต้นก่อนตัดสินใจปลูก")


# ───────────────────────── Schemas ─────────────────────────
class PredictIn(BaseModel):
    # ดิน (ใส่เท่าที่ทราบ ที่เหลือใช้ค่ากลางของลำปาง และแจ้งใน "assumed")
    ph: Optional[float] = Field(None, ge=3, le=10, description="pH ดินบน")
    ph_low: Optional[float] = Field(None, ge=3, le=10, description="pH ดินล่าง (ไม่ใส่ = เท่ากับ ph)")
    slope_pct: Optional[float] = Field(None, ge=0, le=100, description="ความลาดชัน %")
    depth_cm: Optional[float] = Field(None, ge=0, le=300, description="ความลึกดิน ซม.")
    gravel_pct: Optional[float] = Field(None, ge=0, le=100, description="กรวด/ก้อนหิน %")
    drainage: Optional[Literal["แย่มาก", "ไม่ดี", "ค่อนข้างไม่ดี", "ปานกลาง", "ดี"]] = None
    fertility: Optional[Literal["ต่ำ", "กลาง", "สูง"]] = None
    texture: Optional[Literal["ทราย", "ร่วนปนทราย", "ร่วน", "ร่วนเหนียวปนทราย", "ร่วนเหนียว",
                              "เหนียวปนทราย", "เหนียวปนทรายแป้ง", "เหนียว"]] = Field(None, description="เนื้อดินบน")
    # ฝน: เลือกอำเภอ (ใช้ค่าฝนของอำเภอนั้น) หรือระบุเอง
    amphoe: Optional[str] = Field(None, description="ชื่ออำเภอ เช่น เถิน — ใช้ดึงค่าฝน")
    rain_annual_mm: Optional[float] = Field(None, ge=0, le=5000, description="ฝนรายปีเฉลี่ย มม. (ถ้าระบุจะใช้แทนของอำเภอ)")
    top: int = Field(10, ge=1, le=10)


# ───────────────────────── App ─────────────────────────
app = FastAPI(title="ลำปาง · ปลูกดี — Crop Suitability API", version="1.0.0",
              description="ระบบแนะนำความเหมาะสมของพืช จ.ลำปาง จากดิน + ฝน (surrogate ของกฎ EcoCrop/LDD)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(community.router)
community.bootstrap_admin()


# รูปแบบ error ให้เหมือน backend เดิม: {"error": "ข้อความ"} (frontend อ่านคีย์ error)
@app.exception_handler(community.ApiError)
async def _api_error(_: Request, exc: community.ApiError):
    return JSONResponse({"error": exc.message}, status_code=exc.status)


@app.exception_handler(HTTPException)
async def _http_error(_: Request, exc: HTTPException):
    return JSONResponse({"error": str(exc.detail), "detail": str(exc.detail)}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(x) for x in first.get("loc", [])[1:]) or "ข้อมูล"
    msg = f"{where}: {first.get('msg', 'ข้อมูลไม่ถูกต้อง')}"
    return JSONResponse({"error": msg, "detail": msg}, status_code=422)


AMPHOE_RAIN = (TABLE.groupby("amphoe")[["rain_annual_mean", "rain_annual_std", "rain_wet", "rain_dry", "dry_months"]]
               .first())


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "lampang-plookdee-model", "modelLoaded": True,
            "rulesVersion": BUNDLE["rules_version"], "crops": len(CROPS), "features": len(FEATURES),
            "trainingRows": int(len(TABLE))}


@app.get("/api/crop-stats")
def crop_stats():
    """สถิติการเพาะปลูกจริง (หน้า Dashboard) — ยังไม่มีข้อมูลจริง คืนค่าว่างเพื่อให้หน้าเว็บทำงานได้"""
    return {"stats": [], "message": "ยังไม่ได้เชื่อมข้อมูลสถิติการเพาะปลูกจริง"}


@app.get("/api/dashboard")
def dashboard_data():
    """ข้อมูลหน้า Dashboard: eda (สำรวจข้อมูล) + final (ผลจากโมเดล)"""
    import dashboard
    return dashboard.build(TABLE, CROPS, predict_matrix, META, EXCLUDE, NO_OK_LABEL, OK_THRESHOLD, BEST_MIN, CROP_ID)


# แหล่งน้ำชลประทานที่ตรวจกับแหล่งอ้างอิงแล้วเท่านั้น (ไม่ครบทุกอำเภอ · Dataset เองไม่มีข้อมูลนี้)
# อ้างอิง: th.wikipedia.org เขื่อนกิ่วลม/เขื่อนกิ่วคอหมา, bangkokbiznews.com/pr-news/news/prnews/1259094,
#          dailynews.co.th/news/149177 (แม่ทะ แม่ทาน แม่อาบ), lovethailand.org (แม่มอก), prachachat.net/local-economy/news-1370180 (แม่ปาน)
WATER_SOURCES = {
    "เมืองลำปาง": "แม่น้ำวัง · เขื่อนกิ่วลม (ต.บ้านแลง) · ฝายหลวงสบอาง · อ่างเก็บน้ำแม่ทะ (ต.พระบาท)",
    "แจ้ห่ม": "เขื่อนกิ่วคอหมา (ต.ปงดอน) บนแม่น้ำวัง · อยู่ในระบบกิ่วลม–กิ่วคอหมา",
    "ห้างฉัตร": "ระบบส่งน้ำกิ่วลม–กิ่วคอหมา (ครอบคลุม 4 อำเภอ)",
    "เกาะคา": "ระบบส่งน้ำกิ่วลม–กิ่วคอหมา · ฝายหลวงสบอาง",
    "แม่ทะ": "ฝายหลวงสบอาง (ส่งน้ำเมืองลำปาง เกาะคา แม่ทะ)",
    "สบปราบ": "อ่างเก็บน้ำแม่ทาน (ต.แม่กัวะ)",
    "เถิน": "อ่างเก็บน้ำแม่มอก (ต.เวียงมอก) · อ่างเก็บน้ำแม่อาบ (ต.นาโป่ง)",
    "เมืองปาน": "อ่างเก็บน้ำแม่ปาน (ต.เมืองปาน) อยู่ระหว่างเตรียมก่อสร้าง ยังไม่ใช่แหล่งน้ำปัจจุบัน",
}


AMPHOE_CODE = {"เมืองลำปาง": "5201", "แม่เมาะ": "5202", "เกาะคา": "5203", "เสริมงาม": "5204", "งาว": "5205", "แจ้ห่ม": "5206",
               "วังเหนือ": "5207", "เถิน": "5208", "แม่พริก": "5209", "แม่ทะ": "5210", "สบปราบ": "5211", "ห้างฉัตร": "5212", "เมืองปาน": "5213"}


def _wq(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    """ควอนไทล์ถ่วงน้ำหนักด้วยพื้นที่"""
    ok = ~np.isnan(values)
    v, w = values[ok], weights[ok]
    order = np.argsort(v)
    v, w = v[order], w[order]
    cum = np.cumsum(w) / w.sum()
    return float(v[min(np.searchsorted(cum, q), len(v) - 1)])


@app.get("/api/districts")
def districts():
    """ข้อมูลรายอำเภอจาก Dataset จริง (ค่าเฉลี่ยถ่วงพื้นที่) รูปแบบตรงกับที่หน้าเว็บใช้
    ไม่มีข้อมูลอุณหภูมิจริง/แหล่งน้ำใน Dataset จึงส่งค่าว่าง (หน้าเว็บจะแสดง 'ยังไม่มีข้อมูล')"""
    df = TABLE.reset_index(drop=True)
    P = predict_matrix(df)
    best = P.argmax(1)
    best_ok = P.max(1) >= BEST_MIN
    texture_names = {v: k for k, v in TEXTURE.items()}
    drain_names = {1: "ระบายน้ำแย่มาก", 2: "ระบายน้ำไม่ดี", 2.5: "ระบายน้ำค่อนข้างไม่ดี", 3: "ระบายน้ำปานกลาง", 4: "ระบายน้ำดี"}
    fert_names = {1: "ความอุดมสมบูรณ์ต่ำ", 2: "ความอุดมสมบูรณ์ปานกลาง", 3: "ความอุดมสมบูรณ์สูง"}
    out = []
    for amphoe, idx in df.groupby("amphoe").groups.items():
        idx = np.array(list(idx))
        g = df.loc[idx]
        w = g["area_rai"].to_numpy(float)
        if w.sum() <= 0:
            w = np.ones(len(g))
        mean = lambda col: float(np.nansum(g[col].to_numpy(float) * w) / w[~np.isnan(g[col].to_numpy(float))].sum())
        def dominant(col, names):
            share = g.assign(_w=w).groupby(col)["_w"].sum().sort_values(ascending=False)
            key = share.index[0]
            return names.get(key, str(key)), float(share.iloc[0] / share.sum() * 100)
        slope = mean("slope_mid")
        zone = "lowland" if slope < 7 else ("foothill" if slope < 12 else "highland")
        tex, tex_pct = dominant("tex_top_ord", texture_names)
        drain, drain_pct = dominant("drainage_ord", drain_names)
        fert, _ = dominant("fertility_ord", fert_names)
        ph = g["pH_top_mid"].to_numpy(float)
        rain = float(g["rain_annual_mean"].iloc[0])
        area_best = {}
        for j in np.unique(best[idx][best_ok[idx]]):
            m = (best[idx] == j) & best_ok[idx]
            area_best[CROPS[j]] = float(w[m].sum())
        top = sorted(area_best.items(), key=lambda kv: -kv[1])[:4]
        total = float(w.sum())
        out.append({
            "code": AMPHOE_CODE.get(amphoe, ""), "name": amphoe, "zone": zone,
            "terrain": f"ความลาดชันเฉลี่ย {slope:.1f}% · ความลึกดินเฉลี่ย {mean('depth_mid'):.0f} ซม.",
            "soil": f"เนื้อดินบนส่วนใหญ่ {tex} ({tex_pct:.0f}% ของพื้นที่) · {fert}",
            "ph": f"{mean('pH_top_mid'):.1f} (ส่วนใหญ่ {_wq(ph, w, .1):.1f}–{_wq(ph, w, .9):.1f})",
            "drain": f"{drain} ({drain_pct:.0f}% ของพื้นที่)",
            "temp": f"≈{mean('temp_rule'):.1f}°C เฉลี่ยทั้งปี (ประมาณจากข้อมูลความสูง ไม่ใช่ค่าที่วัดจริง)",
            "water": ((WATER_SOURCES[amphoe] + " · " if amphoe in WATER_SOURCES else "ยังไม่ได้ตรวจแหล่งน้ำชลประทานของอำเภอนี้ · ")
                      + f"ฝนหน้าฝน ≈{float(g['rain_wet'].iloc[0]):,.0f} มม. หน้าแล้ง ≈{float(g['rain_dry'].iloc[0]):,.0f} มม."),
            "rain": f"≈{rain:,.0f} มม./ปี · แล้ง {mean('dry_months'):.0f} เดือน",
            "crops": [c for c, _ in top],
            "tip": ("จัดอันดับจากคะแนนของโมเดลที่เรียนกฎ FAO EcoCrop/กรมพัฒนาที่ดิน (พื้นที่ที่แต่ละพืชได้คะแนนสูงสุด: "
                    + ", ".join(f"{c} {a / total * 100:.0f}%" for c, a in top)
                    + ") ไม่ใช่ผลผลิตจริง ควรตรวจสอบกับสำนักงานเกษตรอำเภอ"),
            "source": "backend/data/modeling_table.csv",
        })
    out.sort(key=lambda r: r["code"])
    return {"districts": out, "count": len(out), "source": "modeling_table.csv"}



@app.get("/api/model/info")
def model_info():
    return {
        "type": "surrogate", "algorithm": "HistGradientBoosting (regression, 10 พืช)",
        "rulesVersion": BUNDLE["rules_version"], "okThreshold": OK_THRESHOLD,
        "features": FEATURES, "inputRanges": BUNDLE["ranges"],
        "crops": [{"name": c, "id": CROP_ID.get(c, c), "canJudgeSuitable": c not in NO_OK_LABEL} for c in CROPS],
        "evaluation": {"MAE_LOAO": 0.003, "baselineMAE": 0.234, "top3Overlap": 0.96,
                       "top3OverlapNonDuplicate": 0.85, "top3OverlapRuleJitter20pct": 0.64,
                       "note": "วัดเทียบกฎ ไม่ใช่ผลผลิตจริง 94% ของแปลงทดสอบมีฝาแฝดในชุดฝึก"},
        "caveat": CAVEAT,
    }


@app.get("/api/model/options")
def options():
    """ตัวเลือกสำหรับฟอร์ม frontend"""
    return {"drainage": list(DRAINAGE), "fertility": list(FERTILITY), "texture": list(TEXTURE),
            "amphoe": sorted(AMPHOE_RAIN.index.tolist())}


@app.post("/api/predict")
def predict(body: PredictIn):
    row = {c: BUNDLE["medians"][c] for c in FEATURES}
    used: dict[str, float] = {}

    provided = set()
    def put(name, value, key):
        if value is not None:
            row[name] = float(value); provided.add(name); used[key] = float(value)

    put("pH_top_mid", body.ph, "ph")
    put("pH_low_mid", body.ph_low if body.ph_low is not None else body.ph, "ph_low")
    put("slope_mid", body.slope_pct, "slope_pct")
    put("depth_mid", body.depth_cm, "depth_cm")
    put("Gravel_mid", body.gravel_pct, "gravel_pct")
    if body.gravel_pct is not None and "top_gravelly" in row:
        row["top_gravelly"] = float(body.gravel_pct >= 35); provided.add("top_gravelly")
    put("drainage_ord", DRAINAGE.get(body.drainage) if body.drainage else None, "drainage")
    put("fertility_ord", FERTILITY.get(body.fertility) if body.fertility else None, "fertility")
    if body.texture:
        put("tex_top_ord", TEXTURE[body.texture], "texture")

    if body.amphoe:
        if body.amphoe not in AMPHOE_RAIN.index:
            raise HTTPException(404, f"ไม่รู้จักอำเภอ '{body.amphoe}' (ดู /api/model/options)")
        for k, v in AMPHOE_RAIN.loc[body.amphoe].items():
            if k in row:
                row[k] = float(v); provided.add(k)
    if body.rain_annual_mm is not None:
        ratio = body.rain_annual_mm / max(row.get("rain_annual_mean", 1), 1)
        for k in ("rain_annual_mean", "rain_wet", "rain_dry"):
            if k in row: row[k] = row[k] * ratio
        row["rain_annual_mean"] = float(body.rain_annual_mm); provided.update(["rain_annual_mean", "rain_wet", "rain_dry"])

    X = pd.DataFrame([row])
    scores = predict_matrix(X)[0]
    ranked = rank(scores, body.top)
    best = ranked[0]
    assumed_feats = [c for c in FEATURES if c not in provided]
    n_in = len(provided)
    return {
        "recommendations": ranked,
        "bestCrop": best["crop"] if best["score"] >= BEST_MIN else None,
        "message": (f"พืชที่เหมาะที่สุดคือ {best['crop']} (คะแนน {best['score']:.2f})"
                    if best["score"] >= BEST_MIN else "ไม่มีพืชใดในรายการที่เหมาะกับแปลงนี้ (คะแนนสูงสุดต่ำกว่า 0.4)"),
        "inputsUsed": used,
        "assumedFeatures": assumed_feats,
        "confidenceNote": ("ใส่ข้อมูลน้อย ผลอิงค่ากลางของลำปางเป็นส่วนใหญ่" if n_in < 6 else
                           "ใส่ข้อมูลค่อนข้างครบ"),
        "caveat": CAVEAT,
    }


def _tambon_frame(amphoe: str, tambon: str) -> pd.DataFrame:
    sub = TABLE[(TABLE.amphoe == amphoe) & (TABLE.tambon == tambon)]
    if sub.empty:
        raise HTTPException(404, f"ไม่พบ ตำบล{tambon} อำเภอ{amphoe}")
    return sub


TEX_LABEL = {1: "ร่วนทราย", 2: "ร่วนปนทราย", 3: "ร่วน", 3.5: "ร่วนเหนียวปนทราย", 4: "ร่วนเหนียว",
             4.5: "เหนียวปนทราย", 5: "เหนียว"}
DRAIN_LABEL = {1: "แย่มาก", 2: "ไม่ดี", 2.5: "ค่อนข้างไม่ดี", 3: "ปานกลาง", 4: "ดี"}


def _nearest(table: dict, x: float):
    return table[min(table, key=lambda k: abs(k - x))]


@app.get("/api/tambons")
def tambons(amphoe: Optional[str] = None):
    """ตำบลทั้งหมด (รูปแบบตรงกับ frontend: id, province, district, tambon, soilType, ph, drainage, water, crops, notes ...)
    ค่าดิน = เฉลี่ยถ่วงพื้นที่ของแปลงในตำบล · crops/notes = ผลจากโมเดล (ไม่ใช่สถิติการปลูกจริง)"""
    df = (TABLE if amphoe is None else TABLE[TABLE.amphoe == amphoe]).reset_index(drop=True)
    if df.empty:
        raise HTTPException(404, "ไม่พบอำเภอนี้")
    P = predict_matrix(df)
    out = []
    for (a, t), idx in df.groupby(["amphoe", "tambon"]).groups.items():
        idx = list(idx)
        sub = df.loc[idx]
        w = sub["area_rai"].to_numpy(dtype=float)
        w = w / w.sum() if w.sum() > 0 else np.full(len(idx), 1 / len(idx))
        wavg = lambda col: float(np.nansum(sub[col].to_numpy(dtype=float) * w) / max(w[~sub[col].isna().to_numpy()].sum(), 1e-9))
        mean = (P[idx] * w[:, None]).sum(0)
        top = rank(mean, 3)
        good = [r for r in top if r["score"] >= 0.4]
        rain = wavg("rain_annual_mean")
        out.append({
            "id": f"{a}-{t}", "province": "ลำปาง", "district": a, "amphoe": a, "tambon": t,
            "soilType": _nearest(TEX_LABEL, wavg("tex_top_ord")),
            "ph": f"{wavg('pH_top_mid'):.1f}",
            "drainage": _nearest(DRAIN_LABEL, wavg("drainage_ord")),
            "water": f"ฝนเฉลี่ย {rain:,.0f} มม./ปี · ช่วงแล้ง {wavg('dry_months'):.0f} เดือน",
            "crops": [r["crop"] for r in top],
            "notes": ("โมเดลให้คะแนน " + " · ".join(f"{r['crop']} {r['score']:.2f}" for r in top)
                      + ("" if good else " (ไม่มีพืชใดถึง 0.4)") + " — เป็นผลคัดกรองจากกฎ EcoCrop/LDD ไม่ใช่สถิติการปลูกจริง"),
            "source": f"โมเดลเรียนกฎ {RULES_VERSION} + ข้อมูลดินกรมพัฒนาที่ดิน (ถ่วงพื้นที่แปลง {len(idx)} แปลง)",
            "updatedAt": "2026-11",
            "areaRai": round(float(sub["area_rai"].sum()), 1),
            "top3": top,
        })
    return {"tambons": sorted(out, key=lambda r: (r["district"], r["tambon"])), "caveat": CAVEAT}


@app.get("/api/tambons/suitability")
def tambon_suitability(amphoe: str = Query(...), tambon: str = Query(...)):
    """คะแนน 10 พืชของตำบล (ถ่วงน้ำหนักตามพื้นที่) + สัดส่วนพื้นที่ที่แต่ละพืชได้ ≥ 0.6"""
    sub = _tambon_frame(amphoe, tambon).reset_index(drop=True)
    P = predict_matrix(sub)
    w = sub["area_rai"].to_numpy(); w = w / w.sum() if w.sum() > 0 else np.full(len(sub), 1 / len(sub))
    mean = (P * w[:, None]).sum(0)
    share_ok = ((P >= OK_THRESHOLD) * w[:, None]).sum(0)
    ranked = rank(mean)
    share = {CROPS[i]: round(float(share_ok[i]) * 100, 1) for i in range(len(CROPS))}
    for r in ranked:
        r["areaShareSuitablePct"] = share[r["crop"]] if r["suitable"] is not None else None
    return {"amphoe": amphoe, "tambon": tambon, "polygons": int(len(sub)),
            "areaRai": round(float(sub["area_rai"].sum()), 1), "recommendations": ranked, "caveat": CAVEAT}


def _rule_chat(payload: dict):
    """สำรอง (ไม่ใช้ AI) ตอบแชตแบบอิงโมเดล: ถ้าข้อความมีชื่ออำเภอ จะสรุปพืชแนะนำจากโมเดลของอำเภอนั้น"""
    msg = str(payload.get("message", "")).strip()
    if not msg:
        raise HTTPException(400, "message ว่าง")
    names = [a for a in AMPHOE_RAIN.index if a in msg]
    if not names:
        return {"reply": "ลองระบุชื่ออำเภอในลำปาง เช่น “อำเภอเถิน ควรปลูกอะไร” หรือใช้หน้า วิเคราะห์ดิน เพื่อใส่ค่าดินของแปลงเอง\n\n" + CAVEAT}
    a = names[0]
    df = TABLE[TABLE.amphoe == a].reset_index(drop=True)
    P = predict_matrix(df)
    w = df["area_rai"].to_numpy(); w = w / w.sum()
    r = rank((P * w[:, None]).sum(0), 3)
    lines = "\n".join(f"- {x['crop']}: {x['score']:.2f} ({x['label']})" for x in r)
    return {"reply": f"**อำเภอ{a} — พืชที่โมเดลให้คะแนนสูงสุด 3 อันดับ (เฉลี่ยถ่วงพื้นที่)**\n{lines}\n\n*{CAVEAT}*"}


# ---------- เครื่องมือให้ AI เรียก (ข้อมูลจริงจากโมเดล/ตาราง) ----------
def _pick_amphoe(name: str) -> str:
    name = str(name).replace("อำเภอ", "").strip()
    for a in AMPHOE_RAIN.index:
        if a == name or name in a or a in name:
            return a
    raise ValueError(f"ไม่พบอำเภอ '{name}' มีเฉพาะ: {', '.join(AMPHOE_RAIN.index)}")


def _pick_crop(name: str) -> str:
    name = str(name).strip()
    for c in CROPS:
        if c == name or name in c or c in name:
            return c
    raise ValueError(f"ไม่มีพืช '{name}' ในโมเดล มีเฉพาะ: {', '.join(CROPS)}")


def _t_district_info(amphoe: str) -> dict:
    a = _pick_amphoe(amphoe)
    d = next(x for x in districts()["districts"] if x["name"] == a)
    return {k: d[k] for k in ("name", "zone", "terrain", "soil", "ph", "drain", "rain", "temp", "water", "crops")} | {"note": CAVEAT}


def _weighted_scores(df: pd.DataFrame) -> np.ndarray:
    P = predict_matrix(df.reset_index(drop=True))
    w = df["area_rai"].to_numpy(float)
    w = w / w.sum() if w.sum() > 0 else np.full(len(df), 1 / len(df))
    return (P * w[:, None]).sum(0)


def _t_rank_crops(amphoe: str, tambon: Optional[str] = None) -> dict:
    a = _pick_amphoe(amphoe)
    df = TABLE[TABLE.amphoe == a]
    where = f"อำเภอ{a}"
    if tambon:
        t = str(tambon).replace("ตำบล", "").strip()
        sub = df[df.tambon == t]
        if sub.empty:
            raise ValueError(f"ไม่พบตำบล '{t}' ใน{where} ตำบลที่มี: {', '.join(sorted(df.tambon.unique()))}")
        df, where = sub, f"ตำบล{t} {where}"
    ranked = rank(_weighted_scores(df), 5)
    return {"area": where, "top": [{"crop": r["crop"], "score": round(r["score"], 2), "label": r["label"],
                                    "judgeable": r["crop"] not in NO_OK_LABEL} for r in ranked],
            "note": CAVEAT}


def _t_where_crop(crop: str) -> dict:
    c = _pick_crop(crop)
    j = CROPS.index(c)
    rows = []
    for a in AMPHOE_RAIN.index:
        df = TABLE[TABLE.amphoe == a].reset_index(drop=True)
        P = predict_matrix(df)
        w = df["area_rai"].to_numpy(float)
        w = w / w.sum()
        rows.append({"amphoe": a, "score": round(float((P[:, j] * w).sum()), 2),
                     "areaSuitablePct": round(float(((P[:, j] >= OK_THRESHOLD) * w).sum() * 100), 1)})
    rows.sort(key=lambda r: -r["score"])
    return {"crop": c, "judgeable": c not in NO_OK_LABEL, "byAmphoe": rows, "note": CAVEAT}


def _t_province() -> dict:
    import dashboard
    f = dashboard.build(TABLE, CROPS, predict_matrix, META, EXCLUDE, NO_OK_LABEL, OK_THRESHOLD, BEST_MIN, CROP_ID)["final"]
    return {"bestCropAreaPct": [{"crop": r["crop"], "pct": r["pct"]} for r in f["bestCropArea"]],
            "suitableAreaPct": [{"crop": r["crop"], "pct": r["pct"], "judgeable": r["judgeable"]} for r in f["suitableShare"]],
            "note": f["caveat"]}


def _t_list_tambons(amphoe: str) -> dict:
    a = _pick_amphoe(amphoe)
    return {"amphoe": a, "tambons": sorted(TABLE[TABLE.amphoe == a].tambon.unique().tolist())}


TOOL_IMPL = {"get_district_info": _t_district_info, "rank_crops": _t_rank_crops, "where_is_crop_suitable": _t_where_crop,
             "province_summary": _t_province, "list_tambons": _t_list_tambons}


@app.post("/api/chat")
def chat(payload: dict, request: Request):
    """แชต: ใช้ AI (Groq) เรียบเรียงคำตอบจากเครื่องมือของระบบ ถ้าใช้ AI ไม่ได้ จะถอยไปใช้ระบบเดิม (จับชื่ออำเภอ)"""
    import llm_chat
    msg = str(payload.get("message", "")).strip()
    if not msg:
        raise HTTPException(400, "message ว่าง")
    if len(msg) > llm_chat.MAX_MESSAGE_CHARS:
        raise HTTPException(400, f"ข้อความยาวเกิน {llm_chat.MAX_MESSAGE_CHARS} ตัวอักษร")
    if llm_chat.enabled():
        # หลัง proxy (เช่น Render) ใช้ IP จริงจาก X-Forwarded-For ถ้ามี
        fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        client = fwd or (request.client.host if request.client else "unknown")
        if not llm_chat.check_rate(client):
            raise HTTPException(429, "ถามถี่เกินไป รอสักครู่แล้วลองใหม่")
        try:
            return {"reply": llm_chat.answer(msg, payload.get("history") or [], TOOL_IMPL), "mode": "ai"}
        except llm_chat.LLMUnavailable as e:
            print(f"[chat] AI ใช้ไม่ได้ ({e}) → ใช้ระบบสำรอง")
    out = _rule_chat(payload)
    out["mode"] = "rule"
    return out