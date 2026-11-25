# ลำปาง · ปลูกดี — แผนที่ตำบลแบ่งเขตจริง + React Dashboard + Admin

## โครงสร้าง
- `frontend/` — React + Vite; หน้าแผนที่ 13 อำเภอ คลิกอำเภอเพื่อดูรูปทรงตำบล, วิเคราะห์ดิน (เรียกโมเดล), คู่มือพืช, Dashboard, ข้อจำกัด, ชุมชน, สมัครสมาชิก, หน้าผู้ดูแล และแชตมุมขวาล่าง
- `backend/` — Python (FastAPI) โฟลเดอร์เดียวทั้งหมด: `main.py` (โมเดลแนะนำพืช + แชต) และ `community.py` (สมาชิก / รายงานชุมชน / แอดมิน เก็บเป็นไฟล์ JSON ใน `backend/storage/`)

## เริ่มใช้งาน (Python >= 3.9, Node.js >= 22)
เปิด Terminal 2 หน้าต่างจากโฟลเดอร์ราก

```bash
# Terminal A — Backend
cd backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --port 8000

# Terminal B — Frontend
npm --prefix frontend install
npm run dev:frontend
```
เปิด http://localhost:5173 (Backend + เอกสาร API: http://localhost:8000/docs)

Vite ตั้ง proxy จาก `/api` ไป `http://127.0.0.1:8000` จึงไม่ต้องแก้ URL ในเครื่องเดียวกัน

## แอดมิน และการล็อกอิน
- **แอดมินเริ่มต้น (ทดลองในเครื่อง):** id `superadmin` · password `admin` สร้างให้อัตโนมัติเมื่อรัน backend ครั้งแรก ช่องล็อกอินรับทั้งอีเมลและชื่อผู้ใช้
- **ก่อนเปิดให้คนอื่นใช้:** คัดลอก `backend/.env.example` เป็น `backend/.env` แล้วตั้ง `ADMIN_EMAIL` / `ADMIN_PASSWORD` (อย่างน้อย 12 ตัวอักษร) และลบบัญชี superadmin ออกจาก `backend/storage/community.json`
- **ล็อกอินด้วย Google:** สร้าง OAuth Client ID (Web application) ที่ Google Cloud Console ใส่ `http://localhost:5173` ใน Authorized JavaScript origins แล้วตั้ง `GOOGLE_CLIENT_ID=...` ใน `backend/.env` ปุ่ม Google จะโผล่ในหน้าเข้าสู่ระบบเอง (ถ้าไม่ตั้ง ปุ่มจะไม่แสดง)

> บัญชีที่สมัครหรือเข้าด้วย Google มีสิทธิ์ `user` เสมอ รหัสผ่านแฮชด้วย scrypt

## แผนที่เจาะลึกตำบลจริง (ตรงตามภาพตัวอย่าง)

**หน้าแรก:** แสดงแผนที่จังหวัดลำปาง 13 อำเภอเหมือนเดิม เมื่อกดอำเภอ หน้าจอจะแสดงแผนที่ **รูปทรงแยกตามตำบลภายในอำเภอนั้น** มีสีคั่นแต่ละตำบล, เส้นขอบ, ชื่อตำบล, การคลิกบนรูปทรงหรือในรายการเพื่อดูข้อมูลด้านขวา และปุ่มกลับไปยังแผนที่จังหวัด

ข้อมูลขอบเขตไม่ได้วาดขึ้นเองจากภาพตัวอย่าง แต่ใช้ **GeoThai/boundaries v2026.10.23** ซึ่งสร้างจาก OCHA COD-AB / Royal Thai Survey Department และรหัส/ชื่อที่มาจากทะเบียน GeoThai/data ชุดเส้นอ้างอิงปี 2022 **สีแต่ละตำบลใช้แยกพื้นที่เท่านั้น ไม่ใช่สีตามคุณสมบัติดิน**

แผนที่เริ่มจากอ่านไฟล์ `frontend/public/data/lampang-subdistricts.topojson` ถ้ายังไม่มีไฟล์ จะลองโหลดจาก CDN แล้ว fallback ไปยัง raw GitHub ให้ (จึงต้องมีอินเทอร์เน็ตในการเปิดแผนที่ครั้งแรก)

### เพื่อให้แผนที่ทำงานออฟไลน์ / ไม่ต้องพึ่ง CDN

บนเครื่องที่เชื่อมอินเทอร์เน็ต รันในโฟลเดอร์หลัก:

```bash
npm run map:download
```

สคริปต์จะดาวน์โหลดไฟล์ TopoJSON เฉพาะจังหวัดลำปางมาไว้ที่ `frontend/public/data/lampang-subdistricts.topojson` โดยอัตโนมัติ และ Vite จะเสิร์ฟจากไฟล์นี้เป็นอันดับแรก สามารถดาวน์โหลดด้วยตนเองจาก:

https://cdn.jsdelivr.net/gh/GeoThai/boundaries@v2026.10.23/datawrapper/subdistricts/52.topojson

ดาวน์โหลดเป็น `lampang-subdistricts.topojson` แล้ววางที่ `frontend/public/data/` โดยตรง

### เชื่อมค่าดิน/ข้อมูลพืชกับรูปทรงตำบล

รูปทรงและชื่ออยู่ในชุดแผนที่ ส่วนค่าดิน, ค่า pH, การระบายน้ำ, แหล่งน้ำ และพืชที่เหมาะสม **ไม่มีใน GeoThai** ต้องนำ Data ของคุณเข้ามาเองผ่านหน้า `ข้อมูลตำบล` หรือ `frontend/public/data/tambons.json` โดยใช้ `province,district,tambon` และข้อมูลอื่นตาม template (`frontend/public/templates/tambons-template.csv`) แนะนำให้ใช้รหัส `id` หกหลักที่ตรงกับ GeoThai เพื่อจับคู่แน่นอน ตัวอย่างโครงสร้าง (ไม่ใช่ข้อมูลจริง):

```json
[
  {"id":"520101","province":"ลำปาง","district":"เมืองลำปาง","tambon":"เวียงเหนือ","soilType":"ค่าจากการสำรวจ","ph":"ค่าจากการตรวจวัด","drainage":"ค่าจากการสำรวจ","water":"ค่าจากการสำรวจ","crops":["ข้าว"],"source":"แหล่งข้อมูลของคุณ","updatedAt":"2026-11-18"}
]
```

ในตัวอย่าง JSON ตัวเลขและชนิดดินเป็นช่องข้อความตัวอย่าง ไม่ใช่ผลวิเคราะห์จริงของพื้นที่ หากไม่มีข้อมูล ระบบจะแสดงชื่อ/ขอบเขตตำบลและข้อความ **ยังไม่มีข้อมูลสภาพดิน** โดยไม่อ้างค่าดินจากอำเภอแทนตำบล

การนำเข้าไฟล์ผ่านหน้าเว็บเก็บใน state ของ React จะหายเมื่อ Refresh สำหรับข้อมูลถาวรให้บันทึกใน `public/data` หรือเปลี่ยนเป็น API ของ Backend (`VITE_AGRI_SOURCE=api`). ข้อมูล **ชุมชน/หมู่บ้าน** ต้องมีฐานข้อมูลแยก เพราะเส้นแบ่งการปกครองชุดนี้สิ้นสุดแค่ระดับตำบล

**อ้างอิง / License:** [GeoThai/boundaries](https://github.com/GeoThai/boundaries) — GeoThai, from OCHA COD-AB and Royal Thai Survey Department, CC BY 3.0 IGO; ชื่อและรหัสจาก [GeoThai/data](https://github.com/GeoThai/data), CC BY 4.0. เส้นจากปี 2022 อาจไม่ครอบคลุมการปรับเขตการปกครองล่าสุดทุกกรณี โปรดตรวจสอบกับกรมการปกครองก่อนใช้ในงานที่มีผลทางกฎหมาย

## Dashboard
- เลือกโหมด `เปรียบเทียบสภาพดิน` หรือ `เปรียบเทียบการเพาะปลูก`
- กรองระดับอำเภอ/ตำบล จังหวัด พืช ปี ตัวชี้วัด แล้วเปรียบเทียบสองพื้นที่
- ค่า pH เฉลี่ยคำนวณเฉพาะระเบียนที่มีค่าตัวเลขเดี่ยว เช่น 6.1; ช่วงค่า pH ไม่ถูกเฉลี่ย
- สถิติการเพาะปลูกต้องมีหน่วย ปี และระดับรวมข้อมูลที่ตรงกัน ป้องกันการรวมแถวที่ซ้ำซ้อน
- เมื่อไม่มีข้อมูลจริง หน้าจอจะแจ้งให้ import; กราฟข้อมูลสาธิตของการเพาะปลูกเป็นโหมดทดลองแยกต่างหาก

## API บัญชีและรายงาน
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `POST /api/community/posts` (ต้อง Login), `GET /api/community/mine` (ต้อง Login), `GET /api/community/posts` (เฉพาะ approved)
- `GET /api/admin/reports`, `PATCH /api/admin/reports/:id` (ต้องเป็น admin)

## ข้อจำกัดระบบบัญชีปัจจุบัน
- ข้อมูลสมาชิกและรายงานเก็บใน `backend/storage/community.json` (สร้างอัตโนมัติ ไม่ควร commit) เหมาะสำหรับ **ทดลองในเครื่อง** ไม่เหมาะกับระบบ production/multi-server
- เซสชันใช้ bearer token อายุ 7 วัน เก็บใน sessionStorage ฝั่ง Frontend ต้นแบบ; ยังไม่มี HTTP-only secure cookies, email verification, password reset, CAPTCHA, audit log หรือฐานข้อมูลที่รองรับหลายเครื่อง
- การ rate limit เป็นแบบพื้นฐานในหน่วยความจำและต้องเสริมก่อนเปิดเว็บสาธารณะ
- ใช้ HTTPS, ระบบสำรองข้อมูลจริง, การจัดการข้อมูลส่วนบุคคล, ระบบป้องกันสแปมและการกลั่นกรองที่เหมาะสมก่อนเผยแพร่จริง
- การอนุมัติของแอดมินเป็นการ **อนุมัติเผยแพร่ข้อความ** ไม่ใช่หลักฐานว่าข้อมูลสภาพดินถูกต้องตามวิทยาศาสตร์

## ส่วนเดิมที่ยังอยู่
หน้าแรกเดิม, สีธีม, แผนที่ SVG 13 อำเภอ, พืชตัวอย่าง, แชต AI แบบ Floating มุมขวาล่าง และโครง API ข้อมูล/แชตเดิม

## ตรวจสอบที่ทำแล้ว
- ตรวจ syntax ของ JavaScript ส่วนแปลง TopoJSON ด้วย Node.js และตรวจโครงสร้าง import ใน JSX
- ทดสอบ Backend ผ่าน HTTP: สมัครสมาชิก, เข้าสู่ระบบ, ปฏิเสธคนไม่ได้ Login, ส่งรายงาน pending, ซ่อนรายงานก่อนอนุมัติ, ป้องกันผู้ใช้ทั่วไปเข้าหน้า admin, admin อนุมัติและปรับสถานะ, แสดงรายงานที่อนุมัติแล้ว
- ยังไม่สามารถยืนยัน Vite production build ในสภาพแวดล้อมที่สร้าง ZIP เนื่องจากดาวน์โหลด dependency npm ได้ไม่ครบ ควร `npm install` และ `npm run build` บนเครื่องของคุณก่อน deploy
- ทดสอบด้วยข้อมูล TopoJSON จำลองด้านโครงสร้างได้ แต่ยังไม่ได้ทดสอบไฟล์ GeoThai ฉบับจริงแบบออฟไลน์ในสภาพแวดล้อมนี้ จึงมี fallback error ที่บอกขั้นตอนนำเข้าไฟล์แผนที่อย่างชัดเจน
# lampangProject2
