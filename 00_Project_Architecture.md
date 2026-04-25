# [[00_Project_Architecture]] (Master Index)

이 문서는 프로젝트 전체를 관통하는 신경망의 중심 노드(Hub)입니다. 모든 주요 기획 문서, 아키텍처 다이어그램, 모듈 명세서가 이 문서를 통해 유기적으로 연결됩니다. 코드를 수정하거나 기획을 검토할 때 **반드시 연관된 `[[문서이름]]`을 확인**하세요.

## 📌 1. 프로젝트 목적 및 시스템 구조도
**[[ERP_Dashboard]]**는 Next.js 기반의 프론트엔드와 Supabase(PostgreSQL)를 결합한 전사적 자원 관리 자동화 솔루션입니다. 

*   **Front-end:** [[Nextjs_16_AppRouter]], Tailwind CSS v4, Lucide React, Shadcn/Base-UI (자세한 내용은 [[01_Frontend_Architecture]] 참조)
*   **Back-end/DB:** [[Supabase_PostgreSQL]], Playwright (크롤링 아키텍처는 [[02_Crawling_Architecture]] 참조)
*   **외부 API 및 연동:** [[COUPANG_AKAMAI_BYPASS]] (쿠팡 동기화 관련 문서), [[API_Docs/Naver]]

## 📁 2. 핵심 모듈 및 기획 문서 맵
각 디렉토리 및 모듈은 다음의 기획 문서와 강하게 연결되어 구조화됩니다. 기능 개발 시 아래 연결된 문서를 최우선으로 검토하세요.

*   `src/app/` (Next.js 라우터 구조)
    *   **고객지원 (CS):** [[04_고객지원_UI기획]]
    *   **재무 (Finance):** [[05_재무_UI기획]], [[09_재무_정산_및_순이익_공식]]
    *   **주문/물류 (Orders):** [[03_주문및물류_UI기획]]
    *   **재고 (Products):** [[06_재고관리_UI기획]]
    *   **마케팅 (Marketing):** [[07_마케팅_UI기획]]
    *   **설정 (Settings):** [[08_설정_UI기획]]
*   `src/components/`: 재사용 가능한 UI 컴포넌트 (`app-sidebar.tsx`, `inventory-modal.tsx` 등).
*   `scripts/`: 오프라인 백그라운드 크롤링 및 파싱 자동화 스크립트. 작동 원리는 [[02_Crawling_Architecture]] 및 [[COUPANG_AKAMAI_BYPASS]] 참조.
    *   **크롤러 보안/인증 (Auth):** [[10_쿠팡_크롤러_보안_및_인증_아키텍처]]
    *   **쿠팡 광고 자동화:** [[test_ads_scraper.ts]], [[parse_ads_sales.ts]], [[wing_login.ts]]
    *   **쿠팡 주문/매출 자동화:** [[wing_sales_scraper.ts]], [[parse_wing_sales.ts]]
*   `.env.local`: 런타임 환경변수. 설정 규칙은 [[Environment_Variables_Rules]] 참조.
*   `RULES.md`: AI가 코드 작성 시 따라야 할 절대 규칙. 반드시 [[RULES]]를 모순 없이 숙지할 것.
*   `sync_obsidian.sh`: 변경 사항을 [[00_AI_Wiki]]로 동기화하는 데몬 스크립트.

## 💾 3. 주요 데이터 구조 (DB 스키마)
자세한 스키마 정의 및 수정 이력은 [[Database_Schema]] 문서를 참조하세요. 현재 주요 테이블은 다음과 같습니다.

*   **[[products_dim]] (마스터 상품)**: ERP의 뼈대가 되는 순수한 자사 상품 데이터.
*   **[[product_mappings]] (1:N 매치업 테이블)**: 마스터 상품과 [[COUPANG_AKAMAI_BYPASS]] 등 오픈마켓 파편 데이터를 묶는 브릿지 역할.
*   **[[trade_receipts]] (무역 입고 전표)**: 정확한 수입원가(Landed Cost) 추적을 위한 전표 관리 테이블.
*   **[[unmatched_queue]] (매핑 대기 데이터)**: 봇이 가져온 주인 잃은 데이터의 집합.
*   **[[crawled_data_tables]]**: [[ads_report_rows]] (광고 맞춤보고서 일일 수집본) 및 [[crawled_sales_data]] 등 일일 스크래핑 원본.

## 🔄 4. AI 작업 워크플로우 (Wiki 동기화)
로컬에 저장된 핵심 파일들([[RULES]], [[task]], [[walkthrough]], 그리고 이 문서 [[00_Project_Architecture]])은 `sync_obsidian.sh`에 의해 자동으로 외부 옵시디언 금고의 [[00_AI_Wiki]] 폴더로 동기화됩니다. 

> ⚠️ **주의:** 코드를 작성하기 전에, 당신의 현재 작업이 이 거대한 신경망 중 어떤 노드([[Wiki Link]])에 해당하는지 파악하고, 연결된 모든 노드를 시야(Context)에 넣으세요.
