import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logAutomation } from './logger';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.DATABASE_URL;
let cleanedUrl = dbUrl || '';
const bracketMatch = cleanedUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  const rawPw = bracketMatch[1];
  cleanedUrl = cleanedUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
}

const pool = new Pool({
  connectionString: cleanedUrl,
  ssl: { rejectUnauthorized: false }
});

const CREDENTIALS_DIR = path.resolve(process.cwd(), 'credentials');

// --- Time Shift Logic (2:30 PM) ---
function getTargetDateStr(isLast7Days = false): { start_date: string, end_date: string } {
    const now = new Date();
    // Convert current time to KST (UTC +9)
    const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    
    // Check if it's before 14:30 KST
    const hours = kstNow.getUTCHours();
    const minutes = kstNow.getUTCMinutes();
    const isBeforeShift = (hours < 14) || (hours === 14 && minutes < 30);
    
    const targetDate = new Date(kstNow);
    if (isBeforeShift) {
        targetDate.setUTCDate(targetDate.getUTCDate() - 2); // D-2
    } else {
        targetDate.setUTCDate(targetDate.getUTCDate() - 1); // D-1
    }

    if (isLast7Days) {
        const startTargetDate = new Date(targetDate);
        startTargetDate.setUTCDate(startTargetDate.getUTCDate() - 6);
        return {
            start_date: startTargetDate.toISOString().split('T')[0],
            end_date: targetDate.toISOString().split('T')[0]
        };
    } else {
        const dayStr = targetDate.toISOString().split('T')[0];
        return { start_date: dayStr, end_date: dayStr };
    }
}

// --- Dynamic Request Wrapper ---
async function fetchWingApi(url: string, cookieString: string, payload?: any) {
    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const options: any = { method: payload ? 'POST' : 'GET', headers };
    if (payload) options.body = JSON.stringify(payload);

    const res = await fetch(url, options);
    if (!res.ok) {
        throw new Error(`API fetch failed with status ${res.status}`);
    }
    return res.json();
}

async function scrapeInsightForAccount(alias: string, cookieString: string) {
    await logAutomation('WING_INSIGHT', `Start scraping insight data for [${alias}]`, 'RUNNING');
    
    const dailyTarget = getTargetDateStr(false);
    const weeklyTarget = getTargetDateStr(true);
    
    console.log(`[${alias}] Target single day: ${dailyTarget.start_date}`);
    console.log(`[${alias}] Target 7 days: ${weeklyTarget.start_date} ~ ${weeklyTarget.end_date}`);

    try {
        // [PENDING API ENDPOINTS] 
        // 1. Sales Analysis (All Options)
        // const salesApiUrl = `https://wing.coupang.com/.../sales-analysis?start_date=${dailyTarget.start_date}...`; 
        console.log("-> 1. Mock Fetching Sales Analysis API");

        // 2. Traffic Analysis
        // const trafficApiUrl = `https://wing.coupang.com/...`;
        console.log("-> 2. Mock Fetching Traffic Analysis API");

        // 3. Vendor Item Summary (Search Keywords inside item)
        // const itemSummaryUrl = `https://wing.coupang.com/...`;
        console.log("-> 3. Mock Fetching Generic Keyword API");

        // [MODING SPECIFIC] Category Insight
        if (alias === '쿠팡 모딩') {
            console.log("-> 4. Mock Fetching Special Category Competitors API");
            console.log("-> 5. Mock Fetching Special Category Keywords API");
        }

        await logAutomation('WING_INSIGHT', `Insight extraction complete for [${alias}]`, 'SUCCESS');
    } catch (err: any) {
        console.error(`[${alias}] Error fetching insight APIs:`, err);
        await logAutomation('WING_INSIGHT', `Insight API error: ${err.message}`, 'FAILED');
    }
}

async function main() {
    console.log("🚀 Starting Coupang Wing Insight Crawler (Request Hybrid)");
    const wingDir = path.join(CREDENTIALS_DIR, 'wing_sessions');
    if (!fs.existsSync(wingDir)) {
        console.error("No wing_sessions directory found.");
        process.exit(1);
    }

    const files = fs.readdirSync(wingDir);
    let runCount = 0;
    
    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const alias = file.replace('.json', '');
        
        try {
            const data = JSON.parse(fs.readFileSync(path.join(wingDir, file), 'utf8'));
            if (!data.cookies) continue;
            
            // Format cookies for request header
            const cookieString = data.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
            
            await scrapeInsightForAccount(alias, cookieString);
            runCount++;
            
            // Add a small delay between accounts
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error(`Skipping ${alias} due to parsing error.`);
        }
    }
    
    console.log(`\n🎉 Total ${runCount} accounts insight fetched.`);
    process.exit(0);
}

main();
