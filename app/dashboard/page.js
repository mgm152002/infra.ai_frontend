'use client'
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from '@clerk/nextjs';
import { ClerkProvider, SignedIn } from '@clerk/nextjs';
import axios from "axios";
import { useEffect, useState, useRef, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Terminal, Wrench, Activity, CheckCircle2, XCircle, ChevronDown, Radio } from "lucide-react";

// Dynamically import Toaster with no SSR
const ToasterComponent = dynamic(
  () => import('react-hot-toast').then((mod) => mod.Toaster),
  { ssr: false }
);

export default function Dashboard() {
  const [token, setToken] = useState(null);
  const { getToken } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [actionResponses, setActionResponses] = useState({});
  const [plans, setPlans] = useState({});
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [activeJobs, setActiveJobs] = useState([]);

  // Streaming execution state
  const [streamingExecution, setStreamingExecution] = useState(false);
  const [executionSteps, setExecutionSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [executionResult, setExecutionResult] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);

  // Real-time incident updates state
  const [sseConnected, setSseConnected] = useState(false);
  const [liveIncident, setLiveIncident] = useState(null);
  const [liveToolUpdates, setLiveToolUpdates] = useState([]);
  const eventSourceRef = useRef(null);
  const reconnectingRef = useRef(false);
  const jobsPollDelayRef = useRef(10000);

  // Create Incident State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [alertTypes, setAlertTypes] = useState([]);
  const [newIncidentData, setNewIncidentData] = useState({
    short_description: "",
    tag_id: "",
    alert_type_id: ""
  });

  const [selectedIncident, setSelectedIncident] = useState(null);

  async function getInc() {
    try {
      setLoading(true);
      const { data } = await axios.get('http://127.0.0.1:8000/allIncidents', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 10000,
      });
      const incidentList = data.response.data || [];
      setIncidents(incidentList);

      // Auto-set the live incident if one is currently processing
      setLiveIncident(prev => {
        if (!prev) {
          const processingInc = incidentList.find(inc =>
            (inc.state || '').toLowerCase() === 'processing' ||
            (inc.state || '').toLowerCase() === 'inprogress'
          );
          if (processingInc) {
            return {
              inc_number: processingInc.inc_number,
              subject: processingInc.short_description,
              tag_id: processingInc.tag_id,
              state: processingInc.state,
              is_live: true
            };
          }
        }
        return prev;
      });

      setLoading(false);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      setLoading(false);
      toast.error('Failed to fetch incidents');
    }
  }

  async function getActiveJobs() {
    if (!getToken) return;
    try {
      // Get fresh token before each API call to handle expiration
      const freshToken = await getToken({ template: 'auth_token' });
      const { data } = await axios.get('http://127.0.0.1:8000/jobs/active', {
        headers: { Authorization: `Bearer ${freshToken}` },
        timeout: 10000,
      });
      setActiveJobs(data.response || []);
      jobsPollDelayRef.current = 10000;
    } catch (error) {
      const status = error?.response?.status;
      const timedOut = error?.code === 'ECONNABORTED';
      if (status === 503 || status === 504 || timedOut) {
        jobsPollDelayRef.current = Math.min(jobsPollDelayRef.current * 2, 60000);
      } else {
        jobsPollDelayRef.current = 15000;
      }
      console.error("Error fetching active jobs:", error);
    }
  }

  async function getAlertTypes() {
    if (!token) return;
    try {
      const { data } = await axios.get('http://127.0.0.1:8000/alert-types', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlertTypes(data.response || []);
    } catch (error) {
      console.error("Error fetching alert types:", error);
    }
  }

  // Initialize token from Clerk and fetch incidents
  useEffect(() => {
    const initToken = async () => {
      const t = await getToken({ template: 'auth_token' });
      console.log('[DEBUG] Token from Clerk:', t ? `${t.substring(0, 50)}...` : 'null');
      setToken(t);
    };
    initToken();
  }, [getToken]);

  // Fetch incidents when token becomes available
  useEffect(() => {
    if (token) {
      getInc();
      getAlertTypes();
    }
  }, [token]);

  useEffect(() => {
    if (!getToken) return;
    let cancelled = false;
    let timer;

    const poll = async () => {
      if (cancelled) return;
      await getActiveJobs();
      if (cancelled) return;
      timer = setTimeout(poll, jobsPollDelayRef.current);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [getToken]);

  // SSE connection for real-time incident updates
  const connectToSSE = useCallback(async () => {
    if (!token || eventSourceRef.current || reconnectingRef.current) return;

    try {
      const freshToken = await getToken({ template: 'auth_token' });

      // Use the internal Next.js proxy route to bypass CORS strictness
      const response = await fetch('/api/stream', {
        headers: { 'Accept': 'text/event-stream' }
      });

      if (!response.ok) {
        console.error('[SSE] Connection failed:', response.status);
        setSseConnected(false);
        reconnectingRef.current = true;
        setTimeout(() => { reconnectingRef.current = false; connectToSSE(); }, 5000);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      console.log('[SSE] Connected to incident streaming');
      setSseConnected(true);

      // Process SSE stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6);
              if (raw === ': keep-alive') continue;

              try {
                const eventData = JSON.parse(raw);
                const eventType = eventData.type || 'message';
                const d = eventData.data || {};
                const incidentNumber = d.incident_number || d.incident_id;

                if (eventType === 'incident_received') {
                  toast.success(`New incident received: ${incidentNumber}`);
                  setLiveIncident({
                    inc_number: incidentNumber,
                    subject: d.subject,
                    tag_id: d.instance_id,
                    state: 'Received',
                    is_live: true
                  });
                  getInc();
                } else if (eventType === 'status_update') {
                  setLiveIncident(prev => prev ? { ...prev, state: d.status, status_message: d.message } : null);
                  if (d.status && d.status !== 'Processing') {
                    const icon = d.status === 'Resolved' ? '✅' : d.status === 'Error' ? '❌' : '🔄';
                    toast(`${d.status}: ${d.message}`, { icon });
                  }
                  getInc();
                } else if (eventType === 'tool_call') {
                  // Ensure message is always populated for display
                  const displayMessage = d.message || d.output || `Tool: ${d.tool}`;
                  setLiveToolUpdates(prev => [
                    ...prev.slice(-49), // keep last 50 entries
                    {
                      tool: d.tool,
                      status: d.status,
                      message: displayMessage,
                      args: d.args,
                      output: d.output,
                      incident_number: incidentNumber,
                      timestamp: new Date().toISOString()
                    }
                  ]);
                  if (d.status === 'running') {
                    toast(`🔧 ${d.tool}`, { duration: 2000 });
                  }
                } else if (eventType === 'incident_completed') {
                  setLiveIncident(prev => prev ? { ...prev, state: d.status, is_live: false } : null);
                  toast.success(`Incident ${d.status || 'completed'}: ${d.message || ''}`);
                  setTimeout(() => setLiveToolUpdates([]), 8000);
                  getInc();
                } else if (eventType === 'rca_ready') {
                  toast.success(`RCA is ready for ${incidentNumber}`);
                }
              } catch (e) { /* skip malformed JSON */ }
            }
          }
        } catch (error) {
          console.error('[SSE] Stream error:', error);
          setSseConnected(false);
          eventSourceRef.current = null;
          reconnectingRef.current = true;
          setTimeout(() => { reconnectingRef.current = false; connectToSSE(); }, 5000);
        }
      };

      processStream();
      eventSourceRef.current = { close: () => { reader.cancel(); setSseConnected(false); } };

    } catch (error) {
      console.error('[SSE] Connection error:', error);
      reconnectingRef.current = true;
      setTimeout(() => { reconnectingRef.current = false; connectToSSE(); }, 5000);
    }
  }, [token, getToken]);

  // Connect to SSE when token is available
  useEffect(() => {
    if (token) {
      connectToSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [token, connectToSSE]);

  const handleCreateIncident = async () => {
    if (!newIncidentData.short_description) {
      toast.error("Description is required");
      return;
    }

    try {
      setCreateLoading(true);
      await axios.post('http://127.0.0.1:8000/incidents/add', {
        short_description: newIncidentData.short_description,
        tag_id: newIncidentData.tag_id,
        alert_type_id: newIncidentData.alert_type_id ? parseInt(newIncidentData.alert_type_id) : null,
        state: "Queued",
        source: "manual"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("Incident created successfully");
      setShowCreateModal(false);
      setNewIncidentData({ short_description: "", tag_id: "", alert_type_id: "" });
      getInc(); // Refresh list
    } catch (error) {
      console.error("Error creating incident:", error);
      toast.error("Failed to create incident");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleTakeAction = async (incident) => {
    try {
      setActionLoading(incident.id);
      setActionResponses((prev) => ({ ...prev, [incident.id]: null }));

      // Step 1: Search CMDB for the tag ID
      const loadingToast = toast.loading('Searching CMDB...');
      const cmdbResponse = await axios.get(
        `http://127.0.0.1:8000/cmdb/search/${incident.tag_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!cmdbResponse.data.response.data || cmdbResponse.data.response.data.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No CMDB item found for this tag ID');
        setActionLoading(null);
        return;
      }

      const cmdbItem = cmdbResponse.data.response.data[0];
      toast.dismiss(loadingToast);
      toast.success('CMDB item found');

      // Store CMDB item with incident for later use
      incident.cmdbItem = cmdbItem;

      // Step 2: Get the plan
      const planToast = toast.loading('Creating action plan...');
      const planResponse = await axios.post(
        'http://127.0.0.1:8000/plan',
        {
          content: `Take action on incident: ${incident.short_description}. IP Address: ${cmdbItem.ip || 'N/A'
            }, OS: ${cmdbItem.os || 'N/A'}`,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const plan = planResponse.data.response;
      toast.dismiss(planToast);

      // Store the plan and show modal
      setPlans((prev) => ({
        ...prev,
        [incident.id]: {
          plan: plan,
          ipAddress: cmdbItem.ip || 'N/A',
          os: cmdbItem.os || 'N/A',
        },
      }));
      setSelectedIncident(incident);
      setShowPlanModal(true);
      setActionLoading(null);
    } catch (error) {
      console.error('Error taking action:', error);
      toast.error(error.response?.data?.detail || 'Failed to take action');
      setActionLoading(null);
    }
  };

  const executePlan = async () => {
    if (!selectedIncident) return;

    const { plan, ipAddress, os } = plans[selectedIncident.id];

    // Start streaming execution
    const executeToast = toast.loading('Starting AI-powered incident resolution with streaming...');
    setExecuteLoading(true);
    setStreamingExecution(true);
    setExecutionSteps([]);
    setCurrentStepIndex(-1);
    setExecutionResult(null);

    try {
      // Use the local Next.js proxy route for streaming execution
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          inc_number: selectedIncident.inc_number,
        }),
      });

      if (!response.ok) {
        throw new Error('Streaming request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      toast.dismiss(executeToast);
      toast.success('AI-powered resolution started - streaming tool usage...');

      // Process streaming events
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // Handle tool call events
              if (parsed.type === 'tool_call') {
                const tool = parsed.tool;
                setExecutionSteps(prev => [
                  ...prev,
                  {
                    name: tool.name,
                    args: tool.args,
                    output: tool.output,
                    status: tool.status,
                    timestamp: new Date().toISOString(),
                  }
                ]);
                setCurrentStepIndex(prev => prev + 1);
              }
              // Handle status events
              else if (parsed.type === 'status') {
                setExecutionSteps(prev => [
                  ...prev,
                  {
                    name: 'status',
                    args: {},
                    output: parsed.message,
                    status: parsed.status,
                    timestamp: new Date().toISOString(),
                  }
                ]);
                setCurrentStepIndex(prev => prev + 1);
              }
              // Handle completion
              else if (parsed.type === 'done') {
                setExecutionResult(parsed.status);
                toast.success('Incident processing completed');
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      setExecuteLoading(false);

    } catch (error) {
      console.error('Error executing plan:', error);
      toast.dismiss(executeToast);
      toast.error(error.response?.data?.detail || 'Failed to execute plan');
      setExecuteLoading(false);
      setStreamingExecution(false);
    }
  };

  const handleCloseModal = (open) => {
    if (!open) {
      setShowPlanModal(false);
      setSelectedIncident(null);
      setExecuteLoading(false);
      // Clear streaming state
      setStreamingExecution(false);
      setExecutionSteps([]);
      setCurrentStepIndex(-1);
      setExecutionResult(null);
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  };

  // Check if selected incident is currently processing
  const isIncidentProcessing = selectedIncident &&
    (selectedIncident.state === 'Processing' ||
      selectedIncident.state === 'InProgress' ||
      selectedIncident.state === 'Active');

  // Fetch execution results for streaming
  const fetchExecutionResults = async (incNumber) => {
    if (!token) return;
    try {
      const { data } = await axios.get(`http://127.0.0.1:8000/getResults/${incNumber}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const results = data.response.data || [];
      if (results.length > 0) {
        const latestResult = results[results.length - 1];
        const parsed = parseExecutionRecord(latestResult.description);

        if (parsed) {
          // Build execution steps array
          const steps = [];

          // Add diagnostic steps
          if (parsed.diagnostics?.diagnostics) {
            parsed.diagnostics.diagnostics.forEach((step, idx) => {
              steps.push({
                type: 'diagnostic',
                step: step.step,
                command: step.command,
                output: step.output,
                error: step.error,
                success: step.success,
                index: steps.length,
              });
            });
          }

          // Add resolution steps
          if (parsed.resolution?.resolution_results) {
            parsed.resolution.resolution_results.forEach((step) => {
              steps.push({
                type: 'resolution',
                step: step.step,
                command: step.command,
                output: step.result?.output,
                error: step.result?.error,
                success: step.result?.success,
                index: steps.length,
              });
            });
          }

          setExecutionSteps(steps);
          setExecutionResult(parsed);

          // Update current step index based on completion
          const completedSteps = steps.filter(s => s.success !== undefined);
          setCurrentStepIndex(completedSteps.length - 1);

          // If we have results and execution is complete
          if (parsed.resolution?.resolution_results?.length > 0) {
            const allResolved = parsed.resolution.resolution_results.every(r => r.result?.success);
            if (allResolved) {
              // Stop polling
              if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
              }
              setStreamingExecution(false);
              setExecuteLoading(false);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching execution results:', error);
    }
  };

  // Parse execution record description
  const parseExecutionRecord = (description) => {
    if (!description) return null;
    if (typeof description === 'object') return description;
    try {
      return JSON.parse(description);
    } catch {
      return null;
    }
  };

  // Fetch incident details and tool updates for streaming modal
  const fetchIncidentStream = async (incNumber) => {
    if (!token) return;
    try {
      const { data } = await axios.get(`http://127.0.0.1:8000/api/v1/incidents/stream/${incNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error fetching incident stream:', error);
    }
  };

  // --- Dashboard helpers and derived state ---
  const getStateBadgeVariant = (state) => {
    const s = (state || '').toLowerCase();
    if (s === 'processing' || s === 'inprogress' || s === 'active') return 'default'; // Blueish usually
    if (s === 'resolved' || s === 'completed') return 'secondary'; // Greenish ideally, or we use className
    if (s === 'error') return 'destructive';
    return 'outline';
  };

  const getStateBadgeClass = (state) => {
    const s = (state || '').toLowerCase();
    if (s === 'resolved' || s === 'completed') return 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200';
    if (s === 'partially resolved') return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200';
    return '';
  }

  const getStateProgress = (state) => {
    const s = (state || '').toLowerCase();
    if (s === 'processing' || s === 'inprogress' || s === 'active') return 40;
    if (s === 'partially resolved' || s === 'partially_resolved') return 70;
    if (s === 'resolved' || s === 'completed') return 100;
    if (s === 'error') return 100;
    return 10; // default: new/unknown
  };

  const currentProcessingIncident = incidents.find((incident) => {
    const s = (incident.state || '').toLowerCase();
    return s === 'processing' || s === 'inprogress' || s === 'active';
  });

  const stateSummary = incidents.reduce((acc, incident) => {
    const key = incident.state || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const totalIncidents = incidents.length || 1; // avoid divide-by-zero

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
            <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-8">
              <ToasterComponent position="top-center" />

              <div className="md:hidden flex items-center justify-between mb-6">
                <Link href="/dashboard">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Infra.ai</h1>
                </Link>
                <div className="flex gap-2 items-center">
                  <ModeToggle />
                  <UserButton />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <div className="flex gap-2">
                  <Button onClick={getInc} disabled={loading} variant="outline">
                    Refresh Incidents
                  </Button>
                  <Button onClick={() => setShowCreateModal(true)}>
                    Create Incident
                  </Button>
                </div>
              </div>

              {/* Active Background Jobs Section */}
              {activeJobs.length > 0 && (
                <section>
                  <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                        Active Background Tasks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {activeJobs.map(job => (
                        <div key={job.id} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium capitalize">{job.task_type.replace('_', ' ')}</span>
                            <span className="text-muted-foreground">{job.status} ({job.progress}%)</span>
                          </div>
                          <Progress value={job.progress} className="h-2" />
                          {job.details?.step && (
                            <p className="text-xs text-muted-foreground capitalize">Current Step: {job.details.step.replace(/_/g, ' ')}</p>
                          )}
                          {job.details?.stage && (
                            <p className="text-xs text-muted-foreground capitalize">Stage: {job.details.stage.replace(/_/g, ' ')}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Active incident & incident overview visualization */}

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-primary/10 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>
                        <div className="flex items-center gap-2">
                          Current incident in progress
                          {sseConnected && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <Radio className="h-3 w-3 animate-pulse" /> Live
                            </span>
                          )}
                        </div>
                      </CardTitle>
                      {currentProcessingIncident && (
                        <Badge variant={getStateBadgeVariant(currentProcessingIncident.state)} className={getStateBadgeClass(currentProcessingIncident.state)}>
                          {currentProcessingIncident.state}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {currentProcessingIncident || liveIncident ? (
                      <div className="space-y-6">
                        <div>
                          <p className="text-lg font-medium mb-1">
                            {(currentProcessingIncident || liveIncident).short_description || (currentProcessingIncident || liveIncident).subject}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Incident {(currentProcessingIncident || liveIncident).inc_number} · Tag {(currentProcessingIncident || liveIncident).tag_id}
                            {liveIncident && liveIncident.is_live && (
                              <span className="ml-2 text-green-600 font-medium">[LIVE]</span>
                            )}
                          </p>
                        </div>

                        {/* Live Tool Updates */}
                        {liveToolUpdates.length > 0 && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                              <Terminal className="h-4 w-4" /> Tools Being Used
                            </h4>
                            <div className="space-y-1">
                              {liveToolUpdates.slice(-5).map((update, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  {update.status === 'running' ? (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                  ) : update.status === 'completed' ? (
                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-red-500" />
                                  )}
                                  <span className="font-medium">{update.tool}</span>
                                  <span className="text-muted-foreground">- {update.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Live Status Message */}
                        {liveIncident && liveIncident.status_message && (
                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                            <p className="text-sm text-purple-900 dark:text-purple-200">
                              <Activity className="h-4 w-4 inline mr-2" />
                              {liveIncident.status_message}
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>New</span>
                            <span>Processing</span>
                            <span>Verification</span>
                            <span>Resolved</span>
                          </div>
                          <Progress value={getStateProgress((currentProcessingIncident || liveIncident).state)} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            Progress is inferred from the incident state. As the backend worker moves the
                            incident through diagnostics and resolution, this bar will advance.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between py-4">
                        <p className="text-sm text-muted-foreground">
                          No incident is currently in the <span className="font-semibold text-foreground">Processing</span> state.
                        </p>
                        <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                          Waiting for new incidents
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/10 shadow-sm">
                  <CardHeader>
                    <CardTitle>Incident status overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(stateSummary).map(([state, count]) => {
                      const percentage = Math.round((count / totalIncidents) * 100);
                      return (
                        <div key={state} className="space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{state}</span>
                            <span>
                              {count} · {percentage}%
                            </span>
                          </div>
                          <Progress value={percentage} className="h-1.5" indicatorClassName={
                            state.toLowerCase().includes('resolved') ? "bg-green-500" :
                              state.toLowerCase().includes('processing') ? "bg-blue-500" :
                                "bg-primary"
                          } />
                        </div>
                      );
                    })}
                    {incidents.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No incidents found yet. Once incidents are ingested, their lifecycle state will
                        be visualized here.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>

              <div className="grid grid-cols-1 gap-6">
                {loading ? (
                  // Loading skeleton
                  Array.from({ length: 3 }).map((_, index) => (
                    <Card key={index} className="border-muted">
                      <CardHeader className="space-y-2">
                        <div className="h-6 w-3/4 bg-muted animate-pulse rounded"></div>
                        <div className="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
                          <div className="h-4 w-5/6 bg-muted animate-pulse rounded"></div>
                        </div>
                        <div className="h-10 w-32 bg-muted animate-pulse rounded"></div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  incidents.map((incident) => (
                    <Card
                      key={incident.id}
                      className={`hover:shadow-md transition-all duration-200 border-muted cursor-pointer ${(currentProcessingIncident?.id === incident.id || liveIncident?.inc_number === incident.inc_number)
                        ? 'ring-2 ring-blue-500 border-blue-500'
                        : ''
                        }`}
                      onClick={() => router.push(`/Details/${incident.inc_number}`)}
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                          <div className="space-y-4 flex-1">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-xl font-semibold">
                                  {incident.short_description}
                                </h2>
                                <Badge variant={getStateBadgeVariant(incident.state)} className={getStateBadgeClass(incident.state)}>
                                  {incident.state || 'Unknown'}
                                </Badge>
                                {/* Show click hint for processing incidents */}
                                {((incident.state || '').toLowerCase() === 'processing' ||
                                  (incident.state || '').toLowerCase() === 'inprogress') && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                      <Radio className="h-3 w-3 animate-pulse" /> Click to view live
                                    </span>
                                  )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                <p><span className="font-medium text-foreground">Incident Number:</span> {incident.inc_number}</p>
                                <p><span className="font-medium text-foreground">Tag ID:</span> {incident.tag_id}</p>
                                {incident.alert_type_id && <p><span className="font-medium text-foreground">Alert Type ID:</span> {incident.alert_type_id}</p>}
                                <p><span className="font-medium text-foreground">Created:</span> {new Date(incident.created_at).toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Progress</span>
                                <span>{getStateProgress(incident.state)}%</span>
                              </div>
                              <Progress value={getStateProgress(incident.state)} className="h-1.5" />
                            </div>

                            {actionResponses[incident.id] && (
                              <div className="p-4 bg-muted/50 rounded-lg text-sm border border-border">
                                <h3 className="font-medium mb-1">Action Response:</h3>
                                <p className="text-muted-foreground">{actionResponses[incident.id]}</p>
                              </div>
                            )}

                            {/* Tools being used - show for processing incidents */}
                            {((incident.state || '').toLowerCase() === 'processing' ||
                              (incident.state || '').toLowerCase() === 'inprogress' ||
                              liveIncident?.inc_number === incident.inc_number) && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Terminal className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">Tools Being Used</span>
                                    {(liveIncident?.inc_number === incident.inc_number && liveIncident?.is_live) && (
                                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full animate-pulse">
                                        LIVE
                                      </span>
                                    )}
                                  </div>
                                  {liveToolUpdates.length > 0 ? (
                                    <div className="space-y-1">
                                      {liveToolUpdates.slice(-3).map((update, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                          {update.status === 'running' ? (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                          ) : update.status === 'completed' ? (
                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                          ) : (
                                            <XCircle className="w-3 h-3 text-red-500" />
                                          )}
                                          <span className="font-medium">{update.tool}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-blue-700 dark:text-blue-400">
                                      Waiting for tools to start...
                                    </p>
                                  )}
                                </div>
                              )}
                          </div>

                          <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto">
                            <Button
                              variant="secondary"
                              onClick={() => router.push(`/Details/${incident.inc_number}`)}
                              className="w-full md:w-auto"
                            >
                              Details
                            </Button>
                            <Button
                              onClick={() => handleTakeAction(incident)}
                              disabled={actionLoading === incident.id}
                              className={`w-full md:w-auto ${actionLoading === incident.id ? 'opacity-70' : ''}`}
                              variant={actionLoading === incident.id ? "ghost" : "default"}
                            >
                              {actionLoading === incident.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                                  Taking Action...
                                </>
                              ) : (
                                'Take Action'
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </main>

          {/* Create Incident Modal */}
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Incident</DialogTitle>
                <DialogDescription>Manually create a new incident in the system.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="desc" className="text-right text-sm font-medium">Description</label>
                  <input
                    id="desc"
                    className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={newIncidentData.short_description}
                    onChange={(e) => setNewIncidentData({ ...newIncidentData, short_description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="tag" className="text-right text-sm font-medium">Tag ID</label>
                  <input
                    id="tag"
                    className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={newIncidentData.tag_id}
                    onChange={(e) => setNewIncidentData({ ...newIncidentData, tag_id: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="alertType" className="text-right text-sm font-medium">Alert Type</label>
                  <select
                    id="alertType"
                    className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={newIncidentData.alert_type_id}
                    onChange={(e) => setNewIncidentData({ ...newIncidentData, alert_type_id: e.target.value })}
                  >
                    <option value="">Select Alert Type</option>
                    {alertTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name} ({type.priority})</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button onClick={handleCreateIncident} disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create Incident"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showPlanModal} onOpenChange={handleCloseModal}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedIncident?.state === 'Processing' || selectedIncident?.state === 'InProgress' ? (
                    <>
                      <span className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                        Live Incident Progress
                      </span>
                    </>
                  ) : (
                    'Action Plan for ' + selectedIncident?.short_description
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedIncident?.state === 'Processing' || selectedIncident?.state === 'InProgress'
                    ? 'Watching live incident resolution progress in real-time'
                    : streamingExecution
                      ? 'Streaming execution results in real-time'
                      : 'Review the proposed action plan before execution.'}
                </DialogDescription>
              </DialogHeader>

              {/* Streaming Execution Record */}
              {streamingExecution || (selectedIncident?.state === 'Processing') || (selectedIncident?.state === 'InProgress') ? (
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  {/* Live Status for Processing Incidents */}
                  {(selectedIncident?.state === 'Processing' || selectedIncident?.state === 'InProgress') && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2 text-red-900 dark:text-red-200">
                          <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                          Live Incident Resolution
                        </h3>
                        <Badge variant="default" className="bg-red-500 hover:bg-red-600">
                          {selectedIncident?.state || 'Processing'}
                        </Badge>
                      </div>

                      {/* Live Tool Updates */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-2">
                          <Terminal className="h-4 w-4" /> Tools Being Executed
                        </h4>
                        {liveToolUpdates.length > 0 ? (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {liveToolUpdates.map((update, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-white dark:bg-red-950/30 rounded">
                                {update.status === 'running' ? (
                                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                                ) : update.status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="font-medium">{update.tool}</span>
                                <span className="text-muted-foreground text-xs">- {update.message}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-red-700 dark:text-red-400">
                            Waiting for tools to start...
                          </p>
                        )}
                      </div>

                      {/* Live Status Message */}
                      {liveIncident?.status_message && (
                        <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-sm">
                          <Activity className="h-4 w-4 inline mr-2 text-purple-500" />
                          {liveIncident.status_message}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Root Cause Analysis */}
                  {executionResult?.analysis && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <h3 className="font-semibold flex items-center gap-2 mb-3 text-purple-900 dark:text-purple-200">
                        <Activity className="h-4 w-4" /> Root Cause Analysis
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-[100px_1fr] gap-2">
                          <span className="font-medium text-purple-700 dark:text-purple-400">Root Cause:</span>
                          <span className="text-gray-700 dark:text-gray-300">{executionResult.analysis.root_cause || 'N/A'}</span>
                        </div>
                        {executionResult.analysis.verification && (
                          <div className="grid grid-cols-[100px_1fr] gap-2">
                            <span className="font-medium text-purple-700 dark:text-purple-400">Verification:</span>
                            <span className="text-gray-700 dark:text-gray-300">{executionResult.analysis.verification}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Execution Progress */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Execution Progress</span>
                    <span className="text-muted-foreground">
                      {executionSteps.filter(s => s.success !== undefined).length} / {executionSteps.length} steps completed
                    </span>
                  </div>
                  <Progress
                    value={executionSteps.length > 0 ? (executionSteps.filter(s => s.success !== undefined).length / executionSteps.length) * 100 : 0}
                    className="h-2"
                  />

                  {/* Diagnostic Steps */}
                  {executionSteps.filter(s => s.type === 'diagnostic').length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        <span className="font-semibold">Diagnostic Steps ({executionSteps.filter(s => s.type === 'diagnostic').length})</span>
                      </div>
                      <div className="divide-y">
                        {executionSteps.filter(s => s.type === 'diagnostic').map((step, idx) => (
                          <div key={idx} className="p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                {step.success === true ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : step.success === false ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                )}
                                <span className="font-medium text-sm">{step.step}</span>
                              </div>
                              {step.success !== undefined && (
                                <Badge variant={step.success ? "secondary" : "destructive"} className={step.success ? "bg-green-100 text-green-700" : ""}>
                                  {step.success ? "Success" : "Failed"}
                                </Badge>
                              )}
                            </div>
                            {step.command && (
                              <div className="font-mono text-xs bg-muted p-2 rounded overflow-x-auto">
                                $ {step.command}
                              </div>
                            )}
                            {(step.output || step.error) && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-primary hover:underline w-fit">Show Output</summary>
                                <div className="mt-2 font-mono bg-black text-gray-50 p-2 rounded overflow-x-auto max-h-32">
                                  {step.output || step.error}
                                </div>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution Steps */}
                  {executionSteps.filter(s => s.type === 'resolution').length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3 border-b flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        <span className="font-semibold">Resolution Steps ({executionSteps.filter(s => s.type === 'resolution').length})</span>
                      </div>
                      <div className="divide-y">
                        {executionSteps.filter(s => s.type === 'resolution').map((step, idx) => (
                          <div key={idx} className="p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                {step.success === true ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : step.success === false ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                )}
                                <span className="font-medium text-sm">{step.step}</span>
                              </div>
                              {step.success !== undefined && (
                                <Badge variant={step.success ? "default" : "destructive"}>
                                  {step.success ? "Success" : "Failed"}
                                </Badge>
                              )}
                            </div>
                            {step.command && (
                              <div className="font-mono text-xs bg-muted p-2 rounded overflow-x-auto">
                                $ {step.command}
                              </div>
                            )}
                            {(step.output || step.error) && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-primary hover:underline w-fit">Show Output</summary>
                                <div className="mt-2 font-mono bg-black text-gray-50 p-2 rounded overflow-x-auto max-h-32">
                                  {step.output || step.error}
                                </div>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Waiting for results */}
                  {executionSteps.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-muted-foreground">Waiting for execution results...</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Plan Review Mode */
                selectedIncident && (
                  <div className="space-y-4 py-4">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                      <h3 className="font-medium">Incident Details</h3>
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <p><span className="font-medium text-foreground">IP Address:</span> {plans[selectedIncident.id]?.ipAddress}</p>
                        <p><span className="font-medium text-foreground">OS:</span> {plans[selectedIncident.id]?.os}</p>
                        <p><span className="font-medium text-foreground">Tag ID:</span> {selectedIncident.tag_id}</p>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <h3 className="font-medium text-sm">Action Plan</h3>
                      <pre className="text-xs md:text-sm bg-background p-2 rounded border overflow-x-auto whitespace-pre-wrap">
                        {typeof plans[selectedIncident.id]?.plan === 'object'
                          ? JSON.stringify(plans[selectedIncident.id]?.plan, null, 2)
                          : plans[selectedIncident.id]?.plan}
                      </pre>
                    </div>
                  </div>
                )
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => handleCloseModal(false)}>
                  {streamingExecution || (selectedIncident?.state === 'Processing') ? 'Close' : 'Cancel'}
                </Button>
                {!streamingExecution && !(selectedIncident?.state === 'Processing') && !(selectedIncident?.state === 'InProgress') && (
                  <Button onClick={executePlan} disabled={executeLoading}>
                    {executeLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Executing...
                      </>
                    ) : 'Execute Plan'}
                  </Button>
                )}
                {(selectedIncident?.state === 'Processing' || selectedIncident?.state === 'InProgress') && (
                  <Button variant="secondary" onClick={() => getInc()}>
                    <Activity className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}
