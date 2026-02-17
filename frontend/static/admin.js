// frontend/static/admin.js
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = window.API_URL || "http://127.0.0.1:8000";
    
    // 1. 토큰 검사 (로그인 안 했으면 쫓아내기)
    const token = localStorage.getItem("access_token");
    if (!token) {
        alert("로그인이 필요합니다.");
        window.location.href = "index.html"; // 메인으로 튕겨내기
        return;
    }

    // 2. 로그아웃 기능
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("access_token"); // 토큰 삭제
            alert("로그아웃 되었습니다.");
            window.location.href = "index.html";
        });
    }

    // 3. API에서 매출 데이터 가져오기
    try {
        const response = await fetch(`${API_URL}/api/admin/logs`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`, // ⭐ 중요: 토큰을 헤더에 실어 보냄
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const result = await response.json();
            console.log("📡 서버 응답 데이터 확인:", result); // 콘솔에서 데이터 구조 확인용

            // 데이터가 리스트가 아니라 객체 안에 담겨있을 경우를 대비해 꺼내줍니다.
            // 예: { "logs": [...] } 또는 { "data": [...] }
            let logs = Array.isArray(result) ? result : (result.logs || result.data || []);

            if (!Array.isArray(logs)) {
                console.error("❌ 에러: 로그 데이터가 배열 형식이 아닙니다.", logs);
                alert("데이터 형식이 올바르지 않습니다.");
                return;
            }

            renderTable(logs);
            renderSummary(logs);
        } else {
            const error = await response.json();
            console.error("데이터 로드 실패:", error);
            if (response.status === 401) {
                alert("세션이 만료되었습니다. 다시 로그인해주세요.");
                localStorage.removeItem("access_token");
                window.location.href = "index.html";
            } else {
                alert("데이터를 불러오는데 실패했습니다.");
            }
        }
    } catch (e) {
        console.error("서버 통신 오류:", e);
        alert("서버와 연결할 수 없습니다.");
    }

    // 4. 테이블 렌더링 함수
    // 4. 테이블 렌더링 함수 (동의 여부 추가됨)
    function renderTable(logs) {
        const tbody = document.getElementById("logs-table-body");
        tbody.innerHTML = ""; // 초기화

        // 최신순 정렬 (ID 내림차순)
        logs.sort((a, b) => b.id - a.id);

        logs.forEach(log => {
            const tr = document.createElement("tr");
            
            // 1. 시간 변환 (UTC -> KST)
            // DB 시간(UTC) 뒤에 'Z'를 붙여서 브라우저가 한국 시간으로 변환하게 함
            let dateStr = log.timestamp;
            if (!dateStr.endsWith('Z')) dateStr += 'Z';
            
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: true 
            });

            // 2. 상품 목록 줄바꿈 디자인
            let itemsHtml = log.target_barcode;
            if (itemsHtml && itemsHtml.includes(',')) {
                itemsHtml = itemsHtml.split(', ').map(item => 
                    `<div class="product-item">▪ ${item}</div>`
                ).join('');
            } else {
                itemsHtml = `<div class="product-item">${itemsHtml}</div>`;
            }

            // 3. 동의 여부 뱃지 디자인
            // log.consent_agreed가 true(1)이면 '동의', 아니면 '-'
            const consentBadge = log.consent_agreed 
                ? `<span class="badge-consent yes">동의함</span>` 
                : `<span class="badge-consent no">-</span>`;

            // 4. 테이블 행 구성
            tr.innerHTML = `
                <td>${log.id}</td>
                <td class="product-cell">${itemsHtml}</td>
                <td class="price-cell">₩${(log.total_amount || 0).toLocaleString()}</td>
                <td style="text-align: center;">${consentBadge}</td>
                <td>${log.scanned_id_info || "-"}</td>
                <td>${formattedDate}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 5. 요약 정보(총 매출) 렌더링 함수
    function renderSummary(logs) {
        const totalCount = document.getElementById("total-count");
        const totalRevenue = document.getElementById("total-revenue");

        const count = logs.length;
        const revenue = logs.reduce((sum, log) => sum + (log.total_amount || 0), 0);

        if(totalCount) totalCount.innerText = `${count}건`;
        if(totalRevenue) totalRevenue.innerText = `₩${revenue.toLocaleString()}`;
    }
});