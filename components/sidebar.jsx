"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Shield, MessageSquare, Database, BookOpen, Menu, Layers, Activity, Settings, Server, AlertTriangle, FolderKanban, Radio, Bell, BrainCircuit } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";

const routes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        color: "text-sky-500",
        bgColor: "bg-sky-500/10",
    },
    {
        label: "Incidents",
        icon: AlertTriangle,
        href: "/incidents",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
    },
    {
        label: "Problems",
        icon: FolderKanban,
        href: "/problems",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
    },
    {
        label: "RCA",
        icon: BrainCircuit,
        href: "/rca",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
    },
    {
        label: "Changes",
        icon: Radio,
        href: "/changes",
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
    },
    {
        label: "Credentials",
        icon: Shield,
        href: "/creds",
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
    },
    {
        label: "Chat",
        icon: MessageSquare,
        href: "/chat",
        color: "text-pink-500",
        bgColor: "bg-pink-500/10",
    },
    {
        label: "CMDB",
        icon: Database,
        href: "/cmdb",
        color: "text-amber-600",
        bgColor: "bg-amber-600/10",
    },
    {
        label: "Services",
        icon: Server,
        href: "/services",
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
    },
    {
        label: "Knowledge Base",
        icon: BookOpen,
        href: "/knowledge",
        color: "text-teal-500",
        bgColor: "bg-teal-500/10",
    },
    {
        label: "ServiceNow",
        icon: Layers,
        href: "/integrations/servicenow",
        color: "text-blue-600",
        bgColor: "bg-blue-600/10",
    },
    {
        label: "Observability",
        icon: Activity,
        href: "/observability",
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
    },
    {
        label: "Approvals",
        icon: Bell,
        href: "/approvals",
        color: "text-rose-500",
        bgColor: "bg-rose-500/10",
    },
    {
        label: "Admin",
        icon: Settings,
        href: "/admin",
        color: "text-gray-500",
        bgColor: "bg-gray-500/10",
        submenu: [
            { label: "Users", href: "/admin/users" },
            { label: "Alert Types", href: "/admin/alerts" },
            { label: "Escalations", href: "/admin/escalations" },
            { label: "Workflow", href: "/admin/workflow" },
        ]
    },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-gradient-to-b from-card to-background border-r dark:from-card dark:to-background">
            <div className="px-6 py-2">
                <Link href="/dashboard" className="flex items-center pl-2 mb-6 group">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mr-3 shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
                        <span className="text-white font-bold text-lg">I</span>
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Infra.ai
                    </h1>
                </Link>
                
                <ScrollArea className="h-[calc(100vh-200px)]">
                    <div className="space-y-1">
                        {routes.map((route) => (
                            <div key={route.href}>
                                <Link
                                    href={route.href}
                                    className={cn(
                                        "text-sm group flex items-center gap-3 px-3 py-2.5 w-full justify-start font-medium cursor-pointer hover:bg-accent/50 hover:text-accent-foreground rounded-lg transition-all duration-200",
                                        pathname === route.href ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground"
                                    )}
                                >
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                        route.bgColor,
                                        pathname === route.href ? "shadow-md" : ""
                                    )}>
                                        <route.icon className={cn("h-4 w-4", route.color)} />
                                    </div>
                                    {route.label}
                                </Link>
                                {/* Render Submenu */}
                                {route.submenu && (
                                    <div className="ml-5 mt-1 space-y-0.5">
                                        {route.submenu.map((sub) => (
                                            <Link
                                                key={sub.href}
                                                href={sub.href}
                                                className={cn(
                                                    "block text-xs px-3 py-2 rounded-md hover:bg-accent/50 hover:text-accent-foreground transition-all",
                                                    pathname === sub.href ? "bg-accent/50 text-accent-foreground font-medium" : "text-muted-foreground/70"
                                                )}
                                            >
                                                {sub.label}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            <div className="mt-auto px-6 py-4 border-t bg-card/50 backdrop-blur">
                <div className="flex items-center justify-between">
                    <UserButton afterSignOutUrl="/" />
                    <ModeToggle />
                </div>
            </div>
        </div>
    );
}

export function MobileSidebar() {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <Sidebar />
            </SheetContent>
        </Sheet>
    )
}
