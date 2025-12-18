'use client';
import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from '@clerk/nextjs';
import { Toaster, toast } from 'react-hot-toast';
import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { MdDashboard, MdSecurity } from 'react-icons/md';
import { BsChatFill } from 'react-icons/bs';
import { FaDatabase, FaBookOpen } from 'react-icons/fa';
import { FaSearch } from 'react-icons/fa';

export default function Chat() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("thinking");
  const [isWebSearch, setIsWebSearch] = useState(false);
  const [runAsync, setRunAsync] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const { getToken } = useAuth();
  const [token, setToken] = useState(null);

  const getClerkToken = async () => {
    const t = await getToken({ template: "auth_token" }); // Fetch token using a custom template
    setToken(t); // Store the token in state
  };

  // Fetch Clerk token
  useEffect(() => {
    if (!token) {
      getClerkToken().catch((err) => {
        console.error("Failed to get auth token", err);
      });
    }
  }, [token]);
 
  // Load chat history from localStorage on first mount so it persists between page navigations
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("chatHistory") : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatHistory(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load chat history from localStorage", err);
    }
  }, []);
 
  // Load server-side chat history when token is available
  useEffect(() => {
    const fetchHistory = async () => {
      if (!token) return;
      try {
        const res = await axios.get("http://localhost:8000/chat/history?limit=50&offset=0", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });
 
        const rows = res.data?.response?.data || [];
        // Supabase returns newest first; reverse for chronological display
        const normalized = rows
          .slice()
          .reverse()
          .map((row) => ({
            id: row.id,
            chat: row.message_content,
            response: row.response_text,
            createdAt: row.created_at,
            isAsync: row.is_async,
            status: row.is_async ? "completed" : "completed",
            jobId: row.job_id || null,
          }));
 
        setChatHistory((prev) => (prev.length > 0 ? prev : normalized));
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };
 
    fetchHistory();
  }, [token]);
 
  // Save chat history to localStorage whenever it changes (optional client-side cache)
  useEffect(() => {
    try {
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    } catch {
      // ignore storage errors
    }
  }, [chatHistory]);

  const handleSend = async () => {
    if (!message.trim()) return;

    // Store user message in chatHistory immediately
    setChatHistory((prev) => [
      ...prev,
      {
        id: undefined,
        chat: message,
        response: null, // Will be updated when we get the AI response
        isAsync: !isWebSearch && runAsync,
        status: !isWebSearch && runAsync ? "planning" : null,
        jobId: null,
      },
    ]);

    setLoading(true);
    setLoadingStage("thinking");

    try {
      if (isWebSearch) {
        // Call web search API
        const res = await axios.post(
          `http://localhost:8000/websearch?message=${encodeURIComponent(message)}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        // Update chat history with web search response
        setChatHistory((prev) => {
          const newHistory = [...prev];
          const lastIndex = newHistory.length - 1;
          const lastItem = newHistory[lastIndex];
          if (lastItem && lastItem.response === null) {
            newHistory[lastIndex] = {
              ...lastItem,
              response: res.data.response,
              isAsync: false,
              status: "completed",
            };
          }
          return newHistory;
        });

        toast.success("Web search completed!", {
          duration: 2000,
          position: "top-center",
          icon: "🔍",
        });
      } else {
        // Plan creation logic
        const res = await axios.post(
          "http://localhost:8000/plan",
          { content: message },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );
        const responsePlan = res.data?.response?.plan || [];
        setPlan(responsePlan);

        // Show the modal immediately after getting the plan
        const modal = document.getElementById("my_modal_1");
        if (modal) modal.showModal();

        toast.success("Plan created successfully! Please review and accept.", {
          duration: 3000,
          position: "top-center",
          icon: "📋",
        });
      }
    } catch (error) {
      console.error("Failed to process request:", error);
      toast.error("Failed to process your request. Please try again.", {
        duration: 4000,
        position: "top-center",
        icon: "❌",
      });
    } finally {
      setLoading(false);
      setMessage("");
      setIsWebSearch(false);
    }
  };

  const pollAsyncJob = (jobId) => {
    let attempts = 0;
    const maxAttempts = 60; // ~5 minutes at 5s interval

    const checkStatus = async () => {
      try {
        if (!token) return;
        const res = await axios.get(`http://localhost:8000/chat/async/${jobId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        const data = res.data;
        const status = data.status || "unknown";
        let responseText = null;

        if (status === "completed") {
          responseText = data.result?.successorfail || JSON.stringify(data.result);
        }

        setChatHistory((prev) =>
          prev.map((item) =>
            item.jobId === jobId || item.id === jobId
              ? {
                  ...item,
                  status,
                  response: responseText !== null ? responseText : item.response,
                }
              : item
          )
        );

        if (status === "completed") {
          toast.success("Async chat completed", {
            duration: 3000,
            position: "top-center",
          });
          return;
        }

        if (status === "error") {
          toast.error("Async chat failed", {
            duration: 4000,
            position: "top-center",
          });
          return;
        }

        if (status === "queued" || status === "processing") {
          attempts += 1;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 5000);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch async chat job ${jobId}:`, error);
        setChatHistory((prev) =>
          prev.map((item) =>
            item.jobId === jobId || item.id === jobId
              ? { ...item, status: "error" }
              : item
          )
        );
        toast.error("Error while polling async chat job", {
          duration: 4000,
          position: "top-center",
        });
      }
    };

    checkStatus();
  };

  const handlePlanSubmit = async () => {
    const lastUserMessage =
      chatHistory.length > 0
        ? chatHistory[chatHistory.length - 1].chat
        : message;

    try {
      setLoading(true);
      setLoadingStage("processing");

      toast.success(
        runAsync
          ? "Plan accepted! Queuing async automation..."
          : "Plan accepted! Processing your request...",
        {
          duration: 3000,
          position: "top-center",
          icon: runAsync ? "📨" : "🚀",
        }
      );

      const enhancedMessage =
        "user message: " + lastUserMessage + " plan: " + plan;

      if (runAsync) {
        const res = await axios.post(
          "http://localhost:8000/chat/async",
          {
            content: enhancedMessage,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        const jobId = res.data?.job_id;
        const initialStatus = res.data?.status || "queued";

        if (!jobId) {
          throw new Error("Backend did not return a job_id for async chat");
        }

        setChatHistory((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: jobId,
                chat: lastUserMessage,
                response: null,
                isAsync: true,
                status: initialStatus,
                jobId: jobId,
              },
            ];
          }
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          updated[lastIndex] = {
            ...updated[lastIndex],
            id: jobId,
            isAsync: true,
            status: initialStatus,
            jobId: jobId,
          };
          return updated;
        });

        pollAsyncJob(jobId);
      } else {
        const res = await axios.post(
          "http://localhost:8000/chat",
          {
            content: enhancedMessage,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        const responseMessage = res.data?.successorfail || "No response";
        console.log("Response from agent:", res);

        // Update the last chat history item with the response
        setChatHistory((prev) => {
          const newHistory = [...prev];
          const lastIndex = newHistory.length - 1;
          const lastItem = newHistory[lastIndex];
          if (lastItem) {
            newHistory[lastIndex] = {
              ...lastItem,
              response: responseMessage,
              status: "completed",
              isAsync: lastItem.isAsync ?? false,
            };
          } else {
            newHistory.push({
              id: undefined,
              chat: lastUserMessage,
              response: responseMessage,
              isAsync: false,
              status: "completed",
              jobId: null,
            });
          }
          return newHistory;
        });

        toast.success("Response received successfully!", {
          duration: 2000,
          position: "top-center",
          icon: "✅",
        });
      }

      // Close the modal
      const modal = document.getElementById("my_modal_1");
      if (modal) modal.close();

      // Clear the plan
      setPlan([]);
    } catch (error) {
      console.error("Failed to send chat message:", error);
      toast.error("Failed to process your request. Please try again.", {
        duration: 4000,
        position: "top-center",
        icon: "❌",
      });
    } finally {
      setLoading(false);
      setLoadingStage("thinking");
    }
  };

  // Loading states component
  const LoadingIndicator = () => {
    const [dots, setDots] = useState("");

    // Animation for the dots
    useEffect(() => {
      const interval = setInterval(() => {
        setDots((prev) => {
          if (prev.length >= 3) return "";
          return prev + ".";
        });
      }, 500);

      return () => clearInterval(interval);
    }, []);

    const thinkingMessages = [
      "Analyzing your request",
      "Considering options",
      "Formulating a plan",
      "Thinking",
    ];

    const processingMessages = [
      "Processing your request",
      "Working on it",
      "Executing plan",
      "Generating response",
    ];

    const messages = loadingStage === "thinking" ? thinkingMessages : processingMessages;
    const [currentMessage, setCurrentMessage] = useState(messages[0]);

    // Cycle through messages
    useEffect(() => {
      const interval = setInterval(() => {
        setCurrentMessage((prev) => {
          const currentIndex = messages.indexOf(prev);
          const nextIndex = (currentIndex + 1) % messages.length;
          return messages[nextIndex];
        });
      }, 2000);

      return () => clearInterval(interval);
    }, [messages]);

    return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2 justify-end">
          <span className="text-sm text-gray-500 dark:text-gray-400">AI Assistant</span>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-sm font-medium text-white">AI</span>
          </div>
        </div>
        <div className="mr-10 flex justify-end">
          <div className="flex items-center space-x-2 bg-blue-100 dark:bg-blue-900 rounded-xl p-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <div className="loading loading-spinner loading-sm text-white"></div>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {currentMessage}
                <span className="inline-block w-8">{dots}</span>
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400">
                {loadingStage === "thinking" ? "Creating plan" : "Executing plan"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ClerkProvider>
      <SignedIn>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Toaster />
          {/* Navigation Bar */}
          <nav className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-8">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Infra.ai Dashboard</h1>
                  <div className="hidden md:flex space-x-4">
                    <Link
                      href="/dashboard"
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
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
                      className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
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
                <div className="flex items-center">
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
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col h-[600px]">
                  {/* Tabs: Chat vs History */}
                  <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="inline-flex rounded-md shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setActiveTab("chat")}
                        className={`px-4 py-2 text-sm font-medium focus:outline-none ${
                          activeTab === "chat"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("history")}
                        className={`px-4 py-2 text-sm font-medium focus:outline-none ${
                          activeTab === "history"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        History
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {activeTab === "chat" ? (
                      <>
                        {chatHistory.map((item, index) => (
                          <div key={index} className="space-y-4">
                            {/* User Message */}
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">You</span>
                                </div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">User</span>
                              </div>
                              <div className="ml-10">
                                <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 max-w-[80%] break-words">
                                  {item.chat}
                                </div>
                              </div>
                            </div>

                            {/* Async status badge (for jobs that are still running or queued) */}
                            {item.isAsync && (
                              <div className="ml-10 mt-1">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    item.status === "queued"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                      : item.status === "processing" || item.status === "planning"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                      : item.status === "completed"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : item.status === "error"
                                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                  }`}
                                >
                                  {item.status === "queued" && "Queued (async)"}
                                  {item.status === "planning" && "Planning (async)"}
                                  {item.status === "processing" && "Processing (async)"}
                                  {item.status === "completed" && "Completed (async)"}
                                  {item.status === "error" && "Error (async)"}
                                  {!item.status && "Async"}
                                </span>
                              </div>
                            )}

                            {/* AI Response - Only show if there is a response */}
                            {item.response && (
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2 justify-end">
                                  <span className="text-sm text-gray-500 dark:text-gray-400">AI Assistant</span>
                                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-sm font-medium text-white">AI</span>
                                  </div>
                                </div>
                                <div className="mr-10 flex justify-end">
                                  <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%] break-words">
                                    <div className="prose prose-invert max-w-none">
                                      {item.response.split("\n").map((line, i) => {
                                        // Check if line is a heading
                                        if (line.startsWith("# ")) {
                                          return (
                                            <h1 key={i} className="text-xl font-bold mb-2">
                                              {line.substring(2)}
                                            </h1>
                                          );
                                        }
                                        if (line.startsWith("## ")) {
                                          return (
                                            <h2 key={i} className="text-lg font-bold mb-2">
                                              {line.substring(3)}
                                            </h2>
                                          );
                                        }
                                        if (line.startsWith("### ")) {
                                          return (
                                            <h3 key={i} className="text-base font-bold mb-2">
                                              {line.substring(4)}
                                            </h3>
                                          );
                                        }
                                        // Check if line is a list item
                                        if (line.startsWith("- ")) {
                                          return (
                                            <li key={i} className="ml-4">
                                              {line.substring(2)}
                                            </li>
                                          );
                                        }
                                        if (line.startsWith("* ")) {
                                          return (
                                            <li key={i} className="ml-4">
                                              {line.substring(2)}
                                            </li>
                                          );
                                        }
                                        // Check if line is a code block
                                        if (line.startsWith("```") && line.length > 3) {
                                          return (
                                            <pre
                                              key={i}
                                              className="bg-blue-700 p-2 rounded my-2 overflow-x-auto"
                                            >
                                              {line.substring(3)}
                                            </pre>
                                          );
                                        }
                                        // Regular paragraph
                                        return (
                                          <p key={i} className="mb-2">
                                            {line}
                                          </p>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {loading && <LoadingIndicator />}
                      </>
                    ) : (
                      <div className="space-y-3">
                        {chatHistory.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No chat history yet.
                          </p>
                        ) : (
                          chatHistory
                            .slice()
                            .reverse()
                            .map((item, index) => (
                              <details
                                key={index}
                                className="group border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900"
                              >
                                <summary className="flex items-center justify-between cursor-pointer">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {item.chat || "No message text"}
                                    </p>
                                    {item.createdAt && (
                                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(item.createdAt).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                  <div className="ml-4">
                                    {item.isAsync ? (
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          item.status === "queued"
                                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                            : item.status === "processing" || item.status === "planning"
                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                            : item.status === "completed"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                            : item.status === "error"
                                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                        }`}
                                      >
                                        {item.status === "queued" && "Queued (async)"}
                                        {item.status === "planning" && "Planning (async)"}
                                        {item.status === "processing" && "Processing (async)"}
                                        {item.status === "completed" && "Completed (async)"}
                                        {item.status === "error" && "Error (async)"}
                                        {!item.status && "Async"}
                                      </span>
                                    ) : (
                                      item.status && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                          Status: {item.status}
                                        </span>
                                      )
                                    )}
                                  </div>
                                </summary>
                                <div className="mt-3 space-y-2">
                                  {item.response ? (
                                    <div className="bg-blue-600 text-white rounded-lg px-3 py-2">
                                      <div className="prose prose-invert max-w-none text-sm">
                                        {item.response.split("\n").map((line, i) => {
                                          if (line.startsWith("# ")) {
                                            return (
                                              <h1 key={i} className="text-xl font-bold mb-2">
                                                {line.substring(2)}
                                              </h1>
                                            );
                                          }
                                          if (line.startsWith("## ")) {
                                            return (
                                              <h2 key={i} className="text-lg font-bold mb-2">
                                                {line.substring(3)}
                                              </h2>
                                            );
                                          }
                                          if (line.startsWith("### ")) {
                                            return (
                                              <h3 key={i} className="text-base font-bold mb-2">
                                                {line.substring(4)}
                                              </h3>
                                            );
                                          }
                                          if (line.startsWith("- ")) {
                                            return (
                                              <li key={i} className="ml-4">
                                                {line.substring(2)}
                                              </li>
                                            );
                                          }
                                          if (line.startsWith("* ")) {
                                            return (
                                              <li key={i} className="ml-4">
                                                {line.substring(2)}
                                              </li>
                                            );
                                          }
                                          if (line.startsWith("```") && line.length > 3) {
                                            return (
                                              <pre
                                                key={i}
                                                className="bg-blue-700 p-2 rounded my-2 overflow-x-auto"
                                              >
                                                {line.substring(3)}
                                              </pre>
                                            );
                                          }
                                          return (
                                            <p key={i} className="mb-2">
                                              {line}
                                            </p>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      No response yet. Current status:{" "}
                                      {item.status || (item.isAsync ? "queued" : "unknown")}
                                    </p>
                                  )}
                                </div>
                              </details>
                            ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setIsWebSearch(!isWebSearch)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors duration-200 ${
                          isWebSearch
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                        }`}
                      >
                        <FaSearch className="w-4 h-4" />
                        Web Search
                      </button>
                      <button
                        onClick={() => setRunAsync(!runAsync)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors duration-200 ${
                          runAsync
                            ? "bg-purple-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            runAsync
                              ? "bg-green-300"
                              : "bg-gray-400 dark:bg-gray-500"
                          }`}
                        />
                        Async automation
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={
                          isWebSearch
                            ? "Search the web..."
                            : runAsync
                            ? "Describe the automation you want to run..."
                            : "Type your message..."
                        }
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !loading) handleSend();
                        }}
                        disabled={loading}
                      />
                      <button
                        onClick={handleSend}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Sending...</span>
                          </div>
                        ) : isWebSearch ? (
                          "Search"
                        ) : (
                          "Send"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Plan Modal */}
          <dialog id="my_modal_1" className="modal">
            <div className="modal-box bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Action Plan</h3>
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Your Request:
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {chatHistory.length > 0
                      ? chatHistory[chatHistory.length - 1].chat
                      : ""}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Proposed Plan:
                  </h4>
                  <ul className="list-disc list-inside space-y-2">
                    {plan.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-700 dark:text-gray-300"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <form method="dialog" className="flex gap-2">
                  <button
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
                    onClick={() => setPlan([])}
                  >
                    Close
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                    onClick={handlePlanSubmit}
                    type="button"
                  >
                    Accept
                  </button>
                </form>
              </div>
            </div>
          </dialog>
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}
