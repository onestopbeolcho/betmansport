# 📖 PortOne (포트원) V2 결제 연동 가이드

> **작성일**: 2026-02-22  
> **프로젝트**: Smart Proto Investor (Scorenix)  
> **연동 상태**: ✅ 프론트엔드 + 백엔드 기본 연동 완료

---

## 📋 목차

1. [PortOne V2 개요](#1-portone-v2-개요)
2. [사전 준비 (콘솔 설정)](#2-사전-준비-콘솔-설정)
3. [프론트엔드 연동](#3-프론트엔드-연동)
4. [백엔드 검증 & 처리](#4-백엔드-검증--처리)
5. [웹훅 (Webhook) 설정](#5-웹훅-webhook-설정)
6. [정기결제 (빌링키)](#6-정기결제-빌링키)
7. [테스트 & 디버깅](#7-테스트--디버깅)
8. [보안 체크리스트](#8-보안-체크리스트)
9. [현재 프로젝트 구현 현황](#9-현재-프로젝트-구현-현황)
10. [참고 자료](#10-참고-자료)

---

## 1. PortOne V2 개요

### 1-1. PortOne이란?
PortOne(포트원)은 다양한 PG사(Payment Gateway)의 결제창을 **통일된 하나의 API**로 호출할 수 있는 결제 통합 솔루션입니다.

### 1-2. V2의 핵심 특징
| 특징 | 설명 |
|------|------|
| **TypeScript 지원** | NPM 패키지로 설치, 완전한 타입 정보 제공 |
| **직관적 스키마** | 결제수단별 응답 타입이 정확하게 분리 |
| **Open API Spec** | Postman Import, 코드 자동생성 가능 |
| **개선된 보안** | 웹훅 시그니처 검증, Standard Webhooks 규격 |

### 1-3. 결제 플로우 (전체 아키텍처)

```
┌────────────────────────────────────────────────────────────────┐
│                        결제 흐름도                              │
│                                                                │
│  [사용자 브라우저]                                               │
│       │                                                        │
│   ① PortOne.requestPayment() 호출                              │
│       │                                                        │
│       ▼                                                        │
│  [PortOne SDK] → PG사 결제창 표시                                │
│       │                                                        │
│   ② 사용자 결제 진행 (카드/간편결제 등)                           │
│       │                                                        │
│       ▼                                                        │
│  [결제 완료] → paymentId 반환                                    │
│       │                                                        │
│   ③ 프론트 → 백엔드: POST /api/payments/verify                  │
│       │              { payment_id, plan_id }                    │
│       ▼                                                        │
│  [백엔드 서버]                                                   │
│       │                                                        │
│   ④ PortOne REST API로 결제 검증                                │
│       GET https://api.portone.io/payments/{paymentId}          │
│       │                                                        │
│   ⑤ 금액 검증 → DB 저장 → 유저 등급 업그레이드                   │
│       │                                                        │
│   ⑥ 성공 응답 → 프론트에서 완료 페이지로 이동                    │
│                                                                │
│  [PortOne 웹훅] ─── 보조 ───→ [백엔드 /webhook 엔드포인트]       │
│       (비동기 알림: 결제완료, 취소, 환불 등)                      │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. 사전 준비 (콘솔 설정)

### 2-1. PortOne 관리자 콘솔 접속
- URL: **https://admin.portone.io**
- 회원가입 후 사업자 인증 완료 필요

### 2-2. 필수 키 발급

| 키 이름 | 위치 | 용도 |
|---------|------|------|
| **Store ID** | 관리자 콘솔 → 결제 연동 → 식별코드 | 프론트엔드 SDK에서 사용 |
| **채널 키 (Channel Key)** | 관리자 콘솔 → 결제 연동 → 채널 관리 | PG사별 결제 채널 식별 |
| **V2 API Secret** | 관리자 콘솔 → 결제 연동 → API Keys → V2 | 백엔드 REST API 인증 |
| **웹훅 시크릿** | 관리자 콘솔 → 결제 연동 → API Keys | 웹훅 시그니처 검증 |

### 2-3. 환경변수 설정

**프론트엔드 (`.env.local`)**
```env
NEXT_PUBLIC_PORTONE_STORE_ID=store-xxxxxxxx-xxxx-xxxx-xxxx
NEXT_PUBLIC_PORTONE_CHANNEL_KEY=channel-key-xxxxxxxx-xxxx-xxxx
```

**백엔드 (`.env`)**
```env
PORTONE_API_SECRET=portone_api_secret_xxxxxxxx
PORTONE_STORE_ID=store-xxxxxxxx-xxxx-xxxx-xxxx
PORTONE_WEBHOOK_SECRET=whsec_xxxxxxxx
```

### 2-4. PG사 채널 설정
1. 관리자 콘솔 → **결제 연동** → **테스트 연동 관리** → **채널 추가**
2. PG사 선택 (예: 토스페이먼츠, KG이니시스, 나이스페이먼츠 등)
3. **테스트 모드** 채널 생성 → 채널 키 복사
4. 실연동 전환 시: PG사 계약 완료 후 **실연동 채널** 별도 생성

---

## 3. 프론트엔드 연동

### 3-1. SDK 설치

```bash
npm i @portone/browser-sdk
```

### 3-2. SDK Import

```tsx
// Next.js / React (클라이언트 컴포넌트에서만 사용)
"use client";
import * as PortOne from "@portone/browser-sdk/v2";
```

> ⚠️ Next.js App Router에서는 반드시 `"use client"` 지시문이 필요합니다.

### 3-3. 결제 요청 (requestPayment)

```tsx
const handleCheckout = async () => {
    const paymentId = `SPI_${planId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const response = await PortOne.requestPayment({
        // ── 필수 파라미터 ──
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
        paymentId: paymentId,           // 고유 결제 ID (가맹점에서 생성)
        orderName: "Scorenix - Pro",    // 주문명
        totalAmount: 55000,             // 결제 금액
        currency: "CURRENCY_KRW",       // 화폐 단위
        payMethod: "CARD",              // 결제 수단

        // ── 선택 파라미터 ──
        customer: {
            email: user.email,
            fullName: user.displayName,
            phoneNumber: user.phone,
        },

        // ── 리다이렉트 설정 (모바일 필수) ──
        redirectUrl: `${window.location.origin}/payment/complete?paymentId=${paymentId}`,
        // forceRedirect: true,  // PC에서도 리다이렉트 강제 시
    });

    // 결과 처리
    if (response?.code) {
        // 오류 발생
        console.error(response.message);
        return;
    }

    // 서버에 결제 검증 요청
    await fetch('/api/payments/verify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_id: paymentId, plan_id: planId }),
    });
};
```

### 3-4. 주요 파라미터 설명

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `storeId` | string | ✅ | PortOne Store ID |
| `channelKey` | string | ✅ | PG 채널 키 |
| `paymentId` | string | ✅ | 고유 결제 ID (가맹점 생성, 중복결제 방지) |
| `orderName` | string | ✅ | 주문 내용 |
| `totalAmount` | number | ✅ | 결제 금액 |
| `currency` | string | ✅ | `CURRENCY_KRW`, `CURRENCY_USD` 등 |
| `payMethod` | string | ✅ | `CARD`, `VIRTUAL_ACCOUNT`, `TRANSFER`, `MOBILE`, `EASY_PAY` |
| `customer` | object | ❌ | 고객 정보 (email, fullName, phoneNumber) |
| `redirectUrl` | string | ❌* | 결제 완료 후 리다이렉트 URL (*모바일 필수) |
| `forceRedirect` | boolean | ❌ | true면 PC에서도 리다이렉트 방식 |

### 3-5. 결제 수단 (payMethod) 목록

| 값 | 결제 수단 |
|----|----------|
| `CARD` | 신용/체크 카드 |
| `VIRTUAL_ACCOUNT` | 가상계좌 |
| `TRANSFER` | 계좌이체 |
| `MOBILE` | 휴대폰 소액결제 |
| `EASY_PAY` | 간편결제 (카카오페이, 네이버페이 등) |
| `GIFT_CERTIFICATE` | 상품권 |

### 3-6. 결제 완료 처리 방식

#### 방식 A: 반환값 (Promise) 방식 — PC 전용
```tsx
const response = await PortOne.requestPayment({ /* ... */ });
// response가 바로 반환됨
if (response?.code) { /* 에러 */ }
else { /* 성공 → 서버 검증 */ }
```

#### 방식 B: 리다이렉트 방식 — 모바일 필수
```tsx
// 결제 요청 시 redirectUrl 설정
await PortOne.requestPayment({
    /* ... */
    redirectUrl: `${BASE_URL}/payment/complete`,
    forceRedirect: true,
});

// /payment/complete 페이지에서 쿼리 파라미터로 결과 확인
// ?paymentId=xxx&code=xxx&message=xxx
```

#### 방식 C: 혼합 (권장) — PC + 모바일 자동 분기
```tsx
// redirectUrl 설정 + forceRedirect 미설정
// → PC: 반환값, 모바일: 리다이렉트 자동 결정
await PortOne.requestPayment({
    /* ... */
    redirectUrl: `${BASE_URL}/payment/complete`,
    // forceRedirect 없음
});

// 두 경우 모두 처리하는 코드 필요
```

---

## 4. 백엔드 검증 & 처리

### 4-1. PortOne REST API 사용

#### 인증 헤더
```
Authorization: PortOne {PORTONE_API_SECRET}
```

#### 결제 내역 단건 조회
```
GET https://api.portone.io/payments/{paymentId}
```

### 4-2. FastAPI 구현 (현재 프로젝트)

```python
import httpx
from fastapi import APIRouter, Depends, HTTPException

PORTONE_API_SECRET = os.getenv("PORTONE_API_SECRET", "")
PORTONE_API_BASE = "https://api.portone.io"

@router.post("/verify")
async def verify_payment(req: VerifyRequest, user_id: str = Depends(require_current_user)):
    """
    결제 검증 Flow:
    1. PortOne API로 결제 내역 조회
    2. 결제 상태 확인 (status == "PAID")
    3. 결제 금액 검증 (서버의 요금제 가격과 비교)
    4. 유저 등급 업그레이드 + 결제 기록 저장
    """
    plan = PLANS.get(req.plan_id)
    if not plan:
        raise HTTPException(400, "유효하지 않은 요금제")

    # 1. PortOne API 조회
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PORTONE_API_BASE}/payments/{req.payment_id}",
            headers={"Authorization": f"PortOne {PORTONE_API_SECRET}"},
        )

    if response.status_code != 200:
        raise HTTPException(400, "결제 정보를 조회할 수 없습니다.")

    payment_data = response.json()

    # 2. 상태 확인
    if payment_data.get("status") != "PAID":
        raise HTTPException(400, f"결제 미완료 (상태: {payment_data.get('status')})")

    # 3. 금액 검증 (⚠️ 가장 중요!)
    paid_amount = payment_data.get("amount", {}).get("total", 0)
    if paid_amount != plan["price"]:
        raise HTTPException(400, "결제 금액 불일치 — 위변조 의심")

    # 4. DB 업데이트
    expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()
    await update_user(user_id, {
        "tier": plan["tier"],
        "subscription_plan": req.plan_id,
        "subscription_expires_at": expires_at,
        "portone_payment_id": req.payment_id,
    })

    await create_payment({
        "user_id": user_id,
        "plan_id": req.plan_id,
        "amount": paid_amount,
        "portone_payment_id": req.payment_id,
        "status": "completed",
    })

    return {"success": True, "expires_at": expires_at}
```

### 4-3. 결제 응답 주요 필드

```json
{
    "id": "payment-xxxxx",
    "status": "PAID",            // PAID, VIRTUAL_ACCOUNT_ISSUED, FAILED, CANCELLED
    "amount": {
        "total": 55000,
        "taxFree": 0,
        "vat": 5000,
        "supply": 50000
    },
    "method": {
        "type": "PaymentMethodCard",
        "card": {
            "publisher": "국민",
            "number": "****-****-****-1234",
            "installment": { "month": 0 }
        }
    },
    "channel": { "key": "channel-key-xxx" },
    "customer": { "email": "user@email.com" },
    "orderName": "Scorenix - Pro",
    "paidAt": "2026-02-22T12:00:00Z"
}
```

---

## 5. 웹훅 (Webhook) 설정

### 5-1. 웹훅이란?
결제 이벤트(완료, 취소, 환불 등) 발생 시 PortOne 서버가 **가맹점 서버로 자동 HTTP POST 요청**을 보내는 시스템.

### 5-2. 왜 필요한가?
- 네트워크 오류로 프론트엔드에서 결과를 못 받을 수 있음
- 브라우저 새로고침/팝업 차단으로 결제 완료 처리가 누락될 수 있음
- **가상계좌 입금 확인**은 웹훅으로만 가능
- 환불/취소 알림을 실시간으로 수신

### 5-3. 콘솔 설정

1. 관리자 콘솔 → **결제 연동** → **연동 관리** → **결제알림(Webhook) 관리**
2. 웹훅 버전: **결제모듈 V2** 선택
3. 설정 모드: **테스트** (개발) / **실연동** (운영)
4. Endpoint URL 입력:  
   ```
   https://smart-proto-backend-xxxxx.asia-northeast3.run.app/api/payments/webhook
   ```
5. Content Type: `application/json`

> ⚠️ 로컬 테스트 시 `localhost`는 직접 사용 불가 → **ngrok** 등 터널링 필요

### 5-4. 웹훅 수신 구현

```python
@router.post("/webhook")
async def portone_webhook(request: Request):
    body = await request.json()
    event_type = body.get("type", "")
    
    if event_type == "Transaction.Paid":
        payment_id = body.get("data", {}).get("paymentId")
        # 결제 완료 처리 (verify와 동일한 검증 로직)
        
    elif event_type == "Transaction.Cancelled":
        payment_id = body.get("data", {}).get("paymentId")
        # 결제 취소 처리
        
    elif event_type == "Transaction.VirtualAccountIssued":
        # 가상계좌 발급 완료
        
    return {"received": True}  # 200 OK 필수
```

### 5-5. 웹훅 시그니처 검증 (보안 강화)

```python
import hmac
import hashlib
import base64

WEBHOOK_SECRET = os.getenv("PORTONE_WEBHOOK_SECRET", "")

def verify_webhook_signature(request: Request, body: bytes) -> bool:
    """Standard Webhooks 규격 시그니처 검증"""
    webhook_id = request.headers.get("webhook-id", "")
    webhook_timestamp = request.headers.get("webhook-timestamp", "")
    webhook_signature = request.headers.get("webhook-signature", "")
    
    # 시그니처 생성
    sign_content = f"{webhook_id}.{webhook_timestamp}.{body.decode()}"
    secret_bytes = base64.b64decode(WEBHOOK_SECRET.split("_")[1])
    expected_sig = base64.b64encode(
        hmac.new(secret_bytes, sign_content.encode(), hashlib.sha256).digest()
    ).decode()
    
    # 비교
    expected = f"v1,{expected_sig}"
    return hmac.compare_digest(expected, webhook_signature)
```

### 5-6. 웹훅 이벤트 타입

| 이벤트 | 설명 |
|--------|------|
| `Transaction.Paid` | 결제 완료 |
| `Transaction.Cancelled` | 결제 취소/환불 |
| `Transaction.Failed` | 결제 실패 |
| `Transaction.VirtualAccountIssued` | 가상계좌 발급 |
| `Transaction.PayPending` | 결제 대기 |
| `BillingKey.Issued` | 빌링키 발급 (정기결제) |
| `BillingKey.Deleted` | 빌링키 삭제 |

### 5-7. PortOne 웹훅 IP
- **V2 웹훅 IP**: `52.78.5.241`
- 방화벽에서 이 IP 허용 필요 (Cloud Run은 기본 허용)
- 응답 Timeout: **30초**

---

## 6. 정기결제 (빌링키)

### 6-1. 빌링키란?
고객의 카드 정보를 암호화한 토큰. 한 번 발급받으면 고객 인증 없이 **반복 결제** 가능.

### 6-2. 빌링키 발급 방식

#### 방식 A: 결제창을 통한 발급
```tsx
const response = await PortOne.requestIssueBillingKey({
    storeId: STORE_ID,
    channelKey: CHANNEL_KEY,
    billingKeyMethod: "CARD",
    customer: { email: user.email },
});

if (response?.billingKey) {
    // 서버로 billingKey 전송 → DB 저장
    await fetch('/api/billing/save-key', {
        method: 'POST',
        body: JSON.stringify({ billingKey: response.billingKey }),
    });
}
```

#### 방식 B: REST API를 통한 발급
```python
# 백엔드에서 직접 billingKey 발급 (고객 카드정보 직접 수집 시)
async with httpx.AsyncClient() as client:
    response = await client.post(
        f"{PORTONE_API_BASE}/billing-keys",
        headers={"Authorization": f"PortOne {PORTONE_API_SECRET}"},
        json={
            "channelKey": CHANNEL_KEY,
            "customer": {"id": user_id},
            "method": {
                "card": {
                    "credential": {
                        "number": "4242424242424242",
                        "expiryMonth": "12",
                        "expiryYear": "2030",
                        "birthOrBusinessRegistrationNumber": "900101",
                    }
                }
            },
        },
    )
```

### 6-3. 빌링키로 결제 (정기결제 실행)

```python
async def charge_billing_key(billing_key: str, amount: int, order_name: str):
    """빌링키를 이용한 자동 결제"""
    payment_id = f"SPI_AUTO_{int(time.time())}_{uuid4().hex[:6]}"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{PORTONE_API_BASE}/payments/{payment_id}/billing-key",
            headers={"Authorization": f"PortOne {PORTONE_API_SECRET}"},
            json={
                "billingKey": billing_key,
                "orderName": order_name,
                "amount": {"total": amount},
                "currency": "KRW",
            },
        )
    
    result = response.json()
    return result.get("status") == "PAID"
```

### 6-4. 정기결제 스케줄러 (월 자동 갱신)

```python
# 매일 자정에 실행 — 만료 예정 구독자 자동 갱신
async def auto_renew_subscriptions():
    """구독 만료 1일 전 자동 갱신"""
    tomorrow = datetime.utcnow() + timedelta(days=1)
    
    # Firestore에서 만료 예정 사용자 조회
    expiring_users = await get_expiring_users(tomorrow)
    
    for user in expiring_users:
        if user.get("subscription_cancel_requested"):
            # 취소 요청된 구독은 무료로 전환
            await update_user(user["id"], {"tier": "free"})
            continue
        
        billing_key = user.get("billing_key")
        if not billing_key:
            continue
        
        plan = PLANS.get(user.get("subscription_plan", "pro"))
        success = await charge_billing_key(
            billing_key=billing_key,
            amount=plan["price"],
            order_name=f"Scorenix {plan['name']} 정기결제",
        )
        
        if success:
            new_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
            await update_user(user["id"], {"subscription_expires_at": new_expires})
```

---

## 7. 테스트 & 디버깅

### 7-1. 테스트 모드 결제

PortOne 콘솔에서 **테스트 채널**을 생성하면 실제 결제 없이 테스트 가능.

| 항목 | 테스트 값 |
|------|----------|
| 카드번호 | `4242-4242-4242-4242` (범용 테스트) |
| 유효기간 | 미래 날짜 아무거나 |
| 생년월일 | `900101` |
| 비밀번호 앞 2자리 | `00` |

### 7-2. 결제 상태 확인

```bash
# PortOne API로 결제 내역 직접 조회
curl -H "Authorization: PortOne YOUR_API_SECRET" \
     https://api.portone.io/payments/YOUR_PAYMENT_ID
```

### 7-3. 일반적인 오류 & 해결

| 오류 코드 | 원인 | 해결 |
|-----------|------|------|
| `FAILURE_TYPE_PG` | PG사 연동 오류 | 채널 키 확인, PG 계약 상태 확인 |
| `INVALID_STORE_ID` | Store ID 불일치 | `.env.local`의 Store ID 확인 |
| `INVALID_CHANNEL_KEY` | 채널 키 불일치 | 콘솔에서 채널 키 재확인 |
| 결제창 안 뜸 | SDK 미로드 | import 경로 확인 (`@portone/browser-sdk/v2`) |
| 금액 불일치 | 위변조 시도 | 백엔드에서 서버의 가격과 비교 |
| 모바일 결제 안 됨 | redirectUrl 미설정 | `redirectUrl` 반드시 설정 |

### 7-4. 콘솔 로그 확인

- **PortOne 관리자 콘솔** → 결제 → 결제 내역: 모든 결제 기록 조회
- **웹훅 로그**: 관리자 콘솔 → 결제 연동 → 웹훅 로그
- **Cloud Run 로그**: `gcloud logging read` 또는 GCP 콘솔

---

## 8. 보안 체크리스트

### ✅ 필수 보안 항목

- [ ] **서버측 금액 검증**: 절대 프론트의 금액을 신뢰하지 말 것
- [ ] **paymentId 고유성**: UUID 또는 타임스탬프 기반 고유 ID 생성
- [ ] **API Secret 서버 전용**: PORTONE_API_SECRET은 절대 프론트에 노출하지 말 것
- [ ] **웹훅 시그니처 검증**: 운영환경에서는 반드시 활성화
- [ ] **HTTPS 필수**: redirectUrl은 반드시 HTTPS
- [ ] **중복 결제 방지**: 같은 paymentId로 중복 검증 요청 차단
- [ ] **토큰 인증**: 결제 검증 API는 반드시 로그인 사용자만 접근

### ⚠️ 주의사항

1. **금액 위변조**: 프론트에서 보낸 금액이 아닌, 서버에 저장된 요금제 가격과 비교
2. **Race Condition**: 동시 검증 요청 시 중복 처리 방지
3. **환경 분리**: 테스트 채널과 실연동 채널 키를 혼용하지 말 것
4. **개인정보**: 카드번호는 절대 서버에 저장하지 말 것 (빌링키 사용)

---

## 9. 현재 프로젝트 구현 현황

### ✅ 완료된 항목

| 구분 | 파일 | 상태 |
|------|------|------|
| 프론트 결제 요청 페이지 | `app/[lang]/payment/request/page.tsx` | ✅ 완료 |
| 백엔드 결제 검증 API | `backend/app/api/endpoints/payments.py` | ✅ 완료 |
| 요금제 정보 API | `GET /api/payments/plans` | ✅ 완료 |
| 구독 상태 조회 | `GET /api/payments/my` | ✅ 완료 |
| 구독 취소 | `POST /api/payments/cancel` | ✅ 완료 |
| 웹훅 수신 (기본) | `POST /api/payments/webhook` | ✅ 완료 |
| SDK 설치 | `@portone/browser-sdk` | ✅ 완료 |

### 🔧 추가 구현 필요 항목

| 구분 | 설명 | 우선도 |
|------|------|--------|
| 웹훅 시그니처 검증 | 현재 기본 수신만 구현 | 🔴 높음 |
| 결제 완료 페이지 | `/payment/complete` 페이지 구현 | 🔴 높음 |
| 정기결제 (빌링키) | 월 자동 갱신 시스템 | 🟡 중간 |
| 환불 처리 API | PortOne 결제 취소 API 연동 | 🟡 중간 |
| 결제 내역 관리 (Admin) | 관리자 대시보드에서 결제 조회 | 🟢 낮음 |
| 웹훅 URL 등록 | PortOne 콘솔에서 운영 URL 설정 | 🔴 높음 |

### 환경변수 현재 상태

```
✅ NEXT_PUBLIC_PORTONE_STORE_ID    → .env.local 설정 필요
✅ NEXT_PUBLIC_PORTONE_CHANNEL_KEY → .env.local 설정 필요
✅ PORTONE_API_SECRET              → Cloud Run 환경변수 설정 필요
❌ PORTONE_WEBHOOK_SECRET          → 미설정 (웹훅 시그니처 검증용)
```

---

## 10. 참고 자료

### 공식 문서
- [PortOne V2 결제 연동 시작하기](https://developers.portone.io/opi/ko/integration/start/v2/readme?v=v2)
- [인증 결제 연동하기](https://developers.portone.io/opi/ko/integration/start/v2/checkout?v=v2)
- [웹훅 연동하기](https://developers.portone.io/opi/ko/integration/start/v2/webhook?v=v2)
- [REST API 문서](https://developers.portone.io/api/rest-v2)
- [requestPayment 응답 형식](https://developers.portone.io/sdk/ko/v2-sdk/payment-response)
- [정기결제 연동하기](https://developers.portone.io/opi/ko/integration/start/v2/billing?v=v2)

### SDK & 샘플
- [NPM: @portone/browser-sdk](https://www.npmjs.com/package/@portone/browser-sdk)
- [GitHub 샘플 프로젝트](https://github.com/portone-io/portone-sample)
- [Open API Spec 다운로드](https://developers.portone.io/api/rest-v2) → "OpenAPI JSON 내려받기"

### PortOne 관리자
- [PortOne 관리자 콘솔](https://admin.portone.io)

---

> 📌 **요약**: PortOne V2 결제 연동은 크게 3단계입니다.
> 1. **프론트**: `PortOne.requestPayment()` → 결제창 호출
> 2. **백엔드**: PortOne REST API로 `GET /payments/{id}` → 금액 검증
> 3. **웹훅**: 비동기 이벤트 수신 (결제완료, 취소, 환불)
>
> 가장 중요한 보안 원칙: **서버에서 반드시 금액을 검증**할 것! 🔒
