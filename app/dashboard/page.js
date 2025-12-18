'use client'
import Link from "next/link";
import { MdDashboard, MdSecurity } from "react-icons/md";
import { IoIosRefresh } from "react-icons/io";
import { useRouter } from "next/navigation";
import { useAuth } from '@clerk/nextjs';
import { ClerkProvider, SignedIn } from '@clerk/nextjs';
import axios from "axios";
import { useEffect, useState } from "react";
import { FaDatabase, FaBookOpen } from "react-icons/fa";
import { BsChatFill } from "react-icons/bs";
import { UserButton } from "@clerk/nextjs";
import { Toaster, toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';

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
  const [selectedIncident, setSelectedIncident] = useState(null);

  const getClerkToken = async () => {
    const t = await getToken({ template: "auth_token" });
    setToken(t);
  };

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

  useEffect(() => {
    async function getIncidents() {
      if (!token) {
        await getClerkToken();
      }
      if (token) {
        await getInc();
      }
    }
    getIncidents();
  }, [token]);

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
          content: `Take action on incident: ${incident.short_description}. IP Address: ${
            cmdbItem.ip || 'N/A'
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

  // --- Dashboard helpers and derived state ---
  const getStateBadgeClasses = (state) => {
    const s = (state || '').toLowerCase();
    if (s === 'processing' || s === 'inprogress' || s === 'active') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
    if (s === 'resolved' || s === 'completed') {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
    if (s === 'partially resolved' || s === 'partially_resolved') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
    if (s === 'error') {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <ToasterComponent position="top-center" />

          {/* Navigation Bar */}
          <nav className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center space-x-8">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Infra.ai Dashboard</h1>
                  <div className="hidden md:flex space-x-4">
                    <Link
                      href="/dashboard"
                      className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    >
                      <MdDashboard className="w-5 h-5 mr-2" />
                      Dashboard
                    </Link>
                    <Link
                      href="/creds"
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <MdSecurity className="w-5 h-5 mr-2" />
                      Credentials
                    </Link>
                    <Link
                      href="/chat"
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <BsChatFill className="w-5 h-5 mr-2" />
                      Chat
                    </Link>
                    <Link
                      href="/cmdb"
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <FaDatabase className="w-5 h-5 mr-2" />
                      CMDB
                    </Link>
                    <Link
                      href="/knowledge"
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <FaBookOpen className="w-5 h-5 mr-2" />
                      Knowledge Base
                    </Link>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={getInc}
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <IoIosRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "w-10 h-10 rounded-full",
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Active incident & incident overview visualization */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                  <span>Current incident in progress</span>
                  {currentProcessingIncident && (
                    <span className={`px-2 py-1 rounded-full text-xs ${getStateBadgeClasses(currentProcessingIncident.state)}`}>
                      {currentProcessingIncident.state}
                    </span>
                  )}
                </h2>
                {currentProcessingIncident ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">
                        {currentProcessingIncident.short_description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Incident {currentProcessingIncident.inc_number} · Tag {currentProcessingIncident.tag_id}
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>New</span>
                        <span>Processing</span>
                        <span>Verification</span>
                        <span>Resolved</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${getStateProgress(currentProcessingIncident.state)}%` }}
                        ></div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Progress is inferred from the incident state. As the backend worker moves the
                        incident through diagnostics and resolution, this bar will advance.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      No incident is currently in the <span className="font-semibold">Processing</span> state.
                    </p>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Waiting for new incidents from queue
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Incident status overview
                </h2>
                <div className="space-y-3">
                  {Object.entries(stateSummary).map(([state, count]) => {
                    const percentage = Math.round((count / totalIncidents) * 100);
                    return (
                      <div key={state} className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>{state}</span>
                          <span>
                            {count} · {percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {incidents.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No incidents found yet. Once incidents are ingested, their lifecycle state will
                      be visualized here.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6">
              {loading ? (
                // Loading skeleton
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 animate-pulse"
                  >
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                ))
              ) : (
                incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow duration-200"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                          {incident.short_description}
                        </h2>
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Incident Number:</span> {incident.inc_number}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">State:</span>
                            <span
                              className={`ml-2 px-2 py-1 rounded-full text-xs ${getStateBadgeClasses(
                                incident.state,
                              )}`}
                            >
                              {incident.state || 'Unknown'}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Tag ID:</span> {incident.tag_id}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Created:</span>{' '}
                            {new Date(incident.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => router.push(`/Details/${incident.inc_number}`)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleTakeAction(incident)}
                          disabled={actionLoading === incident.id}
                          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                            actionLoading === incident.id
                              ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {actionLoading === incident.id ? (
                            <div className="flex items-center">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Taking Action...
                            </div>
                          ) : (
                            'Take Action'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Simple per-incident progress bar */}
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full"
                          style={{ width: `${getStateProgress(incident.state)}%` }}
                        ></div>
                      </div>
                    </div>

                    {actionResponses[incident.id] && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Action Response:
                        </h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {actionResponses[incident.id]}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </main>

          {/* Plan Confirmation Modal */}
          {showPlanModal && selectedIncident && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Action Plan for {selectedIncident.short_description}
                </h2>
                <div className="space-y-4 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Incident Details:
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">IP Address:</span>{' '}
                      {plans[selectedIncident.id]?.ipAddress}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Tag ID:</span> {selectedIncident.tag_id}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">OS:</span> {plans[selectedIncident.id]?.os}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Action Plan:
                    </h3>
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {typeof plans[selectedIncident.id]?.plan === 'object'
                        ? JSON.stringify(plans[selectedIncident.id]?.plan, null, 2)
                        : plans[selectedIncident.id]?.plan}
                    </pre>
                  </div>
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => {
                      setShowPlanModal(false);
                      setSelectedIncident(null);
                      setExecuteLoading(false);
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executePlan}
                    disabled={executeLoading}
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                      executeLoading
                        ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {executeLoading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Executing...
                      </div>
                    ) : (
                      'Execute Plan'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}
