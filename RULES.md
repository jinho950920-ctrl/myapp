CRITICAL SYSTEM INSTRUCTION: Before executing ANY prompt, generating code, or modifying files, you MUST read and strictly obey all rules defined in this file. Failure to do so will result in system breakdown.

# ERP Dashboard Absolute Rules V2.0

## 0. [MANDATORY_SELF_CHECK] CROSS-CHECK BEFORE ANY ACTION.
   - Before writing new code, changing existing logic, or modifying settings, you **MUST** perform a self-reflection step. Ask yourself: "Does this modification contradict or conflict with any documents linked via `[[Wiki Link]]`?"
   - You must review connected documents in the neural network to ensure absolute consistency across the project.

## [대시보드 운영 절대 금지 사항 (READ-ONLY)]
11. **내 상품 가격 절대 수정 금지 (DO NOT CHANGE MY PRODUCT PRICES):** 경쟁사의 가격을 모니터링은 하지만, 내 샵의 상품 가격은 어떤 경우에도 봇이 스스로 변경하거나 수정할 수 없다.
12. **상품 생성/초기화/삭제 금지:** 상품 마스터 데이터는 오직 열람 및 매핑용(READ-ONLY)이며, 로직 에러로 내 상품이 지워지거나 변형되는 코드는 절대 실행해서는 안 된다.
13. **빈 옵션 코드 매핑 치명적 오류 방지 (Synthetic Key Rule):** 네이버나 쿠팡에서 `option_code`, `option_id`가 비어있는 상품 데이터를 매핑할 때, 절대 빈 문자열(`""`)을 단일 키로 DB에 저장해서는 안 된다. 모든 매핑 로직(`productActions.ts`, `finance.ts`)은 옵션 코드가 비어있을 경우 반드시 `NAME::상품명::옵션명` 형태의 '가상 복합 키(Synthetic Key)'를 생성하여 고유성을 보장해야 한다. 빈 문자열이 키로 들어가면 모든 빈 옵션 상품의 매출이 하나의 마스터 상품으로 블랙홀처럼 흡수되는 치명적인 병합 에러가 발생한다.
14. **네이버 매출 SQL 쿼리 필수 컬럼 규칙 (Naver Query Rule):** `naver_sales` 테이블을 조회하는 모든 SQL(`finance.ts`, `productActions.ts` 등)은 반드시 `product_name`, `option_name` 컬럼을 SELECT/GROUP BY에 포함해야 한다. `option_code`만으로 GROUP BY하면 빈 옵션 코드 상품들이 하나로 뭉개져서 Synthetic Key 매칭이 불가능해지고 대시보드에 데이터가 전혀 나타나지 않는 치명적인 버그가 발생한다.
15. **네이버 순이익 공식 (Naver Net Profit Formula):** 네이버 상품의 순이익 산출 공식은 반드시 `매출 - 원가(COGS) - 배송/택배비(원) - 포장비/자재/인건비(원) - 플랫폼수수료(할인된금액 × 수수료율%) - 광고비`이며, 모든 비용 항목은 `product_platform_costs` 테이블의 `naver_general` 타입 정책을 우선 참조한다. 해당 정책이 없으면 기본 수수료 3%만 적용되며, 배송비/포장비는 0원으로 처리된다.

## 3. [STRICT] MANDATORY SELF-TESTING & PROOF BEFORE COMPLETION.
   - Do not just say you "tested" it. You must physically run validation commands and present the terminal output as proof.
   - **For Next.js UI:** Run `npm run build` or `npm run lint`. You must confirm there are no compilation or hydration errors.
   - **For Crawlers/API:** Run a local dry-run script (e.g., `node test_crawler.js`) to verify the data parsing logic works before integrating it into the main system.
   - If an error occurs during testing, DO NOT report completion. Fix the error first.

## 4. UI-FIRST PHASE LOCK.
   - The user has mandated a strict "UI Only" phase. Do not implement backend connections, real databases, or background web crawlers until the user explicitly states "UI modification is complete."
   - All dashboard tabs must remain in high-fidelity mockup visual states.

## 5. ENCODING & KOREAN STANDARD TIME (KST) MANDATE.
   - **Encoding:** When generating scripts, `.bat` files, or handling stdout for Windows from WSL, ALWAYS use `UTF-8` or `chcp 65001` to prevent Korean character corruption.
   - **Timezone:** All timestamps, cron jobs, DB records, logs, and UI 일 displays MUST be strictly set to **Korean Standard Time (KST, Asia/Seoul, UTC+9)**. Never default to UTC without explicitly converting it to KST for the user.

## 6. MANDATORY [[Wiki Link]] CASCADE REVIEW.
   - When updating or creating any `.md` documents, you **MUST** link to any mentioned documents, DB tables, or concepts using the Obsidian `[[Document_Name]]` syntax.
   - **(CASCADE REVIEW RULE):** When you modify a document or code file, you MUST explicitly search for and review all other documents connected to it via `[[Wiki Link]]`. If the current change breaks the logic of a connected document, you must update the connected document simultaneously to maintain neural network consistency.
   - Data Flow Template: `[UI 컴포넌트명] 표시 데이터: [[연결된_DB_테이블명.md]]의 특정 컬럼 데이터 사용 / 호출 API: [[연결된_API_문서.md]]`

## 7. [AI SAFETY] NO UNAUTHORIZED PACKAGE INSTALLATIONS.
   - Do not run `npm install`, `pip install`, or add new dependencies (libraries) to `package.json` without explaining WHY it is necessary and getting explicit approval from the user first. Bloatware must be prevented.

## 8. [AI SAFETY] THE 3-STRIKE ERROR LOOP BREAKER.
   - If you encounter the same error or a similar chain of errors 3 times in a row while trying to fix a bug, **STOP IMMEDIATELY**.
   - Do not guess or write random patches. Stop and explain the root cause of the loop to the user, present two possible alternative solutions, and ask for human direction.

## 9. [AI SAFETY] NEVER OVERWRITE ENTIRE WORKING FILES.
   - When fixing a small bug in a large file, do not rewrite or refactor the entire file. Only modify the specific lines or functions necessary to fix the issue. Keep changes atomic to prevent breaking previously working code.

## 10. [ANTI-REGRESSION] MANDATORY SOURCE READING BEFORE CODE MERGE/MIGRATION.
   - AI Memory is flawed. When tasked with merging, moving, or refactoring code from an old/test script into a production script, **YOU MUST NOT rely on your memory or summaries.**
   - You MUST physically call `view_file` to read the exact lines of the source file BEFORE attempting to write or inject the code.
   - Failure to do this causes "Regression" (dropping previously implemented features, like missing a specific button click). Always cross-check the old code line-by-line during migration using atomic replacements.

## 11. [ITERATIVE CROSS-VERIFICATION LOOP] 무결성 반복 검증 및 문서 동기화 루프
   - 새로운 기능 추가나 코드 수정 요청을 받았을 때, 봇은 반드시 아래의 **'수정-검증-영향 평가-문서화' 5단계 루프**를 엄격히 준수해야 한다.
   1. **문서 선행 탐색:** 작업 전 요구사항과 연관된 옵시디언 마크다운 문서 및 DB 스키마를 1순위로 확인하여 기존 규칙과 충돌하는지 파악한다.
   2. **원자적 수정:** 파악한 내용을 바탕으로 요청받은 수정 사항을 코드에 반영한다.
   3. **1차 검토 (기능 동작):** 수정한 기능 자체가 의도한 대로 오류 없이 동작하는지 테스트 스크립트나 터미널 빌드로 1차 검증한다.
   4. **2차 검토 (사이드 이펙트 추적):** 수정한 코드가 연관된 다른 파일이나 UI 탭에 연쇄적인 오류를 일으키지 않았는지 교차 검증(`npm run build` 등)한다. 만약 오류가 발견되면 즉시 2번 단계로 돌아가 코드를 재수정하고 3~4번 검토를 반복 수행한다.
   5. **옵시디언 후행 동기화:** 오류가 0건으로 판단되고 모든 테스트가 통과되었을 때만 마지막으로 연관된 옵시디언 문서를 최신 상태로 업데이트(수정)하고 작업을 완료 보고한다.
