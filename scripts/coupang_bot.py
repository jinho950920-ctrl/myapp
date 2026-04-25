import time
import random
import psycopg2
import json
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains

# 특수문자 완벽 인코딩 탑재 (대괄호 없음)
DB_URL = "postgresql://postgres.isjdjroiwwxnkoutgion:wlsghdud45%21%40@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"

def get_attached_driver():
    options = Options()
    options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
    return webdriver.Chrome(options=options)

def ensure_coupang_origin(driver):
    # 1. 봇 탐지기(Datadome)를 속이기 위해, 열려있는 탭 중 쿠팡 탭이 있는지 확인합니다.
    coupang_tab = None
    for handle in driver.window_handles:
        driver.switch_to.window(handle)
        if "coupang.com" in driver.current_url:
            coupang_tab = handle
            break
            
    # 2. 쿠팡 탭이 없거나 빈 탭이라면, 자바스크립트로 강제 이동합니다. (driver.get 절대 금지)
    if not coupang_tab:
        print(">> 🕵️ 스텔스 위장 중: 쿠팡 메인 페이지를 거쳐 정상 유저인 척 진입합니다...")
        try:
            driver.execute_script("window.location.href = 'https://www.coupang.com';")
        except:
            pass # chrome://newtab 등에서는 막힐 수 있으나 배치파일이 기본으로 띄우므로 안전
        time.sleep(3)

def stealth_navigate_and_scroll(driver, url):
    # 잘못된 탭(인덱스 0)으로 강제 전환되는 버그(try/except switch_to.window) 삭제!
    # 현재 활성화된 올바른 쿠팡 탭에서 자바스크립트로 네이티브 이동 (Datadome 우회를 위해 driver.get 금지)
    driver.execute_script(f"window.location.href = '{url}';")
    
    # [Anti-Bot V2] 더 길고 불규칙한 초기 진입 딜레이 (최대 15초)
    time.sleep(random.uniform(8.5, 15.5)) 
    
    try:
        # [Anti-Bot V2] 사람처럼 허공 마우스 이동 및 랜덤 빈 공간 클릭 노이즈 생성
        actions = ActionChains(driver)
        for _ in range(random.randint(2, 4)):
            actions.move_by_offset(random.randint(-150, 150), random.randint(-150, 150)).perform()
            time.sleep(random.uniform(0.3, 1.1))
            if random.random() > 0.5:
                actions.click().perform()
    except: pass
    
    # 마우스/키보드를 뺏지 않는 백그라운드 스크롤 (이때 비동기 API 통신이 유발됨)
    for _ in range(random.randint(4, 7)):
        scroll_amount = random.randint(300, 900)
        driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
        time.sleep(random.uniform(1.2, 3.2))
        
    # [핵심] 스크롤로 유발된 통신(quantity-info)이 완료되어 후킹될 때까지 최대 5초 대기
    for _ in range(10):
        try:
            if driver.execute_script("return window.__intercepted_quantity_info;"):
                break
        except:
            pass
        time.sleep(0.5)

def extract_social_proof(json_string):
    if not json_string: return "0"
    try:
        data = json.loads(json_string)
        if isinstance(data, list) and len(data) > 0:
            for module in data[0].get("moduleData", []):
                if module.get("viewType") == "PRODUCT_DETAIL_SOCIAL_PROOF_NUDGE" or "socialProofNumUsers" in module:
                    return str(module.get("socialProofNumUsers", "0"))
    except: pass
    return "0"

if __name__ == "__main__":
    print("\n--- 🤖 대시보드 연동 매크로 (V 9.0 Datadome 스텔스 우회 완결판) ---")
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        cur.execute("SELECT id, url, alias FROM scraping_targets WHERE is_active = true")
        targets = cur.fetchall()
    except Exception as e:
        print(f"❌ DB 연결 실패: {e}")
        exit()
        
    if not targets:
        print(">> 대시보드에 켜져 있는 타겟이 없습니다.")
        exit()

    driver = None
    try:
        driver = get_attached_driver()
        print(f">> 총 {len(targets)}개의 타겟 장전 완료!")
        
        print(">> 🕵️ 스텔스 위장 중: 쿠팡 메인 페이지를 거쳐 정상 유저인 척 진입합니다...")
        ensure_coupang_origin(driver)
        
        hook_script = """
            if (!window.__wiretap_installed) {
                window.__wiretap_installed = true;
                window.__intercepted_quantity_info = null;
                
                const oldFetch = window.fetch;
                window.fetch = async function(...args) {
                    const response = await oldFetch.apply(this, args);
                    if (args[0] && typeof args[0] === 'string' && args[0].includes('quantity-info')) {
                        const clone = response.clone();
                        clone.text().then(text => window.__intercepted_quantity_info = text).catch(e=>null);
                    }
                    return response;
                };
                
                const nativeOpen = XMLHttpRequest.prototype.open;
                const nativeSend = XMLHttpRequest.prototype.send;
                
                XMLHttpRequest.prototype.open = function(method, url) {
                    this._url = url;
                    nativeOpen.apply(this, arguments);
                };
                
                XMLHttpRequest.prototype.send = function() {
                    this.addEventListener('load', function() {
                        if (this._url && this._url.includes('quantity-info')) {
                            window.__intercepted_quantity_info = this.responseText;
                        }
                    });
                    nativeSend.apply(this, arguments);
                };
            }
        """
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': hook_script})
        print(">> 🎧 통신 도청기 장착 완료! 은밀하게 쿠팡 본진에 잠입합니다.")
        
        for t_id, t_url, t_alias in targets:
            print(f"\n[타겟: {t_alias}] 스텔스 우회 이동 중...")
            
            stealth_navigate_and_scroll(driver, t_url)
            
            # try:
            #     import os
            #     os.makedirs("downloads", exist_ok=True)
            #     safe_alias = str(t_alias).replace('/', '_').replace(' ', '_')
            #     with open(f"downloads/debug_{safe_alias}.html", "w", encoding="utf-8") as f:
            #         f.write(driver.page_source)
            #     print(f">> 🔎 디버깅용 HTML 원본 저장 완료: downloads/debug_{safe_alias}.html")
            # except Exception as e:
            #     print("HTML 저장 실패:", e)

            
            price_text = "0"
            review_text = "0"
            buy_count_text = "0"
            
            try:
                meta_price = driver.execute_script("return document.querySelector('meta[itemprop=\"price\"]')?.content;")
                if meta_price and str(meta_price).isdigit():
                    price_text = str(meta_price)
                else:
                    price_selectors = [
                        ".total-price > strong", 
                        ".price-value", 
                        "em.price-value", 
                        "span.price-value", 
                        ".prod-price .total-price > strong",
                        ".price-amount.final-price-amount"
                    ]
                    for selector in price_selectors:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        for elem in elements:
                            txt = (elem.get_attribute("textContent") or "").strip().replace(",", "")
                            nums = re.findall(r'\d+', txt)
                            if nums:
                                price_text = nums[0]
                                break
                        if price_text != "0":
                            break
            except Exception as e: pass
            
            try:
                # 0순위: JSON-LD (가장 정확, 추천/광고 상품 오염 100% 원천 차단)
                page_src = driver.page_source
                json_ld_match = re.search(r'"ratingCount"\s*:\s*"?(\d+)"?', page_src, re.IGNORECASE)
                if json_ld_match:
                    review_text = json_ld_match.group(1)
                else:
                    # 차선책: 광고 상품을 우회하는 엄격한 본문 종속 CSS 선택자
                    review_selectors = [
                        ".rating-total-count",
                        ".prod-buy-header__review-count", 
                        "a[data-log='top_review'] span.count",
                        "a[href*='#btfReview'] span.count",
                        "div.prod-author-and-rating span.count",
                        ".prod-review-nav-link > span.count"
                    ]
                    for selector in review_selectors:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        for elem in elements:
                            txt = (elem.get_attribute("textContent") or "").strip().replace(",", "")
                            nums = re.findall(r'\d+', txt)
                            if nums:
                                review_text = nums[0]
                                break
                        if review_text != "0":
                            break
            except Exception as e: pass
            
            try:
                api_response = driver.execute_script("return window.__intercepted_quantity_info;")
                if api_response:
                    buy_count_text = extract_social_proof(api_response)
                    print(f">> 🔓 [도청 성공] JSON 원본 획득 완료! ({buy_count_text}명)")
                else:
                    print(">> [경고] 도청기가 데이터를 확보하지 못했습니다.")
            except Exception as e: 
                print(f"구매자 수 추출 에러: {e}")
            
            print(f"✅ 최종 결과 👉 가격: {price_text}원 / ⭐ {review_text} / 🔥 리얼 구매자: {buy_count_text}명")
            
            try:
                # 1. 대상 URL의 오늘 날짜 기록이 있으면 덮어쓰고, 없으면 새로 추가 (하루 1개만 영구 누적 보장)
                safe_price = int(price_text) if price_text and price_text.isdigit() else 0
                
                cur.execute(
                    """
                    INSERT INTO scraping_history (target_id, scraped_date, price, review_count, buy_count)
                    VALUES (%s, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::DATE, %s, %s, %s)
                    ON CONFLICT (target_id, scraped_date) 
                    DO UPDATE SET 
                        price = EXCLUDED.price, 
                        review_count = EXCLUDED.review_count, 
                        buy_count = EXCLUDED.buy_count,
                        created_at = NOW();
                    """,
                    (t_id, safe_price, review_text, buy_count_text)
                )
                
                # 2. 대시보드 메인 표시에 보여줄 최근 상태 업데이트
                cur.execute(
                    "UPDATE scraping_targets SET last_price = %s, last_review_count = %s, last_buy_count = %s, last_scraped_at = CURRENT_TIMESTAMP WHERE id = %s", 
                    (price_text, review_text, buy_count_text, t_id)
                )
                conn.commit()
                print(">> ☁️ 대시보드 연동(저장) 완료! (영구 기록 완료)")
            except Exception as e:
                print(f"DB 저장 에러: {e}")
                conn.rollback()
                
            # [Anti-Bot V2] 다음 타겟으로 이동하기 전 쿨다운 타임을 대폭 확대 (최대 35초 대기)
            time.sleep(random.uniform(15, 35))
            
    except Exception as e:
        print(f"전체 에러 발생: {e}")
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()
        if driver:
            try:
                driver.delete_all_cookies()
                print(">> 🧹 브라우저 쿠키를 깨끗하게 초기화했습니다. (다음 실행 시 봇 탐지 방어)")
                driver.quit()
                print(">> 🚪 브라우저 창을 완벽하게 종료하여 메모리를 해제했습니다.")
            except Exception as e:
                print(f"브라우저 종료 중 에러: {e}")
        print("\n🎉 모든 타겟팅 스크래핑 완벽 종료!")

