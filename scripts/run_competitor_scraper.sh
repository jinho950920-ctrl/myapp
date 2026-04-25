#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
# 실행 전 환경 변수 로드 및 기준 폴더 이동
cd /home/jinho/erp-dashboard

# 경로 생성
mkdir -p logs
mkdir -p downloads

LOG_FILE="logs/competitor_cron.log"
echo "========================================" >> $LOG_FILE
echo "[시작] $(date '+%Y-%m-%d_%H-%M-%S') - [스텔스] 경쟁사 자동 크롤링 V1.0 시작" >> $LOG_FILE

# Playwright Xvfb 무헤드(Headless) 구동! 
# 포트 9222나 유저의 크롬 브라우저 개입이 1도 없으며, 시크릿 탭으로만 접근합니다.
xvfb-run -a -s "-screen 0 1920x1080x24" npx tsx scripts/competitor_scraper.ts >> $LOG_FILE 2>&1

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ 런타임 에러 발생 (Exit code: $EXIT_CODE)" >> $LOG_FILE
else
  echo "✅ 경쟁사 데이터 Base DB Upsert 정상 처리 완료" >> $LOG_FILE
fi

echo "[종료] $(date '+%Y-%m-%d_%H-%M-%S') - 경쟁사 크롤러 셧다운" >> $LOG_FILE
echo "========================================" >> $LOG_FILE
