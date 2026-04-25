"use server";

import { query } from "@/lib/db";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { revalidatePath } from "next/cache";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function getScrapingTargets() {
  try {
    const res = await query(`
      SELECT t.*,
        (SELECT price FROM scraping_history h WHERE h.target_id = t.id AND h.scraped_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::DATE ORDER BY h.scraped_date DESC LIMIT 1) as prev_price,
        (SELECT review_count FROM scraping_history h WHERE h.target_id = t.id AND h.scraped_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::DATE ORDER BY h.scraped_date DESC LIMIT 1) as prev_review,
        (SELECT buy_count FROM scraping_history h WHERE h.target_id = t.id AND h.scraped_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::DATE ORDER BY h.scraped_date DESC LIMIT 1) as prev_buy
      FROM scraping_targets t 
      ORDER BY t.created_at DESC
    `);
    return { success: true, targets: res.rows };
  } catch (err: any) {
    console.error("DB Error:", err);
    return { success: false, error: err.message };
  }
}

export async function getScrapingHistory(targetId: string, days: number = 30) {
  try {
    const res = await query(`
      SELECT scraped_date, price, review_count, buy_count
      FROM scraping_history
      WHERE target_id = $1 AND scraped_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::DATE - $2::interval
      ORDER BY scraped_date ASC
    `, [targetId, `${days} days`]);
    return { success: true, history: res.rows };
  } catch (err: any) {
    console.error("DB Error:", err);
    return { success: false, error: err.message };
  }
}

export async function addScrapingTarget(url: string, alias: string) {
  try {
    const res = await query(
      "INSERT INTO scraping_targets (url, alias, is_active) VALUES ($1, $2, true) RETURNING *",
      [url, alias]
    );
    revalidatePath("/automations");
    return { success: true, target: res.rows[0] };
  } catch (err: any) {
    console.error("DB Error:", err);
    return { success: false, error: err.message };
  }
}

export async function toggleTargetState(id: string, currentState: boolean) {
  try {
    const res = await query(
      "UPDATE scraping_targets SET is_active = $1 WHERE id = $2 RETURNING *",
      [!currentState, id]
    );
    revalidatePath("/automations");
    return { success: true, target: res.rows[0] };
  } catch (err: any) {
    console.error("DB Error:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteTarget(id: string) {
  try {
    await query("DELETE FROM scraping_targets WHERE id = $1", [id]);
    revalidatePath("/automations");
    return { success: true };
  } catch (err: any) {
    console.error("DB Error:", err);
    return { success: false, error: err.message };
  }
}

export async function getCrawledData() {
  try {
    const res = await query(
      "SELECT * FROM crawled_sales_data ORDER BY created_at DESC LIMIT 50"
    );
    return { success: true, data: res.rows };
  } catch (err: any) {
    console.error("DB Error:", err);
    return { success: false, error: err.message };
  }
}

export async function runPythonMacro() {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // 1. 고객님의 바탕화면에 있는 [크롬 실행기.bat]를 그대로 실행합니다. (새 창으로 실행됨)
    await execAsync(`powershell.exe -Command "Start-Process 'C:\\Users\\jinho\\OneDrive\\바탕 화면\\크롬 실행기.bat'"`);
    
    // 크롬이 켜질 때까지 3초 안전 대기
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. 바탕화면에 있는 [봇실행최종.py]를 윈도우 파이썬으로 직접 띄워줍니다.
    // -Wait 옵션이 있어서 검은색 파이썬 창이 떠서 진행률이 실시간으로 보이며, 창이 꺼지면 비로소 서버가 '성공' 처리를 합니다!
    const pythonCommand = `powershell.exe -Command "Start-Process python.exe -ArgumentList 'C:\\Users\\jinho\\OneDrive\\바탕 화면\\봇실행최종.py' -Wait"`;
    await execAsync(pythonCommand);
    
    return { success: true };
  } catch (err: any) {
    console.error("Macro Execution Error:", err);
    return { success: false, error: err.message };
  }
}



export async function getWingStatus() {
  try {
    const statusPath = path.join(process.cwd(), 'credentials', 'wing_status.json');
    if (fs.existsSync(statusPath)) {
      return JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    }
    return { requires2FA: false, lastChecked: null };
  } catch (err) {
    return { requires2FA: false, lastChecked: null };
  }
}

export async function triggerWingLogin() {
  try {
    const { exec } = require('child_process');
    const scriptPath = path.join(process.cwd(), 'scripts', 'wing_login.ts');
    exec(`npx tsx "${scriptPath}"`, { cwd: process.cwd() });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
