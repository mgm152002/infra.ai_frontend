'use client'
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from '@clerk/nextjs';
import { ClerkProvider, SignedIn } from '@clerk/nextjs';
import axios from "axios";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";

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
      });
      setIncidents(data.response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      setLoading(false);
      toast.error('Failed to fetch incidents');
    }
  }

  async function getActiveJobs() {
    if (!token) return;
    try {
      const { data } = await axios.get('http://127.0.0.1:8000/jobs/active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveJobs(data.response || []);
    } catch (error) {
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
      const t = await getToken();
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
    let interval;
    if (token) {
      getActiveJobs();
      interval = setInterval(getActiveJobs, 3000); // Poll every 3 seconds
    }
    return () => clearInterval(interval);
  }, [token]);

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

    // Submit job for plan execution
    const executeToast = toast.loading('Executing plan...');
    setExecuteLoading(true);

    try {
      // First call chat endpoint
      const chatResponse = await axios.post(
        'http://127.0.0.1:8000/chat',
        {
          content: `Execute the following plan for incident ${selectedIncident.short_description} (IP: ${ipAddress}, OS: ${os}) plan: ${plan}`,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Then store the result
      await axios.post(
        `http://127.0.0.1:8000/storeResult?inc_number=${selectedIncident.inc_number}&result=${encodeURIComponent(
          chatResponse.data.successorfail,
        )}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      toast.dismiss(executeToast);
      toast.success('Plan executed and result stored successfully');

      // Close modal
      setShowPlanModal(false);
      setSelectedIncident(null);
    } catch (error) {
      console.error('Error executing plan:', error);
      toast.dismiss(executeToast);
      toast.error(error.response?.data?.detail || 'Failed to execute plan');
    } finally {
      setExecuteLoading(false);
    }
  };

  const handleCloseModal = (open) => {
    if (!open) {
      setShowPlanModal(false);
      setSelectedIncident(null);
      setExecuteLoading(false);
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
                      <CardTitle>Current incident in progress</CardTitle>
                      {currentProcessingIncident && (
                        <Badge variant={getStateBadgeVariant(currentProcessingIncident.state)} className={getStateBadgeClass(currentProcessingIncident.state)}>
                          {currentProcessingIncident.state}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {currentProcessingIncident ? (
                      <div className="space-y-6">
                        <div>
                          <p className="text-lg font-medium mb-1">
                            {currentProcessingIncident.short_description}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Incident {currentProcessingIncident.inc_number} · Tag {currentProcessingIncident.tag_id}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>New</span>
                            <span>Processing</span>
                            <span>Verification</span>
                            <span>Resolved</span>
                          </div>
                          <Progress value={getStateProgress(currentProcessingIncident.state)} className="h-2" />
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
                    <Card key={incident.id} className="hover:shadow-md transition-shadow duration-200 border-muted">
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
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Action Plan for {selectedIncident?.short_description}</DialogTitle>
                <DialogDescription>
                  Review the proposed action plan before execution.
                </DialogDescription>
              </DialogHeader>

              {selectedIncident && (
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
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => handleCloseModal(false)}>Cancel</Button>
                <Button onClick={executePlan} disabled={executeLoading}>
                  {executeLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Executing...
                    </>
                  ) : 'Execute Plan'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}
