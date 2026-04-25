import bcrypt from 'bcrypt';
import qs from 'querystring';

interface NaverConfig {
  clientId: string;
  clientSecret: string;
}

export class NaverCommerceAPI {
  private clientId: string;
  private clientSecret: string;
  private baseUrl = 'https://api.commerce.naver.com/external';
  
  // 캐싱된 토큰 및 만료 시간 (10,800초 = 3시간)
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config?: NaverConfig) {
    this.clientId = config?.clientId || process.env.NAVER_CLIENT_ID || '';
    this.clientSecret = config?.clientSecret || process.env.NAVER_CLIENT_SECRET || '';
  }

  /**
   * Bcrypt 기반 OAuth 토큰 생성 및 캐싱 (CPU 부하 방지용 메모리 캐싱)
   */
  private async getAccessToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Naver Commerce API keys are missing. Please configure them in .env.local');
    }

    const now = Date.now();
    // 10분(600000ms) 여유를 두고 토큰 갱신
    if (this.cachedToken && this.tokenExpiresAt > now + 600000) {
      return this.cachedToken;
    }

    // 신규 발급 프로세스 시작
    const timestamp = now.toString();
    const password = `${this.clientId}_${timestamp}`;
    
    // CPU 집약적인 Sync 해싱 대신 비동기 해싱을 권장하나, 여기서는 Bcrypt Sync 사용
    const hashed = bcrypt.hashSync(password, this.clientSecret);
    const clientSecretSign = Buffer.from(hashed, 'utf-8').toString('base64');
    
    const params = qs.stringify({
      client_id: this.clientId,
      timestamp: timestamp,
      client_secret_sign: clientSecretSign,
      grant_type: 'client_credentials',
      type: 'SELF'
    });

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Naver API Token Error] ${response.status}:`, errorText);
      throw new Error(`Naver Token Request Failed: ${response.status}`);
    }

    const data = await response.json();
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = now + ((data.expires_in - 60) * 1000); // 1시간 등 내려온 expires_in 적용 (초단위)
    
    return this.cachedToken as string;
  }

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Naver API Error] ${response.status}:`, errorText);
      throw new Error(`Naver API Request Failed: ${response.status}`);
    }

    return response.json();
  }

  // ==========================================
  // Core API Methods
  // ==========================================

  /**
   * 변경된 상품 주문 내역 최신상태 롱폴링 조회
   */
  async getChangedOrders(lastChangedFrom: string) {
    return this.request('GET', `/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${lastChangedFrom}`);
  }

  /**
   * 정산 내역 조회
   */
  async getSettlementDay(date: string) {
    return this.request('GET', `/v1/seller/settlement/day?date=${date}`);
  }
}

// Singleton instance
export const naverAPI = new NaverCommerceAPI();
