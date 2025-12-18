'use client'

import { useEffect, useState, use } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { MdDashboard, MdSecurity } from 'react-icons/md';
import { BsChatFill } from 'react-icons/bs';
import { FaDatabase, FaBookOpen } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

export default function IncidentDetails({ params }) {
  const resolvedParams = use(params);
  const { slug } = resolvedParams;
  const [incidentDetails, setIncidentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const { getToken } = useAuth();
  const router = useRouter();

  const parseResultDescription = (description) => {
    if (!description) return null;
    if (typeof description === 'object') return description;
    try {
      return JSON.parse(description);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (slug) {
      fetchIncidentDetails(slug);
      fetchResults(slug);
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

  if (loading) {
    return (
      <ClerkProvider>
        <SignedIn>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Navigation Bar */}
            <nav className="bg-white dark:bg-gray-800 shadow-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center space-x-8">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Infra.ai Dashboard</h1>
                    <div className="hidden md:flex space-x-4">
                      <Link href="/dashboard" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                        <MdDashboard className="w-5 h-5 mr-2" />
                        Dashboard
                      </Link>
                      <Link href="/creds" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                        <MdSecurity className="w-5 h-5 mr-2" />
                        Credentials
                      </Link>
                      <Link href="/chat" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                        <BsChatFill className="w-5 h-5 mr-2" />
                        Chat
                      </Link>
                      <Link href="/cmdb" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                        <FaDatabase className="w-5 h-5 mr-2" />
                        CMDB
                      </Link>
                      <Link href="/knowledge" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                        <FaBookOpen className="w-5 h-5 mr-2" />
                        Knowledge Base
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <UserButton 
                      appearance={{
                        elements: {
                          userButtonAvatarBox: "w-10 h-10 rounded-full"
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </nav>

            {/* Loading State */}
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="flex justify-center items-center h-64">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </main>
          </div>
        </SignedIn>
      </ClerkProvider>
    );
  }

  const description = incidentDetails?.description || "No description available.";
  const cause = incidentDetails?.potential_cause || "No cause found.";
  const solution = incidentDetails?.potential_solution || "No solution found.";

  return (
    <ClerkProvider>
      <SignedIn>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Navigation Bar */}
          <nav className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-8">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Infra.ai Dashboard</h1>
                  <div className="hidden md:flex space-x-4">
                    <Link href="/dashboard" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      <MdDashboard className="w-5 h-5 mr-2" />
                      Dashboard
                    </Link>
                    <Link href="/creds" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      <MdSecurity className="w-5 h-5 mr-2" />
                      Credentials
                    </Link>
                    <Link href="/chat" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      <BsChatFill className="w-5 h-5 mr-2" />
                      Chat
                    </Link>
                    <Link href="/cmdb" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      <FaDatabase className="w-5 h-5 mr-2" />
                      CMDB
                    </Link>
                    <Link href="/knowledge" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      <FaBookOpen className="w-5 h-5 mr-2" />
                      Knowledge Base
                    </Link>
                  </div>
                </div>
                <div className="flex items-center">
                  <UserButton 
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "w-10 h-10 rounded-full"
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Incident Details</h1>
                <button 
                  onClick={() => router.back()}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
                >
                  Back to Dashboard
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">📝 Description</h2>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{description}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🚨 Potential Cause</h2>
                  <p className="text-gray-700 dark:text-gray-300">{cause}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🛠️ Potential Solution</h2>
                  <p className="text-gray-700 dark:text-gray-300">{solution}</p>
                </div>

                

                {/* Results Section */}
                <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Action Results</h2>
                  {results.length > 0 ? (
                    <div className="space-y-4">
                      {results.map((result, index) => {
                        const parsed = parseResultDescription(result.description);
                        const diagnostics = parsed?.diagnostics?.diagnostics || [];
                        const analysis = parsed?.analysis;
                        const resolution = parsed?.resolution;
                        const resolutionResults = resolution?.resolution_results || [];
                        const knowledgeBase = parsed?.knowledge_base;
                        const rawPlan = parsed?.diagnostics?.raw_response;

                        const allResolutionSuccessful =
                          resolutionResults.length > 0 &&
                          resolutionResults.every((step) => step.result?.success);

                        return (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  <span className="font-medium">Executed at:</span>{' '}
                                  {new Date(result.created_at).toLocaleString()}
                                </p>
                                {analysis?.root_cause && (
                                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                                    <span className="font-semibold">Root cause:</span>{' '}
                                    {analysis.root_cause}
                                  </p>
                                )}
                              </div>
                              {resolutionResults.length > 0 && (
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    allResolutionSuccessful
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  }`}
                                >
                                  {allResolutionSuccessful ? 'All resolution steps succeeded' : 'Resolution has partial/failed steps'}
                                </span>
                              )}
                            </div>

                            {/* If we cannot parse the description as structured JSON, fall back to raw view */}
                            {!parsed ? (
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                  {result.description}
                                </pre>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {/* Diagnostics */}
                                {diagnostics.length > 0 && (
                                  <section>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                      Diagnostics
                                    </h3>
                                    <div className="space-y-3">
                                      {diagnostics.map((step, stepIndex) => (
                                        <div
                                          key={stepIndex}
                                          className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900"
                                        >
                                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                                            <div className="flex-1">
                                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                Step {stepIndex + 1}: {step.step}
                                              </p>
                                              {step.command && (
                                                <p className="mt-1 text-xs font-mono bg-gray-900 text-gray-100 rounded px-2 py-1 overflow-x-auto">
                                                  {step.command}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                  step.success
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                }`}
                                              >
                                                {step.success ? 'Success' : 'Failed'}
                                              </span>
                                              <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                  step.verified
                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                }`}
                                              >
                                                {step.verified ? 'Verified' : 'Needs review'}
                                              </span>
                                            </div>
                                          </div>

                                          {step.expected_output && (
                                            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                                              <span className="font-semibold">Expected:</span> {step.expected_output}
                                            </p>
                                          )}

                                          {(step.output || step.error) && (
                                            <details className="mt-2 text-xs">
                                              <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                                                View command output
                                              </summary>
                                              {step.output && (
                                                <pre className="mt-2 whitespace-pre-wrap font-mono bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto">
                                                  {step.output}
                                                </pre>
                                              )}
                                              {step.error && (
                                                <pre className="mt-2 whitespace-pre-wrap font-mono bg-red-900 text-red-100 rounded p-2 overflow-x-auto">
                                                  {step.error}
                                                </pre>
                                              )}
                                            </details>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </section>
                                )}

                                {/* Analysis / RCA */}
                                {analysis && (
                                  <section>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                      Root Cause Analysis
                                    </h3>
                                    {analysis.root_cause && (
                                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                                        {analysis.root_cause}
                                      </p>
                                    )}
                                    {Array.isArray(analysis.resolution_steps) && analysis.resolution_steps.length > 0 && (
                                      <div className="mt-2">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                                          Recommended resolution steps
                                        </h4>
                                        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                          {analysis.resolution_steps.map((stepText, i) => (
                                            <li key={i}>{stepText}</li>
                                          ))}
                                        </ol>
                                      </div>
                                    )}
                                    {analysis.verification && (
                                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                                        <span className="font-semibold">Verification:</span> {analysis.verification}
                                      </p>
                                    )}
                                  </section>
                                )}

                                {/* Resolution execution */}
                                {resolutionResults.length > 0 && (
                                  <section>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                      Resolution execution
                                    </h3>
                                    <div className="space-y-3">
                                      {resolutionResults.map((step, stepIndex) => {
                                        const stepResult = step.result || {};
                                        return (
                                          <div
                                            key={stepIndex}
                                            className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900"
                                          >
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                                              <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                  Step {stepIndex + 1}: {step.step}
                                                </p>
                                                {step.command && (
                                                  <p className="mt-1 text-xs font-mono bg-gray-900 text-gray-100 rounded px-2 py-1 overflow-x-auto">
                                                    {step.command}
                                                  </p>
                                                )}
                                              </div>
                                              <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                  stepResult.success
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                }`}
                                              >
                                                {stepResult.success ? 'Succeeded' : 'Failed'}
                                              </span>
                                            </div>

                                            {(stepResult.output || stepResult.error) && (
                                              <details className="mt-2 text-xs">
                                                <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                                                  View command output
                                                </summary>
                                                {stepResult.output && (
                                                  <pre className="mt-2 whitespace-pre-wrap font-mono bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto">
                                                    {stepResult.output}
                                                  </pre>
                                                )}
                                                {stepResult.error && (
                                                  <pre className="mt-2 whitespace-pre-wrap font-mono bg-red-900 text-red-100 rounded p-2 overflow-x-auto">
                                                    {stepResult.error}
                                                  </pre>
                                                )}
                                              </details>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </section>
                                )}

                                {/* Knowledge base context */}
                                {knowledgeBase && (
                                  <section>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                      Knowledge base context
                                    </h3>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <span className="font-semibold">Runbook used:</span>{' '}
                                      {knowledgeBase.has_knowledge ? 'Yes, based on internal SOPs/runbooks' : 'No specific runbook found'}
                                    </p>
                                    {knowledgeBase.has_knowledge && Array.isArray(knowledgeBase.matches) && knowledgeBase.matches.length > 0 && (
                                      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                                          Top matching documents
                                        </h4>
                                        <ul className="list-disc list-inside space-y-1">
                                          {knowledgeBase.matches.slice(0, 3).map((match, i) => (
                                            <li key={i}>
                                              {match.source || 'Unknown source'}{' '}
                                              {typeof match.score === 'number' && `· score ${(match.score * 100).toFixed(1)}%`}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {knowledgeBase.has_knowledge && knowledgeBase.combined_context && (
                                      <details className="mt-2 text-xs">
                                        <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                                          View full runbook context
                                        </summary>
                                        <pre className="mt-2 whitespace-pre-wrap font-mono bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto max-h-64">
                                          {knowledgeBase.combined_context}
                                        </pre>
                                      </details>
                                    )}
                                  </section>
                                )}

                                {/* Raw plan JSON for debugging/traceability */}
                                {rawPlan && (
                                  <section>
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                                        View original diagnostic plan JSON
                                      </summary>
                                      <pre className="mt-2 whitespace-pre-wrap font-mono bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto max-h-64">
                                        {typeof rawPlan === 'string' ? rawPlan : JSON.stringify(rawPlan, null, 2)}
                                      </pre>
                                    </details>
                                  </section>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">No results found for this incident</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}