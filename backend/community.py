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

import base64

from fastapi import APIRouter, Body, Header, Request
from fastapi.responses import FileResponse

STORE_FILE = Path(os.getenv("COMMUNITY_DATA_FILE", Path(__file__).parent / "storage" / "community.json"))
_lock = threading.RLock()
UPLOAD_DIR = Path(os.getenv("COMMUNITY_UPLOAD_DIR", STORE_FILE.parent / "uploads"))
AVATAR_DIR = Path(os.getenv("COMMUNITY_AVATAR_DIR", STORE_FILE.parent / "avatars"))
MAX_IMAGES = 3
MAX_IMAGE_BYTES = 2 * 1024 * 1024  # ต่อรูป (หน้าเว็บย่อรูปก่อนส่งแล้ว)


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


def _avatar_url(u: Optional[dict]) -> Optional[str]:
    name = (u or {}).get("avatar")
    return f"/api/auth/avatars/{name}" if isinstance(name, str) and name else None


def _public_user(u: dict) -> dict:
    # hasPassword = False สำหรับบัญชีที่สมัครผ่าน Google (ยังไม่มีรหัสผ่านให้เปลี่ยน)
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"],
            "avatar": _avatar_url(u), "hasPassword": bool(u.get("passwordHash"))}


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


def _image_urls(r: dict) -> list:
    return [f"/api/community/images/{n}" for n in (r.get("images") or []) if isinstance(n, str)]


def _public_report(r: dict, avatars: Optional[dict] = None) -> dict:
    keys = ("id", "displayName", "district", "tambon", "village", "crop", "kind", "message", "createdAt", "fieldStatus", "updatedAt")
    out = {k: r.get(k) for k in keys}
    out["isLocal"] = r.get("isLocal")          # None = รายงานเก่าที่ไม่มีข้อมูลนี้
    out["images"] = _image_urls(r)
    out["authorAvatar"] = (avatars or {}).get(r.get("userId"))
    return out


def _avatar_map(db: dict) -> dict:
    return {u["id"]: _avatar_url(u) for u in db["users"] if u.get("avatar")}


# รูปที่แนบ: รับเป็น data URL (JSON) ตรวจชนิดไฟล์จาก magic bytes แล้วเก็บเป็นไฟล์ใน storage/uploads
_IMAGE_TYPES = {"image/jpeg": ("jpg", (b"\xff\xd8\xff",)), "image/png": ("png", (b"\x89PNG\r\n\x1a\n",)), "image/webp": ("webp", (b"RIFF",))}
_IMAGE_NAME = re.compile(r"[0-9a-f]{32}\.(jpg|png|webp)")


def _decode_images(raw) -> list:
    if raw in (None, []):
        return []
    if not isinstance(raw, list) or len(raw) > MAX_IMAGES:
        raise ApiError(400, f"แนบรูปได้ไม่เกิน {MAX_IMAGES} รูป")
    out = []
    for item in raw:
        m = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)", item) if isinstance(item, str) else None
        if not m:
            raise ApiError(400, "ไฟล์รูปไม่ถูกต้อง (รองรับ JPG, PNG, WebP)")
        try:
            data = base64.b64decode(m.group(2), validate=True)
        except ValueError:
            raise ApiError(400, "ไฟล์รูปเสียหาย")
        ext, magics = _IMAGE_TYPES[m.group(1)]
        if len(data) > MAX_IMAGE_BYTES:
            raise ApiError(400, "รูปมีขนาดใหญ่เกินไป")
        if not any(data.startswith(x) for x in magics) or (ext == "webp" and data[8:12] != b"WEBP"):
            raise ApiError(400, "ไฟล์ที่แนบไม่ใช่รูปภาพ")
        out.append((ext, data))
    return out


def _save_images(images: list) -> list:
    if not images:
        return []
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    names = []
    for ext, data in images:
        name = f"{uuid.uuid4().hex}.{ext}"
        (UPLOAD_DIR / name).write_bytes(data)
        names.append(name)
    return names


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
    is_local = b.get("isLocal")
    if is_local is not None and not isinstance(is_local, bool):
        raise ApiError(400, "ข้อมูลคนในพื้นที่ไม่ถูกต้อง")
    return {"district": district, "tambon": tambon, "village": village, "crop": crop, "kind": kind, "message": message,
            "isLocal": bool(is_local)}


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


# ───────────── โปรไฟล์ผู้ใช้ (ชื่อที่แสดง / รูปโปรไฟล์ / รหัสผ่าน) ─────────────
# ทุก endpoint ใช้ user id จากโทเคนที่ตรวจแล้วเท่านั้น จึงแก้ได้เฉพาะบัญชีของตัวเอง · อีเมลเปลี่ยนไม่ได้
_NAME_OK = re.compile(r"[A-Za-z0-9\u0E00-\u0E7F .\-_]+")
MAX_AVATAR_BYTES = 2 * 1024 * 1024
_AVATAR_NAME = re.compile(r"[0-9a-f]{32}\.(jpg|png|webp)")


def _norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip().casefold()


def _session_user(db: dict, authorization: Optional[str]) -> dict:
    """คืน dict ผู้ใช้ตัวจริงใน db (ใช้แก้ไขข้อมูล) จากโทเคนที่ผ่านการตรวจแล้ว"""
    me = authenticated(authorization)
    user = next((u for u in db["users"] if u["id"] == me["id"]), None)
    if not user:
        raise ApiError(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
    return user


@router.patch("/api/auth/profile")
def update_profile(body: dict = Body(...), authorization: Optional[str] = Header(None)):
    authenticated(authorization)                     # ตรวจสิทธิ์ก่อนตรวจข้อมูลเสมอ
    name = re.sub(r"\s+", " ", str(body.get("name") or "")).strip()
    if not 2 <= len(name) <= 80:
        raise ApiError(400, "ชื่อต้องยาว 2–80 ตัวอักษร")
    if not _NAME_OK.fullmatch(name):
        raise ApiError(400, "ชื่อใช้ได้เฉพาะภาษาไทย ภาษาอังกฤษ ตัวเลข เว้นวรรค และ . - _")
    with _lock:
        db = _read()
        user = _session_user(db, authorization)
        if any(u["id"] != user["id"] and _norm_name(u.get("name", "")) == _norm_name(name) for u in db["users"]):
            raise ApiError(409, "ชื่อนี้มีผู้ใช้งานแล้ว กรุณาเลือกชื่ออื่น")
        if name != user["name"]:
            user["name"] = name
            user["updatedAt"] = _now()
            for r in db["reports"]:              # ชื่อบนรายงานเดิมของผู้ใช้คนนี้ (ผูกด้วย userId)
                if r.get("userId") == user["id"]:
                    r["displayName"] = name
            _write(db)
    return {"user": _public_user(user), "message": "บันทึกชื่อเรียบร้อยแล้ว"}


@router.post("/api/auth/avatar")
def upload_avatar(body: dict = Body(...), authorization: Optional[str] = Header(None)):
    authenticated(authorization)
    decoded = _decode_images([body.get("image")])
    ext, data = decoded[0]
    if len(data) > MAX_AVATAR_BYTES:
        raise ApiError(400, "รูปโปรไฟล์ต้องมีขนาดไม่เกิน 2 MB")
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    (AVATAR_DIR / name).write_bytes(data)
    with _lock:
        db = _read()
        user = _session_user(db, authorization)
        old = user.get("avatar")
        user["avatar"] = name
        user["updatedAt"] = _now()
        _write(db)
    if old and _AVATAR_NAME.fullmatch(old):
        (AVATAR_DIR / old).unlink(missing_ok=True)
    return {"user": _public_user(user), "message": "เปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว"}


@router.delete("/api/auth/avatar")
def delete_avatar(authorization: Optional[str] = Header(None)):
    with _lock:
        db = _read()
        user = _session_user(db, authorization)
        old = user.pop("avatar", None)
        user["updatedAt"] = _now()
        _write(db)
    if old and _AVATAR_NAME.fullmatch(old):
        (AVATAR_DIR / old).unlink(missing_ok=True)
    return {"user": _public_user(user), "message": "ลบรูปโปรไฟล์แล้ว"}


@router.get("/api/auth/avatars/{name}")
def avatar_file(name: str):
    if not _AVATAR_NAME.fullmatch(name) or not (AVATAR_DIR / name).is_file():
        raise ApiError(404, "ไม่พบรูป")
    media = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}[name.rsplit(".", 1)[1]]
    return FileResponse(AVATAR_DIR / name, media_type=media,
                        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"})


@router.post("/api/auth/password")
def change_password(request: Request, body: dict = Body(...), authorization: Optional[str] = Header(None)):
    _limit(request)
    authenticated(authorization)                     # ตรวจสิทธิ์ก่อนตรวจข้อมูลเสมอ
    current, new = body.get("currentPassword"), body.get("newPassword")
    if not isinstance(new, str) or not 8 <= len(new) <= 128:
        raise ApiError(400, "รหัสผ่านใหม่ต้องยาว 8–128 ตัวอักษร")
    with _lock:
        db = _read()
        user = _session_user(db, authorization)
    if not user.get("passwordHash"):
        raise ApiError(400, "บัญชีนี้เข้าสู่ระบบด้วย Google จึงไม่มีรหัสผ่านให้เปลี่ยน")
    if not isinstance(current, str) or not verify_password(current, user["passwordHash"]):
        raise ApiError(400, "รหัสผ่านปัจจุบันไม่ถูกต้อง")
    if verify_password(new, user["passwordHash"]):
        raise ApiError(400, "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม")
    new_hash = hash_password(new)
    token = secrets.token_hex(32)
    expiry = int(time.time() * 1000) + 7 * 86400000
    with _lock:
        db = _read()
        user = next(u for u in db["users"] if u["id"] == user["id"])
        user["passwordHash"] = new_hash
        user["updatedAt"] = _now()
        # ออกจากระบบทุกอุปกรณ์ของบัญชีนี้ แล้วออกโทเคนใหม่ให้เครื่องที่เปลี่ยนรหัส
        db["sessions"] = [s for s in db["sessions"] if s["userId"] != user["id"]]
        db["sessions"].append({"tokenHash": _hash_token(token), "userId": user["id"], "expiry": expiry})
        _write(db)
    return {"token": token, "user": _public_user(user), "message": "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว อุปกรณ์อื่นถูกออกจากระบบ"}


@router.get("/api/community/posts")
def public_posts():
    with _lock:
        db = _read()
    posts = sorted((r for r in db["reports"] if r.get("moderation") == "approved"), key=lambda r: r["createdAt"], reverse=True)
    avatars = _avatar_map(db)
    return {"posts": [_public_report(r, avatars) for r in posts]}


@router.get("/api/community/mine")
def my_posts(authorization: Optional[str] = Header(None)):
    user = authenticated(authorization)
    with _lock:
        db = _read()
    mine = sorted((r for r in db["reports"] if r.get("userId") == user["id"]), key=lambda r: r["createdAt"], reverse=True)
    avatars = _avatar_map(db)
    return {"posts": [{**_public_report(r, avatars), "moderation": r.get("moderation"), "adminNote": r.get("adminNote", "")} for r in mine]}


@router.post("/api/community/posts", status_code=201)
def create_post(body: dict = Body(...), authorization: Optional[str] = Header(None)):
    user = authenticated(authorization)
    fields = _validate_report(body)
    images = _decode_images(body.get("images"))
    fields["images"] = _save_images(images)
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
    avatars = _avatar_map(db)
    return {"reports": [{**{k: v for k, v in r.items() if k != "userId"}, "images": _image_urls(r), "authorAvatar": avatars.get(r.get("userId"))}
                        for r in reversed(db["reports"])]}


@router.get("/api/community/images/{name}")
def report_image(name: str):
    """รูปที่แนบกับรายงาน (ชื่อไฟล์สุ่ม เดาไม่ได้ · ตรวจรูปแบบชื่อเพื่อกัน path traversal)"""
    if not _IMAGE_NAME.fullmatch(name):
        raise ApiError(404, "ไม่พบรูป")
    path = UPLOAD_DIR / name
    if not path.is_file():
        raise ApiError(404, "ไม่พบรูป")
    media = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}[name.rsplit(".", 1)[1]]
    return FileResponse(path, media_type=media, headers={"Cache-Control": "public, max-age=604800", "X-Content-Type-Options": "nosniff"})


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
