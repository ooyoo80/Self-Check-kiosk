from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import uuid
import sqlite3
import bcrypt

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
    allow_methods=["*"],  # 모든 HTTP 메서드(GET, POST 등) 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

# 3. 요청 데이터 검증 모델 (Pydantic)
class LogRequest(BaseModel) :
    target_barcode: str
    consent_agreed: bool
    scanned_id_info: str | None = None
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
    # 1. DB에서 해당 아이디의 관리자 찾기
    admin = conn.execute(
        "SELECT * FROM admins WHERE username = ?", (login_data.username,)
    ).fetchone()
    conn.close()

    if not admin:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다.")
    

    # 2. 비밀번호 검증 (DB의 해시값과 입력값 비교)
    # admin['password_hash']는 database.py에서 만든 1234의 해시값
    if bcrypt.checkpw(login_data.password.encode('utf-8'), admin['password_hash'].encode('utf-8')):
        print(f"🔓 [로그인 성공] 관리자: {login_data.username}")
        return {
            "status": "success",
            "message": "로그인에 성공했습니다.",
            "access_token": "fake-jwt-token-v2", # 나중에 진짜 JWT로 교체 예정
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

    # 1. 토큰 검사 (Security Check)

    # 프론트엔드가 보낸 암호가 우리가 발급한 것과 맞는지 확인

    if authorization != "Bearer fake-jwt-token-v2":

        print(f"🚫 [접근 거부] 잘못된 토큰: {authorization}")

        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

   

    conn = get_db_connection()



    # 2. 최신순으로 정렬해서 가져오기

    rows = conn.execute("SELECT * FROM consent_logs ORDER BY timestamp DESC").fetchall()

    conn.close()



    # 3. 데이터 변환 (SQLite Row -> Dictionary List)

    logs = [dict(row) for row in rows]



    print(f"📋 [관리자 조회] 로그 {len(logs)}개 전송 완료")

    return {

        "status": "success",

        "data": logs

    }