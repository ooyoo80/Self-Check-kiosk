from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import sqlite3
import bcrypt

# database.py에서 함수 가져오기
from database import init_db, get_db_connection

app = FastAPI()

# 1. 서버 시작 시 DB 확인 (테이블 없으면 생성)
init_db()

# 2. CORS 설정
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 요청 데이터 검증 모델 (Pydantic)
class LogRequest(BaseModel):
    target_barcode: str
    consent_agreed: bool
    scanned_id_info: str | None = None
    total_amount: int

# 응답 모델 (참고용, 실제 적용은 유연하게 처리)
class LogResponse(LogRequest):
    id: int
    timestamp: str

# ==========================
# 🛍️ 상품 조회 API (GET)
# ==========================
@app.get("/api/products/{barcode}")
def scan_product(barcode: str):
    conn = get_db_connection()
    product = conn.execute("SELECT * FROM products WHERE barcode = ?", (barcode,)).fetchone()
    conn.close()

    if product:
        print(f"🔎 [상품 발견] {product['name']} ({product['price']}원)")
        return {
            "status": "success",
            "data": {
                "name": product["name"],
                "price": product["price"],
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
        cursor = conn.cursor()
        
        # [수정됨] id는 자동증가, timestamp는 자동입력이므로 
        # target_barcode, consent_agreed, scanned_id_info, total_amount 만 넣어줍니다.
        cursor.execute(
            "INSERT INTO consent_logs (target_barcode, consent_agreed, scanned_id_info, total_amount) VALUES (?, ?, ?, ?)",
            (
                log_data.target_barcode,
                log_data.consent_agreed,
                log_data.scanned_id_info,
                log_data.total_amount
            )
        )
        conn.commit()
        
        # 방금 저장된 ID 가져오기 (마지막 row id)
        last_id = cursor.lastrowid
        conn.close()

        print(f"✅ [로그 저장 완료] DB ID: {last_id}, 금액: {log_data.total_amount}원")
        return {
            "status": "success",
            "message": "Log saved",
            "log_id": last_id
        }
        
    except Exception as e:
        print(f"🔥 [에러 발생] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 4. 로그인 요청 데이터 모델
class LoginRequest(BaseModel):
    username: str
    password: str

# ==========================
# 🔑 관리자 로그인 API (POST)
# ==========================
@app.post("/api/admin/login")
def admin_login(login_data: LoginRequest):
    conn = get_db_connection()
    admin = conn.execute(
        "SELECT * FROM admins WHERE username = ?", (login_data.username,)
    ).fetchone()
    conn.close()

    if not admin:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다.")
    
    # 비밀번호 검증
    if bcrypt.checkpw(login_data.password.encode('utf-8'), admin['password_hash'].encode('utf-8')):
        print(f"🔓 [로그인 성공] 관리자: {login_data.username}")
        return {
            "status": "success",
            "message": "로그인에 성공했습니다.",
            "access_token": "fake-jwt-token-v2",
            "token_type": "bearer"
        }
    else:
        print(f"🔒 [로그인 실패] 관리자: {login_data.username}")
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다.")

# ==========================
# 📋 관리자 로그 조회 API (GET)
# ==========================
@app.get("/api/admin/logs")
def get_logs(authorization: str = Header(None)):
    # 1. 토큰 검사
    if authorization != "Bearer fake-jwt-token-v2":
        print(f"🚫 [접근 거부] 잘못된 토큰: {authorization}")
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    
    conn = get_db_connection()

    # 2. 최신순(ID 내림차순)으로 정렬해서 가져오기
    # timestamp보다 id 정렬이 성능상 더 좋고 확실합니다.
    rows = conn.execute("SELECT * FROM consent_logs ORDER BY id DESC").fetchall()
    conn.close()

    # 3. 데이터 변환
    logs = [dict(row) for row in rows]

    print(f"📋 [관리자 조회] 로그 {len(logs)}개 전송 완료")
    
    # 프론트엔드가 { "status": ..., "data": [...] } 형태를 기대하므로 맞춰줍니다.
    return {
        "status": "success",
        "data": logs
    }