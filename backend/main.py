from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import uuid
import sqlite3

# database.py에서 함수 가져오기
from database import init_db, get_db_connection

app = FastAPI()

# 1. 서버 시작 시 DB 확인 (테이블 없으면 생성)
init_db()

# 2. CORS 설정 (프론트엔드 연동 준비)
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 요청 데이터 검증 모델 (Pydantic)
class LogRequest(BaseModel) :
    target_barcode: str
    consent_agreed: bool
    scanned_id_info: str
    total_amount: int

# ==========================
# 🛍️ 상품 조회 API (GET)
# ==========================
@app.get("/api/products/{barcode}")
def scan_product(barcode: str):
    conn = get_db_connection()
    # DB에서 바코드로 상품 찾기
    product = conn.execute("SELECT * FROM products WHERE barcode = ?", (barcode,)).fetchone()
    conn.close()

    if product:
        print(f"🔎 [상품 발견] {product['name']} ({product['price']}원)")
        return {
            "status": "success",
            "data": {
                "name": product["name"],
                "price": product["price"],
                # 프론트엔드는 isAlcohol(camelCase)를 기대하므로 변환해서 전달
                "isAlcohol": bool(product["is_alcohol"])
            }
        }
    else:
        print(f"❌ [상품 없음] 바코드: {barcode}")
        return {
            "status": "fail",
            "message": "등록되지 않은 상품입니다."
        }
    

# ==========================
# 📝 결제 로그 저장 API (POST)
# ==========================
@app.post("/api/logs")
def save_log(log_data: LogRequest):
    try:
        conn = get_db_connection()
        log_id = str(uuid.uuid4()) # 고유 ID 생성
        
        # DB에 저장 (SQL Injection 방지를 위해 ? 사용)
        conn.execute(
            "INSERT INTO consent_logs (log_id, timestamp, target_barcode, consent_agreed, scanned_id_info, total_amount) VALUES (?, ?, ?, ?, ?, ?)",
            (
                log_id,
                datetime.now().isoformat(),
                log_data.target_barcode,
                log_data.consent_agreed,
                log_data.scanned_id_info,
                log_data.total_amount
            )
        )
        conn.commit() # 저장 확정
        conn.close()

        print(f"✅ [로그 저장 완료] ID: {log_id}, 금액: {log_data.total_amount}원")
        return {
            "status": "success",
            "message": "Log saved",
            "log_id": log_id
        }
        
    except Exception as e:
        print(f"🔥 [에러 발생] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))