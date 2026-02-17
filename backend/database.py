import sqlite3
import os
import bcrypt  # pip install bcrypt 필요
import json

# DB 파일 생성될 경로 (backend 폴더 내부)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'kiosk.db')
PRODUCTS_JSON_PATH = os.path.join(BASE_DIR, "products.json")

def get_db_connection():
    """DB 연결을 반환하는 함수"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 컬럼명으로 데이터에 접근 가능하게 설정
    return conn

def init_db():
    print(f"📂 데이터베이스 경로: {DB_PATH}")
    conn = get_db_connection()
    cursor = conn.cursor()

    # ---------------------------------------------------------
    # 1. 테이블 생성
    # ---------------------------------------------------------
    
    # (1) Products 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            barcode TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            is_alcohol BOOLEAN NOT NULL
        )
    ''')

    # (2) ConsentLogs 테이블 (total_amount 포함)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS consent_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,   -- log_id 말고 id로 해야 합니다!
            target_barcode TEXT NOT NULL,
            consent_agreed BOOLEAN NOT NULL,
            scanned_id_info TEXT,                   -- NULL 허용 (필수가 아닐 수 있음)
            total_amount INTEGER,                   -- 이것 때문에 에러 났었죠! (필수)
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP -- 자동으로 시간 입력
        )
    ''')

    # (3) Admins 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # ---------------------------------------------------------
    # 2. 초기 데이터 심기 (Seeding)
    # ---------------------------------------------------------

    # [Seed 1] 관리자 계정 (admin / 1234)
    cursor.execute("SELECT * FROM admins WHERE username = 'admin'")
    if not cursor.fetchone() :
        # 비밀번호 암호화 (Hash)
        password_bytes = b"1234"
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)
        # DB에는 byte가 아닌 string 형태로 저장
        hashed_str = hashed.decode('utf-8')

        cursor.execute("INSERT INTO admins (username, password_hash) VALUES (?, ?)", ('admin', hashed_str))
        print("✅ 관리자 계정 생성 완료 (ID: admin / PW: 1234)")
    
    else: 
        print("ℹ️ 관리자 계정이 이미 존재합니다.")
    
    # [Seed 2] 상품 데이터 (products.json 파일이 있으면 읽어서 넣기)
    cursor.execute("SELECT count(*) FROM products")
    if cursor.fetchone()[0] == 0:
        if os.path.exists(PRODUCTS_JSON_PATH) :
            with open(PRODUCTS_JSON_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # JSON 구조: {"880...": {"name":..., "isAlcohol":...}} 
                # DB 구조에 맞게 변환 (isAlcohol -> is_alcohol)
                for barcode, info in data.items():
                    # isAlcohol 키가 대소문자가 다를 수 있으므로 처리
                    is_alcohol = info.get('isAlcohol', info.get('is_alcohol', False))
                    
                    cursor.execute(
                        "INSERT INTO products (barcode, name, price, is_alcohol) VALUES (?, ?, ?, ?)",
                        (barcode, info['name'], info['price'], is_alcohol)
                    )
            print("✅ 초기 상품 데이터 입력 완료 (from products.json)")
        else:
            # json 파일이 없으면 하드코딩된 데이터라도 넣기 (안전장치)
            print("⚠️ products.json을 찾을 수 없어 기본 데이터를 입력합니다.")
            products_data = [
                ("8801043036068", "참이슬 후레쉬", 1950, True),
                ("8801007686561", "새우깡", 1500, False),
                ("8801062630528", "코카콜라", 2000, False)
            ]
            cursor.executemany("INSERT INTO products VALUES (?, ?, ?, ?)", products_data)
            print("✅ 초기 상품 데이터 입력 완료 (기본값)")
    else:
        print("ℹ️ 상품 데이터가 이미 존재합니다.")

    conn.commit()
    conn.close()

# 직접 실행 시 DB 초기화 수행
if __name__ == "__main__":
    init_db()