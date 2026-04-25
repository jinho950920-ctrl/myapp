#!/bin/bash
# 쿠팡 무인 엑셀 추출 스크립트 전용 크론(Cron) 실행기
# 환경변수 로드 (node 명령어를 찾기 위함)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export TZ="Asia/Seoul"

# 작업 디렉토리 진입
cd /home/jinho/erp-dashboard

# 로그 폴더 확인 및 생성
mkdir -p logs

# 현재 시간 포맷
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
echo "========================================" >> logs/scraper_cron.log
echo "[시작] $TIMESTAMP - 엑셀 다운로드 자동화 실행" >> logs/scraper_cron.log

# 백그라운드 스크립트 구동 (기존 잔여 프로세스 정리 후 병합 실행)
pkill -f wing_sales_scraper
# 서버 RAM 누수 방지: 기존 크롤링 후 남아있을 수 있는 가상 브라우저 완전 종료
pkill -f chrome 2>/dev/null
pkill -f chromium 2>/dev/null
rm -f downloads/*.xlsx

# 1. 스크립트 실행 (엑셀 데이터 가로채기 다운로드)
echo "▶ [STEP 1] 쿠팡 윙 및 광고센터 엑셀 다운로드 봇 출격" >> logs/scraper_cron.log
xvfb-run -a npx -y tsx scripts/wing_sales_scraper.ts >> logs/scraper_cron.log 2>&1

# 2. 다운로드 된 엑셀 데이터를 Supabase DB로 파싱 및 업데이트 (Upsert)
echo "▶ [STEP 2] 판매분석 엑셀 DB 자동 업서트(Upsert) 시작" >> logs/scraper_cron.log
npx -y tsx scripts/parse_wing_sales.ts >> logs/scraper_cron.log 2>&1

echo "▶ [STEP 3] 광고센터 엑셀 DB 자동 업서트(Upsert) 시작" >> logs/scraper_cron.log
npx -y tsx scripts/parse_ads_sales.ts >> logs/scraper_cron.log 2>&1

# 종료 시간 기록
END_TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
echo "[종료] $END_TIMESTAMP - 엑셀 다운로드 및 DB 동기화 파이프라인 완전 종료" >> logs/scraper_cron.log
echo "========================================" >> logs/scraper_cron.log
