"""
ระบบสมาชิก / รายงานชุมชน / แอดมิน (ย้ายมาจาก backend Node เดิม)
เก็บข้อมูลเป็นไฟล์ JSON (storage/community.json) — รูปแบบไฟล์ตรงกับของเดิม ใช้ community.json เดิมต่อได้
(รหัสผ่านใหม่แฮชด้วย PBKDF2 ส่วนรหัสเก่าแบบ scrypt ตรวจได้เมื่อ Python รองรับ)  ต้องเชื่อมฐานข้อมูลจริง + HTTPS ก่อนเปิดให้คนทั่วไปใช้
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Header, Request

STORE_FILE = Path(os.getenv("COMMUNITY_DATA_FILE", Path(__file__).parent / "storage" / "community.json"))
_lock = threading.RLock()


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


# ───────────── ที่เก็บข้อมูล ─────────────
def _read() -> dict:
    try:
        data = json.loads(STORE_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        data = {}
    return {k: (data.get(k) if isinstance(data.get(k), list) else []) for k in ("users", "sessions", "reports")}


def _write(db: dict) -> None:
    STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE_FILE.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    os.replace(tmp, STORE_FILE)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


# ───────────── รหัสผ่าน / โทเคน ─────────────
PBKDF2_ROUNDS = 600_000


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 (มีในทุกเครื่อง — Python ของ macOS บางรุ่นไม่มี hashlib.scrypt)"""
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ROUNDS, dklen=64)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt}${derived.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    if not encoded:
        return False
    try:
        if encoded.startswith("pbkdf2_sha256$"):
            _, rounds, salt, hexed = encoded.split("$", 3)
            stored = bytes.fromhex(hexed)
            check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(rounds), dklen=len(stored))
            return hmac.compare_digest(check, stored)
        if ":" in encoded and hasattr(hashlib, "scrypt"):      # รหัสเก่าจาก backend Node (scrypt)
            salt, hexed = encoded.split(":", 1)
            stored = bytes.fromhex(hexed)
            check = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=len(stored))
            return hmac.compare_digest(check, stored)
    except Exception:
        return False
    return False


def _hash_token(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


def _public_user(u: dict) -> dict:
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"]}


def authenticated(authorization: Optional[str]) -> dict:
    if not authorization or not re.fullmatch(r"Bearer [a-fA-F0-9]{64}", authorization):
        raise ApiError(401, "กรุณาเข้าสู่ระบบ")
    th = _hash_token(authorization[7:])
    with _lock:
        db = _read()
    now = time.time() * 1000
    session = next((s for s in db["sessions"] if s["tokenHash"] == th and s["expiry"] > now), None)
    user = session and next((u for u in db["users"] if u["id"] == session["userId"]), None)
    if not user:
        raise ApiError(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
    return _public_user(user)


def require_admin(authorization: Optional[str]) -> dict:
    user = authenticated(authorization)
    if user["role"] != "admin":
        raise ApiError(403, "เฉพาะผู้ดูแลระบบ")
    return user


# ───────────── กันยิงถี่ ─────────────
_bad: dict = {}


def _limit(request: Request) -> None:
    key = request.client.host if request.client else "?"
    now = time.time()
    first, count = _bad.get(key, (now, 0))
    if now - first > 600:
        first, count = now, 0
    count += 1
    _bad[key] = (first, count)
    if count > 30:
        raise ApiError(429, "ส่งคำขอถี่เกินไป กรุณาลองใหม่ภายหลัง")


# ───────────── แอดมินคนแรก (จาก ADMIN_EMAIL / ADMIN_PASSWORD) ─────────────
DEFAULT_ADMIN_ID = "superadmin"
DEFAULT_ADMIN_PASSWORD = "admin"


def bootstrap_admin() -> None:
    """สร้างแอดมินคนแรก: ใช้ ADMIN_EMAIL/ADMIN_PASSWORD จาก .env ถ้าตั้งไว้ (รหัสอย่างน้อย 12 ตัว)
    ถ้าไม่ได้ตั้ง จะใช้บัญชีเริ่มต้นสำหรับทดลองในเครื่อง  id: superadmin / password: admin"""
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")
    using_default = not email and not password
    if using_default and (os.getenv("PRODUCTION") or os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT")):
        print("⚠️  โหมดใช้งานจริง: ไม่สร้างแอดมินเริ่มต้น กรุณาตั้ง ADMIN_EMAIL / ADMIN_PASSWORD (อย่างน้อย 12 ตัว)")
        return
    if using_default:
        email, password = DEFAULT_ADMIN_ID, DEFAULT_ADMIN_PASSWORD
    elif not email or not password or len(password) < 12:
        raise RuntimeError("ตั้งค่า ADMIN_EMAIL และ ADMIN_PASSWORD (อย่างน้อย 12 ตัวอักษร) ให้ครบ")
    with _lock:
        db = _read()
        exist = next((u for u in db["users"] if u["email"] == email), None)
        if exist:
            if exist["role"] != "admin":
                raise RuntimeError("ADMIN_EMAIL ชนกับบัญชีผู้ใช้ทั่วไป กรุณาเลือกอีเมลอื่น")
        else:
            db["users"].append({"id": str(uuid.uuid4()), "name": "ผู้ดูแลระบบ", "email": email,
                                "passwordHash": hash_password(password), "role": "admin", "createdAt": _now()})
            _write(db)
            print("สร้างบัญชีแอดมินครั้งแรกเรียบร้อยแล้ว")
    if using_default:
        print("⚠️  กำลังใช้แอดมินเริ่มต้น (superadmin / admin) เหมาะกับทดลองในเครื่องเท่านั้น "
              "ก่อนเปิดให้คนอื่นใช้ ให้ตั้ง ADMIN_EMAIL / ADMIN_PASSWORD ใน backend/.env แล้วลบบัญชีนี้ใน storage/community.json")


# ───────────── ล็อกอินด้วย Google (Google Identity Services) ─────────────
def verify_google_token(credential: str) -> dict:
    """ตรวจ ID token กับ Google (tokeninfo) แล้วคืนข้อมูลผู้ใช้ — ต้องตั้ง GOOGLE_CLIENT_ID"""
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise ApiError(503, "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID ใน backend/.env")
    try:
        url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": credential})
        with urllib.request.urlopen(url, timeout=10) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except Exception:
        raise ApiError(401, "ตรวจสอบบัญชี Google ไม่สำเร็จ กรุณาลองใหม่")
    if info.get("aud") != client_id or info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ApiError(401, "โทเคน Google ไม่ถูกต้อง")
    if str(info.get("email_verified")).lower() != "true" or not info.get("email"):
        raise ApiError(401, "อีเมล Google ยังไม่ได้รับการยืนยัน")
    if float(info.get("exp", 0)) < time.time():
        raise ApiError(401, "โทเคน Google หมดอายุ")
    return info


# ───────────── Routes ─────────────
router = APIRouter()
TYPES = ["อัปเดตการปลูก", "ดินแห้ง", "น้ำไม่เพียงพอ", "พบโรคหรือแมลง", "เริ่มเก็บเกี่ยว", "ข้อเสนอแนะ"]
STATUSES = ["pending", "approved", "rejected"]


def _public_report(r: dict) -> dict:
    keys = ("id", "displayName", "district", "tambon", "village", "crop", "kind", "message", "createdAt", "fieldStatus", "updatedAt")
    return {k: r.get(k) for k in keys}


def _validate_report(b: dict) -> dict:
    def val(key: str, mx: int) -> str:
        v = b.get(key) if isinstance(b, dict) else None
        if v is not None and not isinstance(v, str):
            raise ApiError(400, f"ข้อมูล {key} ไม่ถูกต้อง")
        return (v or "").strip()[: mx + 1]
    district, tambon, village, crop, kind, message = (
        val("district", 80), val("tambon", 80), val("village", 80), val("crop", 80), val("kind", 60), val("message", 1200))
    if (not district or len(district) > 80 or len(tambon) > 80 or len(village) > 80 or len(crop) > 80
            or kind not in TYPES or len(message) < 5 or len(message) > 1200):
        raise ApiError(400, "กรุณาระบุอำเภอ ประเภทรายงาน และรายละเอียด 5–1200 ตัวอักษร")
    return {"district": district, "tambon": tambon, "village": village, "crop": crop, "kind": kind, "message": message}


@router.post("/api/auth/register", status_code=201)
def register(request: Request, body: dict = Body(...)):
    _limit(request)
    name = str(body.get("name") or "").strip()
    email = str(body.get("email") or "").strip().lower()
    password = body.get("password")
    if not 2 <= len(name) <= 80:
        raise ApiError(400, "ชื่อต้องยาว 2–80 ตัวอักษร")
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(email) > 150:
        raise ApiError(400, "อีเมลไม่ถูกต้อง")
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        raise ApiError(400, "รหัสผ่านต้องยาว 8–128 ตัวอักษร")
    pw_hash = hash_password(password)
    with _lock:
        db = _read()
        if any(u["email"] == email for u in db["users"]):
            raise ApiError(409, "อีเมลนี้ถูกใช้งานแล้ว")
        user = {"id": str(uuid.uuid4()), "name": name, "email": email, "passwordHash": pw_hash, "role": "user", "createdAt": _now()}
        db["users"].append(user)
        _write(db)
    return {"user": _public_user(user), "message": "สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ"}


@router.post("/api/auth/login")
def login(request: Request, body: dict = Body(...)):
    _limit(request)
    email = str(body.get("email") or "").strip().lower()
    password = body.get("password")
    with _lock:
        db = _read()
    user = next((u for u in db["users"] if u["email"] == email), None)
    if not user or not isinstance(password, str) or not verify_password(password, user["passwordHash"]):
        raise ApiError(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    token = secrets.token_hex(32)
    expiry = int(time.time() * 1000) + 7 * 86400000
    with _lock:
        db = _read()
        now = time.time() * 1000
        db["sessions"] = [s for s in db["sessions"] if s["expiry"] > now]
        db["sessions"].append({"tokenHash": _hash_token(token), "userId": user["id"], "expiry": expiry})
        _write(db)
    return {"token": token, "user": _public_user(user),
            "expiresAt": datetime.fromtimestamp(expiry / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")}


@router.get("/api/auth/config")
def auth_config():
    """บอก frontend ว่าเปิดปุ่ม Google ได้ไหม (มี GOOGLE_CLIENT_ID หรือไม่)"""
    return {"googleClientId": os.getenv("GOOGLE_CLIENT_ID", "").strip() or None}


@router.post("/api/auth/google")
def login_google(request: Request, body: dict = Body(...)):
    _limit(request)
    credential = body.get("credential")
    if not isinstance(credential, str) or not credential:
        raise ApiError(400, "ไม่พบข้อมูลบัญชี Google")
    info = verify_google_token(credential)
    email = str(info["email"]).strip().lower()
    name = (str(info.get("name") or email.split("@")[0]).strip() or "ผู้ใช้ Google")[:80]
    with _lock:
        db = _read()
        user = next((u for u in db["users"] if u["email"] == email), None)
        if not user:
            user = {"id": str(uuid.uuid4()), "name": name, "email": email, "passwordHash": "",
                    "role": "user", "provider": "google", "createdAt": _now()}
            db["users"].append(user)
        token = secrets.token_hex(32)
        expiry = int(time.time() * 1000) + 7 * 86400000
        now = time.time() * 1000
        db["sessions"] = [x for x in db["sessions"] if x["expiry"] > now]
        db["sessions"].append({"tokenHash": _hash_token(token), "userId": user["id"], "expiry": expiry})
        _write(db)
    return {"token": token, "user": _public_user(user),
            "expiresAt": datetime.fromtimestamp(expiry / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")}


@router.get("/api/auth/me")
def me(authorization: Optional[str] = Header(None)):
    return {"user": authenticated(authorization)}


@router.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    authenticated(authorization)
    th = _hash_token(authorization[7:])
    with _lock:
        db = _read()
        db["sessions"] = [s for s in db["sessions"] if s["tokenHash"] != th]
        _write(db)
    return {"ok": True}


@router.get("/api/community/posts")
def public_posts():
    with _lock:
        db = _read()
    posts = sorted((r for r in db["reports"] if r.get("moderation") == "approved"), key=lambda r: r["createdAt"], reverse=True)
    return {"posts": [_public_report(r) for r in posts]}


@router.get("/api/community/mine")
def my_posts(authorization: Optional[str] = Header(None)):
    user = authenticated(authorization)
    with _lock:
        db = _read()
    mine = sorted((r for r in db["reports"] if r.get("userId") == user["id"]), key=lambda r: r["createdAt"], reverse=True)
    return {"posts": [{**_public_report(r), "moderation": r.get("moderation"), "adminNote": r.get("adminNote", "")} for r in mine]}


@router.post("/api/community/posts", status_code=201)
def create_post(body: dict = Body(...), authorization: Optional[str] = Header(None)):
    user = authenticated(authorization)
    fields = _validate_report(body)
    now = _now()
    report = {"id": str(uuid.uuid4()), "userId": user["id"], "displayName": user["name"], **fields,
              "moderation": "pending", "fieldStatus": "รอตรวจสอบโดยผู้ดูแล", "adminNote": "", "createdAt": now, "updatedAt": now}
    with _lock:
        db = _read()
        db["reports"].append(report)
        _write(db)
    return {"post": {**_public_report(report), "moderation": "pending"}, "message": "ส่งให้ผู้ดูแลตรวจสอบแล้ว"}


@router.get("/api/admin/reports")
def admin_reports(authorization: Optional[str] = Header(None)):
    require_admin(authorization)
    with _lock:
        db = _read()
    return {"reports": [{k: v for k, v in r.items() if k != "userId"} for r in reversed(db["reports"])]}


@router.patch("/api/admin/reports/{report_id}")
def admin_moderate(report_id: str, body: dict = Body(...), authorization: Optional[str] = Header(None)):
    user = require_admin(authorization)
    if not re.fullmatch(r"[a-fA-F0-9-]+", report_id):
        raise ApiError(404, "ไม่พบรายงาน")
    if body.get("moderation") not in STATUSES:
        raise ApiError(400, "สถานะการตรวจสอบไม่ถูกต้อง")
    field_status = str(body.get("fieldStatus") or "").strip()
    note = str(body.get("adminNote") or "").strip()
    if len(field_status) > 160 or len(note) > 500:
        raise ApiError(400, "ข้อความสถานะหรือหมายเหตุยาวเกินไป")
    mod = body["moderation"]
    with _lock:
        db = _read()
        r = next((x for x in db["reports"] if x["id"] == report_id), None)
        if not r:
            raise ApiError(404, "ไม่พบรายงาน")
        r["moderation"] = mod
        r["fieldStatus"] = field_status or ("เผยแพร่แล้ว" if mod == "approved" else "ไม่ผ่านการตรวจสอบ" if mod == "rejected" else "รอตรวจสอบโดยผู้ดูแล")
        r["adminNote"] = note
        r["updatedAt"] = _now()
        r["moderatedBy"] = user["id"]
        _write(db)
    return {"report": _public_report(r)}
