"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Home, Package, Truck, MessageSquare, DollarSign, Target, Settings, Eye } from "lucide-react";

const items = [
  { title: "홈 대시보드", url: "/", icon: Home },
  { title: "상품 및 재고", url: "/products", icon: Package },
  { title: "주문 및 물류", url: "/orders", icon: Truck },
  { title: "스마트 고객센터", url: "/cs", icon: MessageSquare },
  { title: "재무 및 정산", url: "/finance", icon: DollarSign },
  { title: "마케팅 및 광고", url: "/marketing", icon: Target },
  { title: "경쟁사 레이더", url: "/competitors", icon: Eye },
  { title: "설정 및 제어", url: "/settings", icon: Settings },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="font-bold text-xl tracking-tight text-primary">ERP Dashboard</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase text-muted-foreground mt-4 mb-2 px-2">
            Master Domains
          </SidebarGroupLabel>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                {/* @ts-expect-error Shadcn type mismatch with React 19 / Slot */}
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="text-xs text-muted-foreground text-center flex-1">
          v1.0.0 Alpha
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
