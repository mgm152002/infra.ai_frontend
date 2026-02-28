'use client'

import { useEffect, useState, use, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, AlertTriangle, Terminal, FileText, Activity, Wrench, ChevronDown, BrainCircuit, Sparkles, Loader2, ExternalLink, Trash2, Clock, Target, ListChecks, Lightbulb } from 'lucide-react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function IncidentDetails({ params }) {
  const resolvedParams = use(params);
  const { slug } = resolvedParams;
  const [incidentDetails, setIncidentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [rcaReport, setRcaReport] = useState(null);
  const [generatingRCA, setGeneratingRCA] = useState(false);
  const [problemRecord, setProblemRecord] = useState(null);
  const [generatingProblem, setGeneratingProblem] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Live execution stream state
  const [liveToolStream, setLiveToolStream] = useState([]);
  const [streamActive, setStreamActive] = useState(false);
  const [streamDone, setStreamDone] = useState(false);
  const streamEndRef = useRef(null);
  const streamReaderRef = useRef(null);
  const { getToken } = useAuth();
  const router = useRouter();

  // Auto-scroll live stream to bottom
  useEffect(() => {
    if (streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveToolStream]);

  // Connect to SSE stream when incident is in a processing state
  useEffect(() => {
    let incState = incidentDetails?.state || '';
    const isProcessing = ['processing', 'inprogress', 'active', 'received'].includes(incState.toLowerCase());

    if (!isProcessing || streamActive || streamDone) return;

    let cancelled = false;
    setStreamActive(true);

    (async () => {
      try {
        await getToken({ template: 'auth_token' });
        const response = await fetch(`/api/stream?incident=${encodeURIComponent(slug)}`, {
          headers: { 'Accept': 'text/event-stream' }
        });
        if (!response.ok) { setStreamActive(false); return; }

        const reader = response.body.getReader();
        streamReaderRef.current = reader;
        const decoder = new TextDecoder();

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6);
            if (raw === ': keep-alive') continue;
            try {
              const ev = JSON.parse(raw);
              const d = ev.data || {};
              const eventIncident = d.incident_number || d.incident_id || slug;
              if (eventIncident !== slug) continue;
              if (ev.type === 'tool_call') {
                setLiveToolStream(prev => [
                  ...prev,
                  {
                    tool: d.tool,
                    status: d.status,
                    message: d.message || d.output || `Tool: ${d.tool}`,
                    args: d.args,
                    output: d.output,
                    ts: new Date().toLocaleTimeString()
                  }
                ]);
              } else if (ev.type === 'status_update') {
                setIncidentDetails(prev => prev ? { ...prev, state: d.status || prev.state } : prev);
              } else if (ev.type === 'incident_completed') {
                setStreamDone(true);
                setStreamActive(false);
                // Refresh details and results after completion
                fetchIncidentDetails(slug);
                fetchResults(slug);
                reader.cancel();
                break;
              }
            } catch (e) { /* skip */ }
          }
        }
        setStreamActive(false);
      } catch (err) {
        console.error('[Details SSE] error:', err);
        setStreamActive(false);
      }
    })();

    return () => {
      cancelled = true;
      if (streamReaderRef.current) {
        streamReaderRef.current.cancel();
      }
    };
  }, [incidentDetails?.state]);

  // Enhanced markdown renderer with code blocks and better formatting
  const RCARenderer = ({ content }) => {
    if (!content) return null;

    // Split content by main sections
    const lines = content.split('\n');
    const sections = [];
    let currentSection = { title: '', content: [], icon: null };

    lines.forEach((line) => {
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
      <div className="space-y-4">
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

  const safeParseJson = (value, maxDepth = 3) => {
    let current = value;
    let depth = 0;
    while (typeof current === "string" && depth < maxDepth) {
      try {
        current = JSON.parse(current);
      } catch {
        break;
      }
      depth += 1;
    }
    return current;
  };

  const parseResultDescription = (description) => {
    if (!description) return null;
    const parsed = safeParseJson(description);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  };

  const parseStructuredField = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    const parsed = safeParseJson(value);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  };

  const normalizeToolCalls = (parsed) => {
    if (!parsed || typeof parsed !== "object") return [];
    const candidates = [
      parsed.tool_calls,
      parsed.execution_stream,
      parsed.tools,
      parsed.result,
      parsed.analysis?.tool_calls,
      parsed.resolution?.tool_calls,
    ];
    const firstArray = candidates.find((entry) => Array.isArray(entry));
    if (!firstArray) return [];

    return firstArray.map((entry) => {
      const toolObj = entry?.tool && typeof entry.tool === "object" ? entry.tool : null;
      return {
        name: entry?.name || toolObj?.name || entry?.tool || "tool",
        status: entry?.status || toolObj?.status || "unknown",
        args: entry?.args || toolObj?.args || null,
        output: entry?.output ?? toolObj?.output ?? null,
        timestamp: entry?.timestamp || entry?.ts || null,
      };
    });
  };

  const formatToolOutput = (value) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") {
      const parsed = safeParseJson(value);
      if (typeof parsed === "object" && parsed !== null) {
        return JSON.stringify(parsed, null, 2);
      }
      return value;
    }
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  useEffect(() => {
    if (slug) {
      fetchIncidentDetails(slug);
      fetchResults(slug);
      fetchRCA(slug);
      fetchProblemRecord();
    }
  }, [slug]);

  async function fetchIncidentDetails(slug) {
    try {
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.get(`http://127.0.0.1:8000/getIncidentsDetails/${slug}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setIncidentDetails(data.response);
    } catch (error) {
      console.error('Error fetching incident details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchResults(incNumber) {
    try {
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.get(`http://127.0.0.1:8000/getResults/${incNumber}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setResults(data.response.data || []);
    } catch (error) {
      console.error('Error fetching results:', error);
      setResults([]);
    }
  }

  async function fetchRCA(incNumber) {
    try {
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.get(`http://127.0.0.1:8000/getRCA/${incNumber}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (data.response) {
        setRcaReport(data.response);
      }
    } catch (e) {
      console.log('No existing RCA found or error:', e);
    }
  }

  async function fetchProblemRecord() {
    try {
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems/by-incident/${slug}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.exists) {
        setProblemRecord(data.problem);
      }
    } catch (e) {
      console.log('No problem record found:', e);
    }
  }

  async function handleGenerateRCA() {
    setGeneratingRCA(true);
    try {
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.post(`http://127.0.0.1:8000/generateRCA/${slug}`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (data.response && data.response.rca_content) {
        toast.success("RCA Generated Successfully");
        // Refresh RCA to get the saved one
        fetchRCA(slug);
      } else {
        toast.error("Failed to generate RCA");
      }
    } catch (e) {
      toast.error("Error generating RCA: " + (e.response?.data?.detail || e.message));
    } finally {
      setGeneratingRCA(false);
    }
  }

  async function handleCreateProblem() {
    setGeneratingProblem(true);
    try {
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems/ai-generate?incident_number=${slug}`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data && data.success) {
        setProblemRecord(data.problem);
        toast.success("Problem Record created with AI!");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to create problem record");
    } finally {
      setGeneratingProblem(false);
    }
  }

  async function deleteProblemRecord() {
    setDeleting(true);
    try {
      const token = await getToken({ template: "auth_token" });
      const res = await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems/by-incident/${slug}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProblemRecord(null);
      setDeleteDialogOpen(false);
      toast.success("Problem Record deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete problem record: " + (e.response?.data?.detail || e.message));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
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
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
                <Skeleton className="h-96 w-full" />
              </div>
            </main>
          </div>
        </SignedIn>
      </ClerkProvider>
    );
  }

  const structuredSolution = parseStructuredField(incidentDetails?.solution);
  const description = incidentDetails?.description || incidentDetails?.short_description || "No description available.";
  const cause =
    incidentDetails?.potential_cause ||
    structuredSolution?.root_cause ||
    "No cause found.";
  const solution =
    incidentDetails?.potential_solution ||
    (Array.isArray(structuredSolution?.resolution_steps)
      ? structuredSolution.resolution_steps.join("\n")
      : structuredSolution?.resolution_steps) ||
    "No solution found.";
  const incidentFieldEntries = Object.entries(incidentDetails || {}).filter(
    ([key]) => key !== "potential_cause" && key !== "potential_solution"
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
                  <h1 className="text-3xl font-bold tracking-tight">Incident Details</h1>
                  <p className="text-muted-foreground mt-1">Incident #{slug}</p>
                </div>
                <Button variant="outline" onClick={() => router.back()} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4 text-blue-500" /> Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-red-500" /> Potential Cause
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{cause}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Wrench className="h-4 w-4 text-green-500" /> Potential Solution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{solution}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-indigo-500" /> Incident Fields
                  </CardTitle>
                  <CardDescription>All persisted fields for this incident record.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {incidentFieldEntries.map(([key, value]) => (
                      <div key={key} className="rounded-md border p-3 space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{key}</p>
                        {typeof value === "object" && value !== null ? (
                          <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-sm break-all">{value === null || value === undefined ? "—" : String(value)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* RCA Section */}
              <div className="space-y-4">
                <Card className="border-purple-200 dark:border-purple-900">
                  <CardHeader className="pb-3 bg-purple-50/50 dark:bg-purple-900/10">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2 text-base text-purple-700 dark:text-purple-400">
                        <BrainCircuit className="h-5 w-5" /> Root Cause Analysis (AI)
                      </CardTitle>
                      <div className="flex gap-2">
                        {problemRecord ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-100"
                              onClick={() => router.push(`/problems/${problemRecord.id}`)}
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Problem Record
                            </Button>
                            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-100"
                                  title="Delete Problem Record"
                                >
                                  <Trash2 className="h-3 w-3" />
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
                          </>
                        ) : rcaReport ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCreateProblem}
                            disabled={generatingProblem}
                            className="border-purple-300 text-purple-700 hover:bg-purple-100"
                          >
                            {generatingProblem ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="mr-1 h-3 w-3" />
                            )}
                            Create Problem Record with AI
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {rcaReport ? (
                      <RCARenderer content={rcaReport.report_content} />
                    ) : (
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
                          onClick={handleGenerateRCA}
                          disabled={generatingRCA}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {generatingRCA ? (
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
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Live Execution Stream Panel */}
              {(liveToolStream.length > 0 || streamActive) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">Execution Stream</h2>
                    {streamActive && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                        LIVE
                      </span>
                    )}
                    {streamDone && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-full">
                        ✓ Complete
                      </span>
                    )}
                  </div>

                  <Card className="overflow-hidden border-blue-200 dark:border-blue-900">
                    <div className="max-h-[520px] overflow-y-auto p-4 space-y-2 bg-gray-950 dark:bg-black">
                      {liveToolStream.length === 0 && streamActive && (
                        <div className="flex items-center gap-3 text-sm text-gray-400 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          <span>Waiting for AI agent to start…</span>
                        </div>
                      )}

                      {liveToolStream.map((event, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg border p-3 text-sm font-mono transition-all ${event.status === 'completed'
                            ? 'border-green-800 bg-green-950/30'
                            : event.status === 'failed'
                              ? 'border-red-800 bg-red-950/30'
                              : 'border-blue-800 bg-blue-950/20'
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {event.status === 'running' ? (
                              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin flex-shrink-0" />
                            ) : event.status === 'completed' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                            )}
                            <code className="text-xs px-1.5 py-0.5 bg-gray-800 text-blue-300 rounded">
                              {event.tool}
                            </code>
                            <span className="text-xs text-gray-500 ml-auto">{event.ts}</span>
                          </div>
                          {event.message && (
                            <p className="text-xs text-gray-300 ml-6 mb-1">{event.message}</p>
                          )}
                          {event.args && Object.keys(event.args).length > 0 && (
                            <details className="ml-6 mt-1">
                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Args</summary>
                              <pre className="mt-1 text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-x-auto max-h-20">
                                {JSON.stringify(event.args, null, 2)}
                              </pre>
                            </details>
                          )}
                          {event.output && (
                            <details className="ml-6 mt-1">
                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Output</summary>
                              <pre className="mt-1 text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-x-auto max-h-28 whitespace-pre-wrap break-all">
                                {formatToolOutput(event.output)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                      <div ref={streamEndRef} />
                    </div>
                  </Card>
                </div>
              )}

              <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Action Results</h2>
                {results.length > 0 ? (
                  <div className="space-y-6">
                    {results.map((result, index) => {
                      const parsed = parseResultDescription(result.description);
                      const diagnostics = parsed?.diagnostics?.diagnostics || [];
                      const analysis = parsed?.analysis;
                      const resolution = parsed?.resolution;
                      const resolutionResults = resolution?.resolution_results || [];
                      const toolCalls = normalizeToolCalls(parsed);
                      const allResolutionSuccessful = resolutionResults.length > 0 && resolutionResults.every((step) => step.result?.success);

                      return (
                        <Card key={index} className="overflow-hidden">
                          <CardHeader className="bg-muted/30 pb-4">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-2">
                              <div className="space-y-1">
                                <CardTitle className="text-lg">Execution Record</CardTitle>
                                <CardDescription>
                                  Run at {new Date(result.created_at).toLocaleString()}
                                </CardDescription>
                              </div>
                              {resolutionResults.length > 0 && (
                                <Badge variant={allResolutionSuccessful ? "default" : "destructive"}>
                                  {allResolutionSuccessful ? "Resolution Successful" : "Resolution Partial/Failed"}
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 space-y-6">
                            {/* Analysis Section */}
                            {analysis && (
                              <div className="space-y-3">
                                <h3 className="font-semibold flex items-center gap-2">
                                  <Activity className="h-4 w-4" /> Root Cause Analysis
                                </h3>
                                <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
                                  <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2">
                                    <span className="font-medium text-muted-foreground">Root Cause:</span>
                                    <span>{analysis.root_cause || "N/A"}</span>
                                  </div>
                                  {analysis.verification && (
                                    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2">
                                      <span className="font-medium text-muted-foreground">Verification:</span>
                                      <span>{analysis.verification}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Diagnostic Steps Custom Accordion */}
                            {diagnostics.length > 0 && (
                              <div className="w-full border rounded-lg">
                                <details className="group">
                                  <summary className="flex items-center cursor-pointer px-4 py-4 font-semibold hover:bg-muted/50 list-none">
                                    <span className="flex items-center gap-2 flex-1">
                                      <Terminal className="h-4 w-4" /> Diagnostic Steps ({diagnostics.length})
                                    </span>
                                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                                  </summary>
                                  <div className="px-4 pb-4 border-t">
                                    <div className="space-y-3 pt-4">
                                      {diagnostics.map((step, i) => (
                                        <div key={i} className="border rounded-md p-3 bg-card text-sm space-y-2">
                                          <div className="flex justify-between items-start">
                                            <span className="font-medium">Step {i + 1}: {step.step}</span>
                                            <div className="flex gap-2">
                                              {step.success ?
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Success</Badge> :
                                                <Badge variant="destructive">Failed</Badge>
                                              }
                                            </div>
                                          </div>
                                          {step.command && (
                                            <div className="font-mono text-xs bg-muted p-2 rounded overflow-x-auto">
                                              $ {step.command}
                                            </div>
                                          )}

                                          {(step.output || step.error) && (
                                            <details className="text-xs group/output">
                                              <summary className="cursor-pointer text-primary hover:underline w-fit">Show Output</summary>
                                              <div className="mt-2 font-mono bg-black text-gray-50 p-2 rounded overflow-x-auto max-h-40">
                                                {step.output || step.error}
                                              </div>
                                            </details>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              </div>
                            )}

                            {/* Resolution Steps Custom Accordion */}
                            {resolutionResults.length > 0 && (
                              <div className="w-full border rounded-lg">
                                <details className="group">
                                  <summary className="flex items-center cursor-pointer px-4 py-4 font-semibold hover:bg-muted/50 list-none">
                                    <span className="flex items-center gap-2 flex-1">
                                      <Wrench className="h-4 w-4" /> Resolution Steps ({resolutionResults.length})
                                    </span>
                                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                                  </summary>
                                  <div className="px-4 pb-4 border-t">
                                    <div className="space-y-3 pt-4">
                                      {resolutionResults.map((step, i) => (
                                        <div key={i} className="border rounded-md p-3 bg-card text-sm space-y-2">
                                          <div className="flex justify-between items-start">
                                            <span className="font-medium">Step {i + 1}: {step.step}</span>
                                            <Badge variant={step.result?.success ? "default" : "destructive"}>
                                              {step.result?.success ? "Success" : "Failed"}
                                            </Badge>
                                          </div>
                                          {step.command && (
                                            <div className="font-mono text-xs bg-muted p-2 rounded overflow-x-auto">
                                              $ {step.command}
                                            </div>
                                          )}
                                          {(step.result?.output || step.result?.error) && (
                                            <details className="text-xs">
                                              <summary className="cursor-pointer text-primary hover:underline w-fit">Show Output</summary>
                                              <div className="mt-2 font-mono bg-black text-gray-50 p-2 rounded overflow-x-auto max-h-40">
                                                {step.result?.output || step.result?.error}
                                              </div>
                                            </details>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              </div>
                            )}

                            {/* Tool Calls */}
                            {toolCalls.length > 0 && (
                              <div className="w-full border rounded-lg">
                                <details className="group">
                                  <summary className="flex items-center cursor-pointer px-4 py-4 font-semibold hover:bg-muted/50 list-none">
                                    <span className="flex items-center gap-2 flex-1">
                                      <Terminal className="h-4 w-4" /> Tools Used ({toolCalls.length})
                                    </span>
                                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                                  </summary>
                                  <div className="px-4 pb-4 border-t">
                                    <div className="space-y-3 pt-4">
                                      {toolCalls.map((tool, i) => (
                                        <div key={i} className="border rounded-md p-3 bg-card text-sm space-y-2">
                                          <div className="flex justify-between items-start gap-2">
                                            <span className="font-medium break-all">{tool.name || tool.tool || "tool"}</span>
                                            <Badge variant={(tool.status === "completed" || tool.status === "success") ? "default" : (tool.status === "failed" ? "destructive" : "secondary")}>
                                              {tool.status || "unknown"}
                                            </Badge>
                                          </div>
                                          {tool.timestamp && (
                                            <p className="text-[11px] text-muted-foreground">{new Date(tool.timestamp).toLocaleString()}</p>
                                          )}
                                          {tool.args && (
                                            <details className="text-xs">
                                              <summary className="cursor-pointer text-primary hover:underline w-fit">Show Args</summary>
                                              <pre className="mt-2 font-mono bg-black text-gray-50 p-2 rounded overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                                                {JSON.stringify(tool.args, null, 2)}
                                              </pre>
                                            </details>
                                          )}
                                          {tool.output && (
                                            <details className="text-xs">
                                              <summary className="cursor-pointer text-primary hover:underline w-fit">Show Output</summary>
                                              <pre className="mt-2 font-mono bg-black text-gray-50 p-2 rounded overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                                                {formatToolOutput(tool.output)}
                                              </pre>
                                            </details>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              </div>
                            )}

                            {/* Fallback for unstructured description */}
                            {!parsed && (
                              <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap font-mono">
                                {result.description}
                              </div>
                            )}

                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Card className="bg-muted/50 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Activity className="h-10 w-10 mb-4 opacity-20" />
                      <p>No action results found for this incident.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </main>
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}
