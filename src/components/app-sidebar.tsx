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
import { Home, Package, Truck, MessageSquare, DollarSign, Target, Settings, Eye, Bot, BarChart2 } from "lucide-react";

const items = [
  { title: "홈 대시보드", url: "/", icon: Home },
  { title: "상품 및 재고", url: "/products", icon: Package },
  { title: "주문 및 물류", url: "/orders", icon: Truck },
  { title: "스마트 고객센터", url: "/cs", icon: MessageSquare },
  { title: "재무 및 정산", url: "/finance", icon: DollarSign },
  { title: "마케팅 및 광고", url: "/marketing", icon: Target },
  { title: "데이터 센터", url: "/datacenter", icon: BarChart2 },
  { title: "자동화 및 연동", url: "/automations", icon: Bot },
  { title: "설정 및 제어", url: "/settings", icon: Settings },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-none">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <div className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">ERP Dash</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 mt-6 mb-3 px-4">
            Master Domains
          </SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {items.map((item) => (
              <SidebarMenuItem key={item.title} className="mb-1">
                <SidebarMenuButton
                  className="h-11"
                  render={
                    <Link
                      href={item.url}
                      className="flex items-center gap-3 px-3 w-full rounded-lg transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 group"
                    />
                  }
                >
                  <item.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                  <span className="font-medium text-[15px]">{item.title}</span>
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
