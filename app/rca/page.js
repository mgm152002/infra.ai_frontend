"use client"
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { BrainCircuit, Search, Filter, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth, ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Input } from "@/components/ui/input";

export default function RCAListPage() {
    const router = useRouter();
    const [incidents, setIncidents] = useState([]);
    const [rcaReports, setRcaReports] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { getToken } = useAuth();

    useEffect(() => {
        fetchIncidents();
    }, []);

    const fetchIncidents = async () => {
        try {
            const token = await getToken({ template: "auth_token" });
            const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/incidents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (data) {
                setIncidents(data);
                // Fetch RCA for each incident
                fetchAllRCAs(data);
            }
        } catch (error) {
            console.error('Error fetching incidents:', error);
            toast.error("Failed to fetch incidents");
        } finally {
            setLoading(false);
        }
    };

    const fetchAllRCAs = async (incidentList) => {
        const rcaMap = {};
        for (const incident of incidentList) {
            try {
                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/rca/${incident.inc_number}`);
                if (res.data && res.data.length > 0) {
                    rcaMap[incident.inc_number] = res.data[0];
                }
            } catch (e) {
                // No RCA for this incident
            }
        }
        setRcaReports(rcaMap);
    };

    const filteredIncidents = incidents.filter(inc => 
        inc.inc_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.short_description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <ClerkProvider>
            <SignedIn>
                <div className="h-full relative">
                    <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-80 bg-gray-900">
                        <Sidebar />
                    </div>
                    <div className="md:hidden">
                        <MobileSidebar />
                    </div>
                    <main className="md:pl-72 pb-10">
                        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                            <div className="md:hidden flex items-center justify-between mb-4">
                                <div className="font-bold text-lg">Infra.ai</div>
                                <div className="flex gap-2 items-center">
                                    <ModeToggle />
                                    <UserButton />
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                                        <BrainCircuit className="h-8 w-8 text-purple-500" />
                                        Root Cause Analysis
                                    </h1>
                                    <p className="text-muted-foreground mt-1">View and generate RCA reports for incidents</p>
                                </div>
                            </div>

                            {/* Search */}
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by incident number or description..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Incidents List */}
                            <div className="grid gap-4">
                                {loading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                                    </div>
                                ) : filteredIncidents.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                            <BrainCircuit className="h-10 w-10 mb-4 opacity-20" />
                                            <p>No incidents found</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    filteredIncidents.map((incident) => (
                                        <Card key={incident.id} className="hover:shadow-md transition-shadow cursor-pointer border-purple-200 dark:border-purple-800" onClick={() => router.push(`/rca/${incident.inc_number}`)}>
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                                            <BrainCircuit className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">{incident.inc_number}</p>
                                                            <p className="text-sm text-muted-foreground line-clamp-1">{incident.short_description}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {rcaReports[incident.inc_number] ? (
                                                            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">
                                                                RCA Generated
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 px-2 py-1 rounded">
                                                                No RCA
                                                            </span>
                                                        )}
                                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </SignedIn>
        </ClerkProvider>
    );
}
