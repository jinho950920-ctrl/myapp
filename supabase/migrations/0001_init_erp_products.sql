-- 1. 사업자 마스터 (Business Entities)
create table if not exists public.erp_business_entities (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    business_number text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 상품(SKU) 마스터 (Products)
create table if not exists public.erp_products (
    id uuid default gen_random_uuid() primary key,
    business_id uuid references public.erp_business_entities(id) on delete restrict,
    sku_code text not null unique,
    name text not null,
    status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISCONTINUED')),
    stock_quantity integer not null default 0,
    safe_days_to_stockout integer not null default 15,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 매입/수입 차수 관리 (Import Batches & Cost Tracking)
create table if not exists public.erp_import_batches (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.erp_products(id) on delete cascade not null,
    import_date date not null,
    quantity integer not null check (quantity > 0),
    
    -- 비용(현금주의) 정보
    factory_cost numeric not null default 0,
    shipping_cost numeric not null default 0,
    tax_cost numeric not null default 0,
    domestic_freight numeric not null default 0,
    
    -- 계산된 총비용 및 단가
    total_cost numeric not null default 0,
    unit_cost numeric not null default 0,
    
    -- 카드 엑셀 업로드와 매칭시키기 위한 FK (추후 재무 메뉴에서 연결됨)
    card_expense_id uuid,
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) 활성화 (대시보드 관리자용 통제)
alter table public.erp_business_entities enable row level security;
alter table public.erp_products enable row level security;
alter table public.erp_import_batches enable row level security;

-- 모든 관리자(인증된 사용자) 접근 허용 정책 (현재 권한 관리가 없으므로 모두 true 처리)
create policy "Enable all access for erp_business_entities" on public.erp_business_entities for all using (true);
create policy "Enable all access for erp_products" on public.erp_products for all using (true);
create policy "Enable all access for erp_import_batches" on public.erp_import_batches for all using (true);
