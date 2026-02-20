"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ObservabilityPage = () => {
    const [provider, setProvider] = useState("prometheus");
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const fetchMetrics = async () => {
        setLoading(true);
        // Mock fetch for now
        // In real app: fetch(`${API_BASE}/api/v1/observability/query?provider=${provider}&query=up`)
        setTimeout(() => {
            setMetrics([
                { name: "http_requests_total", value: 1024, timestamp: new Date().toLocaleTimeString() },
                { name: "error_rate", value: 0.05, timestamp: new Date().toLocaleTimeString() },
                { name: "cpu_usage", value: "45%", timestamp: new Date().toLocaleTimeString() }
            ]);
            setLoading(false);
        }, 800);
    };

    useEffect(() => {
        fetchMetrics();
    }, [provider]);

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Observability Dashboard</h1>
                <div className="w-64">
                    <Select value={provider} onValueChange={setProvider}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="prometheus">Prometheus</SelectItem>
                            <SelectItem value="datadog">Datadog</SelectItem>
                            <SelectItem value="newrelic">New Relic (Coming Soon)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-3 text-center py-10">Loading metrics...</div>
                ) : (
                    metrics.map((metric) => (
                        <Card key={metric.name}>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-gray-500">
                                    {metric.name.toUpperCase()}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{metric.value}</div>
                                <p className="text-xs text-gray-400 mt-2">Updated: {metric.timestamp}</p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Raw Query Interface</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex space-x-4">
                        <input
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Enter PromQL or Datadog Query"
                        />
                        <Button onClick={fetchMetrics}>Run Query</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ObservabilityPage;
