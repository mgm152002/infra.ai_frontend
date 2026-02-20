"use client"
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import axios from 'axios';

export default function ApprovalsPage() {
    const [approvals, setApprovals] = useState([]);
    const { toast } = useToast();

    useEffect(() => {
        fetchApprovals();
    }, []);

    const fetchApprovals = async () => {
        try {
            // Mock fetching all approvals for demo, ideally filter by user
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflow/approvals`);
            setApprovals(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAction = async (id, action) => {
        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflow/approvals/${id}/${action}`);
            fetchApprovals();
            toast({ title: "Success", description: `Request ${action}d` });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Action failed" });
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Pending Approvals</h1>
            <div className="grid gap-4">
                {approvals.length === 0 && <p>No pending approvals.</p>}
                {approvals.map(approval => (
                    <Card key={approval.id}>
                        <CardContent className="p-4 flex justify-between items-center">
                            <div>
                                <div className="font-bold">Approval ID: {approval.id}</div>
                                <div className="text-sm">Change Request ID: {approval.change_request_id}</div>
                                <div className="text-sm">Status: {approval.status}</div>
                            </div>
                            {approval.status === 'pending' && (
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => handleAction(approval.id, 'reject')}>Reject</Button>
                                    <Button onClick={() => handleAction(approval.id, 'approve')}>Approve</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
