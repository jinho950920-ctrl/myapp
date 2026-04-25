import crypto from 'crypto';

interface CoupangConfig {
  vendorId: string;
  accessKey: string;
  secretKey: string;
}

export class CoupangAPI {
  private vendorId: string;
  private accessKey: string;
  private secretKey: string;
  private baseUrl = 'https://api-gateway.coupang.com';

  constructor(config?: CoupangConfig) {
    this.vendorId = config?.vendorId || process.env.COUPANG_VENDOR_ID || '';
    this.accessKey = config?.accessKey || process.env.COUPANG_ACCESS_KEY || '';
    this.secretKey = config?.secretKey || process.env.COUPANG_SECRET_KEY || '';
  }

  private generateHmacSignature(method: string, url: string): { authorization: string; datetime: string } {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('Coupang API keys are missing. Please configure them in .env.local');
    }

    const datetime = new Date().toISOString().replace(/(-|:|T|\..*)/g, '').substring(0, 15) + 'Z';
    const message = datetime + method + url;
    
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');
      
    const authorization = `CEA algorithm=HmacSHA256, access-key=${this.accessKey}, signed-date=${datetime}, signature=${signature}`;
    
    return { authorization, datetime };
  }

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const { authorization } = this.generateHmacSignature(method, endpoint);
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'X-Extended-Timeout': '90000',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Coupang API Error] ${response.status} ${response.statusText}:`, errorText);
      throw new Error(`Coupang API Request Failed: ${response.status}`);
    }

    return response.json();
  }

  // ==========================================
  // Core API Methods
  // ==========================================

  /**
   * 신규 발주/주문 내역 수집
   */
  async getOrders(createdAtFrom: string, createdAtTo: string) {
    const endpoint = `/v2/providers/openapi/apis/api/v4/vendors/${this.vendorId}/ordersheets?createdAtFrom=${createdAtFrom}&createdAtTo=${createdAtTo}&status=ACCEPT`;
    return this.request('GET', endpoint);
  }

  /**
   * 판매 상품 마스터 리스트 조회
   */
  async getProducts(nextToken?: string) {
    let endpoint = `/v2/providers/openapi/apis/api/v4/vendors/${this.vendorId}/products`;
    if (nextToken) endpoint += `?nextToken=${nextToken}`;
    return this.request('GET', endpoint);
  }
}

// Singleton instance ready to use across the Next.js API routes
export const coupangAPI = new CoupangAPI();
