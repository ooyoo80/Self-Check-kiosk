document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // 1. 변수 선언 및 초기화
    // ============================================================
    let isScanningIdMode = false;
    let scannedIdValue = null;

    // API URL 설정
    const API_URL = window.API_URL || "http://127.0.0.1:8000";

    const resultText = document.getElementById('result-text');
    const cameraArea = document.getElementById('camera');
    const statusMessage = document.getElementById('status');

    let cartListArea = document.querySelector('.item.list');
    let totalAmountElement = document.querySelector('.total-amount');
    let payButton = document.querySelector('.pay-button');

    // 모달 요소들
    const ageModal = document.getElementById('ageModal');
    const ageYesBtn = document.getElementById('btn-age-yes');
    const ageNoBtn = document.getElementById('btn-age-no');
    const legalModal = document.getElementById('legalModal');
    const legalYesBtn = document.getElementById('btn-legal-yes');
    const legalNoBtn = document.getElementById('btn-legal-no');
    const finalPaymentModal = document.getElementById('finalPaymentModal');
    const finalPaymentListArea = document.getElementById('paymentItemsList');
    const finalPaymentTotalAmount = document.getElementById('paymentTotalAmount');
    const finalPayBtn = document.getElementById('btn-final-yes');
    const finalCancelBtn = document.getElementById('btn-final-no');

    // 🕵️ 관리자 관련 요소
    const adminTrigger = document.getElementById('admin-trigger');
    const adminModal = document.getElementById('adminLoginModal');
    const adminCloseBtn = document.getElementById('btn-admin-close');
    const adminLoginBtn = document.getElementById('btn-admin-login');
    const adminIdInput = document.getElementById('admin-username');
    const adminPwInput = document.getElementById('admin-password');

    let cartList = [];
    const recentAdds = {};

    // ============================================================
    // 2. 관리자 히든 트리거 & 로그인 로직
    // ============================================================
    let clickCount = 0;
    let clickTimer = null;

    if (adminTrigger) {
        adminTrigger.addEventListener('click', () => {
            clickCount++;
            console.log(`🕵️ 히든 트리거 클릭: ${clickCount}/5`);
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 1000);

            if (clickCount >= 5) {
                console.log("🔓 관리자 로그인 창 열림!");
                if (adminModal) {
                    adminModal.classList.add('show');
                    if (adminIdInput) adminIdInput.focus();
                }
                clickCount = 0;
            }
        });
    }

    if (adminCloseBtn) {
        adminCloseBtn.addEventListener('click', () => {
            if (adminModal) adminModal.classList.remove('show');
            if (adminIdInput) adminIdInput.value = '';
            if (adminPwInput) adminPwInput.value = '';
        });
    }

    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', async () => {
            const username = adminIdInput.value;
            const password = adminPwInput.value;

            if (!username || !password) {
                alert("아이디와 비밀번호를 입력해주세요.");
                return;
            }

            console.log("🔑 로그인 시도:", username);

            try {
                // 1. JSON 방식으로 로그인 시도
                let response = await fetch(`${API_URL}/api/admin/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });

                // 2. 실패 시(422) Form Data 방식으로 재시도
                if (response.status === 422) {
                    console.log("⚠️ JSON 로그인 실패(422) -> Form Data 재시도");
                    const formData = new URLSearchParams();
                    formData.append('username', username);
                    formData.append('password', password);

                    response = await fetch(`${API_URL}/api/admin/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: formData
                    });
                }

                if (response.ok) {
                    const data = await response.json();
                    console.log("✅ 로그인 성공!");
                    localStorage.setItem("access_token", data.access_token);
                    alert("관리자 로그인 성공! 대시보드로 이동합니다.");
                    window.location.href = "admin.html";
                } else {
                    const err = await response.json();
                    alert("로그인 실패: " + (err.detail || "정보를 확인하세요."));
                }
            } catch (e) {
                console.error("❌ 서버 오류:", e);
                alert("서버와 연결할 수 없습니다.");
            }
        });
    }

    // ============================================================
    // 3. 일반 키오스크 로직
    // ============================================================

    function handleCartItemClick(e) {
        const btn = e.target.closest('button');
        if (!btn || !cartListArea.contains(btn)) return;
        const action = btn.dataset.action;
        const barcode = btn.dataset.barcode;
        if (!action || !barcode) return;
        if (action === 'increase') updateQuantity(barcode, 1);
        if (action === 'decrease') updateQuantity(barcode, -1);
    }
    if (cartListArea) cartListArea.addEventListener('click', handleCartItemClick);

    function showToast(message, type = "info", duration = 3000) {
        let toast = document.getElementById('app-toast-message');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast-message';
            document.body.appendChild(toast);
        }
        toast.className = `toast-${type}`;
        toast.innerText = message;
        setTimeout(() => toast.classList.add('show'), 10);
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => toast.classList.remove('show'), duration);
    }

    async function handleScannedID(barcode) {
        console.log(`🆔 [ID 스캔 성공]: ${barcode}`);
        scannedIdValue = barcode;
        if (statusMessage) statusMessage.innerText = "상태: 신분증 인식 완료";
        showToast("신분증 인식이 완료되었습니다.", "success");
        await new Promise(resolve => setTimeout(resolve, 1000));
        isScanningIdMode = false;
        showFinalPaymentModal();
    }
    window.handleScannedID = handleScannedID;

    function updateFinalPaymentUI() {
        if (!finalPaymentListArea || !finalPaymentTotalAmount) return;
        finalPaymentListArea.innerHTML = '';
        let totalPrice = 0;
        cartList.forEach(item => {
            const itemTotalPrice = item.price * item.quantity;
            totalPrice += itemTotalPrice;
            const rowHTML = `<tr><td class="col-name-qty">${item.name} x ${item.quantity}</td><td class="col-price">₩${itemTotalPrice.toLocaleString()}</td></tr>`;
            finalPaymentListArea.insertAdjacentHTML('beforeend', rowHTML);
        });
        finalPaymentTotalAmount.innerText = `₩${totalPrice.toLocaleString()}`;
    }

    function showFinalPaymentModal() {
        if (finalPaymentModal) {
            updateFinalPaymentUI();
            finalPaymentModal.classList.add('show');
        } else {
            showToast("결제 팝업 오류", "error");
        }
    }

    function resetUIAfterPayment() {
        console.log("🔄 UI 초기화");
        cartList = [];
        scannedIdValue = null;
        Object.keys(recentAdds).forEach(key => delete recentAdds[key]);
        const paneRight = document.querySelector('.pane.right');
        if (document.querySelector('.id-scan-guide-container')) {
            paneRight.innerHTML = `
                <div class="item title">구매 목록</div>
                <div class="item list"></div>
                <div class="item pay">
                    <div class="total-pay">
                        <div class="item-total"><span class="total-label">총액</span><span class="total-amount">₩0</span></div>
                        <div class="action-container"><button id="btn-pay" class="pay-button">결제하기</button></div>
                    </div>
                </div>`;
            cartListArea = document.querySelector('.item.list');
            totalAmountElement = document.querySelector('.total-amount');
            payButton = document.querySelector('.pay-button');
            if (payButton) payButton.addEventListener('click', handlePaymentClick);
            if (cartListArea) cartListArea.addEventListener('click', handleCartItemClick);
        }
        updateCartUI();
        if (statusMessage) statusMessage.innerText = "상태: 결제 완료 (대기 중)";
    }

    // ★★★ [중요] 최종 결제 버튼 로직 (모든 상품 기록 + 로그인 연동) ★★★
    if (finalPayBtn) {
        finalPayBtn.addEventListener('click', async () => {
            console.log("💰 최종 '결제하기' 클릭");

            if (!cartList || cartList.length === 0) {
                showToast("상품이 없습니다.", "error");
                return;
            }

            // 1. 모든 상품 정보를 문자열로 합치기
            const allItemsInfo = cartList.map(item => {
                return `${item.name}(${item.barcode})[${item.quantity}개]`;
            }).join(", ");

            // 2. 총액 계산
            const totalPrice = cartList.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // 3. 주류 포함 여부 확인
            const hasAlcohol = cartList.some(item => item.isAlcohol === true);

            // 4. 전송할 데이터 기본 세팅
            const logData = {
                target_barcode: allItemsInfo,    // 모든 상품 정보
                total_amount: Number(totalPrice),
                consent_agreed: false,
                scanned_id_info: "-"
            };

            showToast("결제 진행 중...", "info");

            if (hasAlcohol) {
                console.log("📡 주류 포함: 성인 인증 정보 저장");
                logData.consent_agreed = true;
                logData.scanned_id_info = String(scannedIdValue || "ID_MISSING");
                if (statusMessage) statusMessage.innerText = "상태: 로그 저장 중...";
            } else {
                console.log("🛒 주류 없음: 일반 매출 저장");
            }

            // 5. 서버로 전송
            try {
                const response = await fetch(`${API_URL}/api/logs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(logData)
                });

                const result = await response.json();

                if (response.ok && result.status === "success") {
                    console.log("✅ 거래 저장 성공!");
                    if (finalPaymentModal) finalPaymentModal.classList.remove('show');
                    showToast("결제가 완료되었습니다. 감사합니다!", "success");
                    resetUIAfterPayment();
                } else {
                    throw new Error(result.message || "저장 실패");
                }
            } catch (error) {
                console.error("❌ 결제 실패:", error);
                showToast("결제 실패: 서버 오류", "error");
            }
        });
    }

    if (finalCancelBtn) {
        finalCancelBtn.addEventListener('click', () => {
            if (finalPaymentModal) finalPaymentModal.classList.remove('show');
            showToast("결제가 취소되었습니다.", "warning");
            resetUIAfterPayment();
        });
    }

    async function handleScannedCode(barcode) {
        if (statusMessage) statusMessage.innerText = "상태: 조회 중...";
        try {
            const response = await fetch(`${API_URL}/api/products/${barcode}`);
            const result = await response.json();
            if (result.status === "success") {
                const product = result.data;
                console.log(`✅ 상품 인식: ${product.name}`);
                addToCart({ ...product, barcode });
                renderAlcoholNotice(product, barcode);
                if (statusMessage) statusMessage.innerText = "상태: 대기 중";
            } else {
                if (resultText) {
                    resultText.innerText = `미등록 상품 (${barcode})`;
                    resultText.style.color = "red";
                }
                setTimeout(() => { if (resultText) resultText.innerText = "" }, 3000);
            }
        } catch (error) {
            console.error("⚠️ 통신 에러:", error);
            alert("서버 연결 실패");
        }
    }
    window.testScan = handleScannedCode;

    function addToCart(productToAdd) {
        try {
            const now = Date.now();
            const last = recentAdds[productToAdd.barcode] || 0;
            if (now - last < 800) return;
            recentAdds[productToAdd.barcode] = now;
        } catch (e) {}
        const existingItem = cartList.find(item => item.barcode === productToAdd.barcode);
        if (existingItem) existingItem.quantity += 1;
        else cartList.push({ ...productToAdd, quantity: 1 });
        updateCartUI();
    }

    function updateQuantity(barcode, change) {
        const item = cartList.find(item => item.barcode === barcode);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) cartList = cartList.filter(item => item.barcode !== barcode);
            updateCartUI();
        }
    }

    function updateCartUI() {
        if (!cartListArea) return;
        cartListArea.innerHTML = '';
        let totalPrice = 0;
        cartList.forEach((item) => {
            const itemTotalPrice = item.price * item.quantity;
            totalPrice += itemTotalPrice;
            const itemHTML = `
                <div class="item-card" data-barcode="${item.barcode}">
                    <div class="item-info"><span class="name">${item.name}</span><span class="price">₩${item.price.toLocaleString()}</span></div>
                    <div class="subtotal-controls">
                        <div class="quantity-controls">
                            <button class="decrease" data-action="decrease" data-barcode="${item.barcode}">-</button>
                            <span class="quantity">${item.quantity}</span>
                            <button class="increase" data-action="increase" data-barcode="${item.barcode}">+</button>
                        </div>
                        <span class="subtotal">₩${itemTotalPrice.toLocaleString()}</span>
                    </div>
                </div>`;
            cartListArea.insertAdjacentHTML('beforeend', itemHTML);
        });
        if (totalAmountElement) totalAmountElement.innerText = `₩${totalPrice.toLocaleString()}`;
        cartListArea.scrollTop = 0;
    }

    function renderAlcoholNotice(product, barcode) {
        try {
            const isAlcohol = !!(product && product.isAlcohol === true);
            if (!isAlcohol) return;
            const existing = document.getElementById('alcohol-notice');
            if (existing) existing.remove();
            const notice = document.createElement('div');
            notice.id = 'alcohol-notice';
            notice.className = 'alcohol-notice-popup';
            notice.innerHTML = `<div class="alcohol-notice-title">주류 상품 안내</div><div class="alcohol-notice-body">이 상품은 주류로 분류됩니다. 청소년에게 판매가 제한되며, 필요 시 신분증 확인이 필요합니다.</div><div class="alcohol-notice-footer"><button id="alcohol-notice-close" class="alcohol-notice-btn">확인</button></div>`;
            document.body.appendChild(notice);
            const closeBtn = document.getElementById('alcohol-notice-close');
            if (closeBtn) closeBtn.addEventListener('click', () => notice.remove());
        } catch (e) {}
    }

    function clearAlcoholItems() {
        cartList = cartList.filter(item => !item.isAlcohol);
        updateCartUI();
    }

    // ⬇️⬇️⬇️ [여기가 추가된 부분입니다!] ⬇️⬇️⬇️
    function showIdScanScreen() {
        console.log("🖥️ 화면 전환: 신분증 스캔 모드 진입");
        const paneRight = document.querySelector('.pane.right');
        if (!paneRight) return;
        
        paneRight.innerHTML = `
            <div class="id-scan-guide-container">
                <div class="guide-icon">🆔</div>
                <h2>신분증 바코드를 스캔해주세요</h2>
                <p class="guide-text">
                    성인 인증 및 법적 책임 동의 확인을 위해<br>
                    신분증 뒷면의 바코드를 카메라에 비춰주세요.
                </p>
                <div class="scan-animation">
                    <div class="scan-line"></div>
                </div>
                <p class="sub-text">인식이 완료되면 자동으로 다음 단계로 넘어갑니다.</p>
            </div>
        `;
        
        isScanningIdMode = true;
        if (statusMessage) statusMessage.innerText = "상태: 신분증 스캔 대기 중...";
    }
    // ⬆️⬆️⬆️ ---------------------------- ⬆️⬆️⬆️

    function handlePaymentClick() {
        if (cartList.length === 0) { alert("장바구니에 상품이 없습니다."); return; }
        const hasAlcohol = cartList.some(item => item.isAlcohol === true);
        if (hasAlcohol) {
            console.log("🚨 주류 포함됨");
            if (ageModal) ageModal.classList.add('show');
        } else {
            console.log("✅ 주류 없음");
            showFinalPaymentModal();
        }
    }
    if (payButton) payButton.addEventListener('click', handlePaymentClick);

    if (ageYesBtn) ageYesBtn.addEventListener('click', () => { ageModal.classList.remove('show'); legalModal.classList.add('show'); });
    if (ageNoBtn) ageNoBtn.addEventListener('click', () => { ageModal.classList.remove('show'); });
    if (legalYesBtn) legalYesBtn.addEventListener('click', () => { legalModal.classList.remove('show'); showIdScanScreen(); });
    if (legalNoBtn) legalNoBtn.addEventListener('click', () => { legalModal.classList.remove('show'); clearAlcoholItems(); });

    function startScanner() {
        const cameraElement = document.getElementById('camera');
        if (!cameraElement) return;
        Quagga.init({
            inputStream: { name: 'Live', type: 'LiveStream', target: cameraArea },
            decoder: { readers: ['ean_reader', 'code_128_reader', 'ean_8_reader', 'code_39_reader', 'upc_reader'] },
            locate: true, frequency: 10
        }, function(err) {
            if (err) { console.error("Quagga Init Error:", err); return; }
            Quagga.start();
            const videoElement = cameraArea.querySelector('video');
            if (videoElement) videoElement.style.transform = 'scaleX(-1)';
        });
        let isScanning = false;
        let lastDetectedCode = null;
        let lastDetectedAt = 0;
        Quagga.onDetected((data) => {
            const code = data.codeResult.code;
            const now = Date.now();
            if (code === lastDetectedCode && (now - lastDetectedAt) < 2500) return;
            lastDetectedCode = code;
            lastDetectedAt = now;
            if (isScanning) return;
            isScanning = true;
            let processPromise = isScanningIdMode ? handleScannedID(code) : handleScannedCode(code);
            processPromise.finally(() => {
                setTimeout(() => {
                    isScanning = false;
                    if (statusMessage) {
                        const modeMessage = isScanningIdMode ? "신분증 스캔" : "상품 스캔";
                        statusMessage.innerText = `상태: 대기 중 (${modeMessage} 가능)`;
                    }
                }, 2500)
            });
        });
    }
    startScanner();
});