# Backend (Python / FastAPI) — โมเดลแนะนำความเหมาะสมของพืช จ.ลำปาง
    pip install -r requirements.txt
    uvicorn main:app --host 127.0.0.1 --port 8000
เปิด http://127.0.0.1:8000/docs เพื่อลองเรียก API (ครั้งแรกจะฝึกโมเดลเอง ~6 วินาที แล้วเก็บ model.joblib)

| Endpoint | หน้าที่ |
|---|---|
| GET /api/health | เช็กสถานะ |
| GET /api/model/info, /api/model/options | ข้อมูลโมเดล, ตัวเลือกฟอร์ม |
| POST /api/predict | ใส่ดิน/ฝน -> คะแนน 10 พืชเรียงอันดับ |
| GET /api/tambons?amphoe= | พืชอันดับ 1–3 ของทุกตำบล |
| GET /api/tambons/suitability?amphoe=&tambon= | คะแนน 10 พืชของตำบล + สัดส่วนพื้นที่ที่เหมาะ |
| POST /api/chat | ตอบแชตจากผลโมเดล (พิมพ์ชื่ออำเภอ) |

เชื่อม frontend: ใน frontend/vite.config.js ตั้ง proxy `/api` -> http://127.0.0.1:8000
(ระบบสมาชิก/ชุมชนของ Node ใช้ /api/auth และ /api/community ต้องแยก proxy ถ้าจะรันทั้งสองพร้อมกัน)
