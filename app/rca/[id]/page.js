"use client"
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, Trash2, ExternalLink, Loader2, Sparkles, ArrowLeft, BrainCircuit, Clock, CheckCircle, AlertCircle, Wrench, FileText, ListChecks, Target, Lightbulb, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth, ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, UserButton } from '@clerk/nextjs';
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function RcaPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;
    const [rca, setRca] = useState(null);
    const [loading, setLoading] = useState(false);
    const [problemRecord, setProblemRecord] = useState(null);
    const [problemLoading, setProblemLoading] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { getToken } = useAuth();

    useEffect(() => {
        if (id) {
            fetchRca();
            fetchProblemRecord();
        }
    }, [id]);

    const fetchRca = async () => {
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/rca/${id}`);
            if (res.data && res.data.length > 0) {
                setRca(res.data[0]);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchProblemRecord = async () => {
        try {
            const token = await getToken({ template: "auth_token" });
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems/by-incident/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data && res.data.exists) {
                setProblemRecord(res.data.problem);
            }
        } catch (error) {
            console.error("Error fetching problem record:", error);
        }
    };

    const generateRca = async () => {
        setLoading(true);
        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/rca/generate/${id}`);
            fetchRca();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const generateAIProblemRecord = async () => {
        setProblemLoading(true);
        try {
            const token = await getToken({ template: "auth_token" });
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems/ai-generate?incident_number=${id}`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data && res.data.success) {
                setProblemRecord(res.data.problem);
                toast.success("Problem Record created with AI!");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate problem record");
        } finally {
            setProblemLoading(false);
        }
    };

    const deleteProblemRecord = async () => {
        setDeleting(true);
        try {
            const token = await getToken({ template: "auth_token" });
            const res = await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems/by-incident/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setProblemRecord(null);
            setDeleteDialogOpen(false);
            toast.success("Problem Record deleted");
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete problem record: " + (error.response?.data?.detail || error.message));
        } finally {
            setDeleting(false);
        }
    };

    // Enhanced markdown renderer with code blocks and better formatting
    const RCARenderer = ({ content }) => {
        if (!content) return null;
        
        // Split content by main sections
        const lines = content.split('\n');
        const sections = [];
        let currentSection = { title: '', content: [], icon: null };
        
        lines.forEach((line, idx) => {
            // Detect section headers
            if (line.match(/^#{1,3}\s/)) {
                if (currentSection.content.length > 0 || currentSection.title) {
                    sections.push(currentSection);
                }
                
                // Determine icon based on section title
                let icon = <FileText className="h-5 w-5" />;
                const title = line.replace(/^#{1,3}\s/, '').toLowerCase();
                
                if (title.includes('summary') || title.includes('overview')) {
                    icon = <FileText className="h-5 w-5" />;
                } else if (title.includes('timeline') || title.includes('chronolog')) {
                    icon = <Clock className="h-5 w-5" />;
                } else if (title.includes('root cause') || title.includes('why')) {
                    icon = <Target className="h-5 w-5" />;
                } else if (title.includes('resolution') || title.includes('recovery')) {
                    icon = <Wrench className="h-5 w-5" />;
                } else if (title.includes('corrective') || title.includes('preventive') || title.includes('action')) {
                    icon = <ListChecks className="h-5 w-5" />;
                } else if (title.includes('impact')) {
                    icon = <AlertCircle className="h-5 w-5" />;
                } else if (title.includes('lesson')) {
                    icon = <Lightbulb className="h-5 w-5" />;
                }
                
                currentSection = { title: line, content: [], icon };
            } else {
                currentSection.content.push(line);
            }
        });
        if (currentSection.content.length > 0 || currentSection.title) {
            sections.push(currentSection);
        }
        
        return (
            <div className="space-y-6">
                {sections.map((section, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                        {/* Section Header */}
                        <div className="bg-purple-100 dark:bg-purple-900/30 px-4 py-3 border-b border-purple-200 dark:border-purple-800 flex items-center gap-2">
                            {section.icon}
                            <h2 className="font-bold text-purple-900 dark:text-purple-200 text-lg">
                                {section.title.replace(/^#+\s/, '')}
                            </h2>
                        </div>
                        {/* Section Content */}
                        <div className="bg-white dark:bg-gray-900 p-4">
                            {section.content.filter(l => l.trim()).map((line, lineIdx) => (
                                <div key={lineIdx} className="mb-2">
                                    {line.trim().startsWith('- ') || line.trim().startsWith('* ') ? (
                                        // List items with bullet
                                        <div className="flex items-start gap-2 ml-2">
                                            <span className="text-purple-600 dark:text-purple-400 mt-1">•</span>
                                            <span className="text-gray-700 dark:text-gray-300">
                                                <MarkdownLine text={line.replace(/^[-*]\s/, '')} />
                                            </span>
                                        </div>
                                    ) : line.trim().match(/^\d+\.\s/) ? (
                                        // Numbered list
                                        <div className="flex items-start gap-2 ml-2">
                                            <span className="text-purple-600 dark:text-purple-400 mt-0">{line.match(/^\d+\./)[0]}</span>
                                            <span className="text-gray-700 dark:text-gray-300">
                                                <MarkdownLine text={line.replace(/^\d+\.\s/, '')} />
                                            </span>
                                        </div>
                                    ) : (
                                        // Regular paragraph
                                        <div className="text-gray-700 dark:text-gray-300">
                                            <MarkdownLine text={line} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Component to render bold and code in text
    const MarkdownLine = ({ text }) => {
        if (!text) return null;
        
        // Split by ** for bold
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        
        return (
            <>
                {parts.map((part, idx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={idx} className="font-bold text-gray-900 dark:text-gray-100">{part.replace(/\*\*/g, '')}</strong>;
                    }
                    // Handle inline code
                    const codeParts = part.split(/(`[^`]+`)/g);
                    return codeParts.map((cp, cidx) => {
                        if (cp.startsWith('`') && cp.endsWith('`')) {
                            return <code key={`${idx}-${cidx}`} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-purple-600 dark:text-purple-400 font-mono text-sm">{cp.replace(/`/g, '')}</code>;
                        }
                        return <span key={`${idx}-${cidx}`}>{cp}</span>;
                    });
                })}
            </>
        );
    };

    return (
        <ClerkProvider>
            <SignedOut>
                <RedirectToSignIn redirectUrl={`/rca/${id}`} />
            </SignedOut>
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
                                    <h1 className="text-3xl font-bold tracking-tight">Root Cause Analysis</h1>
                                    <p className="text-muted-foreground mt-1">Incident #{id}</p>
                                </div>
                                <Button variant="outline" onClick={() => router.back()} className="gap-2">
                                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                                </Button>
                            </div>

                            {/* Problem Record Section */}
                            <Card className="border-green-200 dark:border-green-900">
                                <CardHeader className="pb-3 bg-green-50/50 dark:bg-green-900/10">
                                    <CardTitle className="flex items-center gap-2 text-base text-green-700 dark:text-green-400">
                                        <AlertTriangle className="h-5 w-5" /> Problem Record
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {problemRecord ? (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                    <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{problemRecord.title}</p>
                                                    <p className="text-sm text-muted-foreground">Status: {problemRecord.status?.replace(/_/g, ' ')}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    className="gap-2"
                                                    onClick={() => router.push(`/problems/${problemRecord.id}`)}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    View Problem Record
                                                </Button>
                                                
                                                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="destructive" size="icon" title="Delete Problem Record">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Delete Problem Record</DialogTitle>
                                                            <DialogDescription>
                                                                Are you sure you want to delete this problem record? This action cannot be undone.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <DialogFooter>
                                                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                                                Cancel
                                                            </Button>
                                                            <Button variant="destructive" onClick={deleteProblemRecord} disabled={deleting}>
                                                                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                                Delete
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                {rca ? "No problem record exists for this incident." : "Generate RCA first to create problem record."}
                                            </div>
                                            <Button 
                                                onClick={generateAIProblemRecord} 
                                                disabled={problemLoading || !rca}
                                                className="gap-2 bg-green-600 hover:bg-green-700"
                                            >
                                                {problemLoading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-4 w-4" />
                                                )}
                                                Create Problem Record with AI
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* RCA Report Section - Formatted */}
                            {!rca ? (
                                <Card className="border-purple-200 dark:border-purple-900">
                                    <CardHeader className="pb-3 bg-purple-50/50 dark:bg-purple-900/10">
                                        <CardTitle className="flex items-center gap-2 text-base text-purple-700 dark:text-purple-400">
                                            <BrainCircuit className="h-5 w-5" /> Root Cause Analysis (AI)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
                                            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                                                <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-semibold">No RCA Report Generated</h3>
                                                <p className="text-sm text-muted-foreground max-w-sm">
                                                    Generate a comprehensive Root Cause Analysis report using AI based on the incident timeline and resolution steps.
                                                </p>
                                            </div>
                                            <Button 
                                                onClick={generateRca} 
                                                disabled={loading}
                                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Analysis...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="mr-2 h-4 w-4" /> Generate RCA Report
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-purple-200 dark:border-purple-900">
                                    <CardHeader className="pb-3 bg-purple-50/50 dark:bg-purple-900/10">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="flex items-center gap-2 text-base text-purple-700 dark:text-purple-400">
                                                <BrainCircuit className="h-5 w-5" /> RCA Report
                                            </CardTitle>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                {new Date(rca.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <RCARenderer content={rca.report_content} />
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </main>
                </div>
            </SignedIn>
        </ClerkProvider>
    );
}
