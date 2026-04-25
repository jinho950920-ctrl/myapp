import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');

export async function GET() {
  try {
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ accounts: [] });
    }
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // 환경 변수에서 SHOPPING_ACCOUNTS 추출 (따옴표 고려)
    const match = envContent.match(/^SHOPPING_ACCOUNTS="(.*)"$/m) || envContent.match(/^SHOPPING_ACCOUNTS='(.*)'$/m);
    
    if (match && match[1]) {
      // 백슬래시 이스케이프 해제
      const jsonStr = match[1].replace(/\\"/g, '"');
      return NextResponse.json({ accounts: JSON.parse(jsonStr) });
    }
    return NextResponse.json({ accounts: [] });
  } catch (error) {
    console.error("GET ACCOUNTS ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { accounts } = await request.json();
    
    // JSON 직렬화 및 내부 쌍따옴표 이스케이프 처리
    const jsonStr = JSON.stringify(accounts).replace(/"/g, '\\"');
    const newEnvLine = `SHOPPING_ACCOUNTS="${jsonStr}"`;

    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, newEnvLine + '\n', 'utf8');
    } else {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // 이미 SHOPPING_ACCOUNTS 키가 있으면 덮어쓰기, 없으면 맨 아래에 추가
      if (/^SHOPPING_ACCOUNTS=.*$/m.test(envContent)) {
        envContent = envContent.replace(/^SHOPPING_ACCOUNTS=.*$/m, newEnvLine);
      } else {
        envContent += `\n\n# Dynamic Accounts Manager\n${newEnvLine}\n`;
      }
      
      fs.writeFileSync(envPath, envContent, 'utf8');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST ACCOUNTS ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
