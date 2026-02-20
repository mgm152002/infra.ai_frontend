'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from '@clerk/nextjs';
import { Toaster, toast } from 'react-hot-toast';
import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import { Bot, User, Loader2, Send, Zap, FileText, Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeft, ChevronRight, ChevronDown, Wrench, Database, AlertCircle, X } from 'lucide-react';
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Chat() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("thinking");
  const [isWebSearch, setIsWebSearch] = useState(false);
  const [runAsync, setRunAsync] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [streamedResponse, setStreamedResponse] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [currentToolCalls, setCurrentToolCalls] = useState([]);
  
  // Memory store for conversation context
  const [conversationContext, setConversationContext] = useState({
    lastToolOutputs: {},  // Store tool outputs by tool name
    lastQueryResults: {}, // Store query results for re-formatting
    lastDataType: null,   // Type of data returned (cmdb, incidents, etc.)
    lastRawData: null,   // Raw data that can be reformatted
  });

  const { getToken } = useAuth();
  const [token, setToken] = useState(null);
  const bottomRef = useRef(null);
  const abortControllerRef = useRef(null);

  const getClerkToken = async () => {
    try {
      const t = await getToken({ template: "auth_token" });
      setToken(t);
    } catch (err) {
      console.error("Failed to get auth token", err);
    }
  };

  useEffect(() => {
    if (!token) getClerkToken();
  }, [token]);

  // Fetch Sessions on Load
  useEffect(() => {
    const fetchSessions = async () => {
      if (!token) return;
      try {
        const res = await axios.get("http://localhost:8000/chat/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const fetchedSessions = res.data?.response || [];
        setSessions(fetchedSessions);

        // Load most recent session if available and none selected
        if (fetchedSessions.length > 0 && !currentSessionId) {
          setCurrentSessionId(fetchedSessions[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      }
    };
    fetchSessions();
  }, [token]);

  // Fetch History when Session Changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (!token || !currentSessionId) {
        if (!currentSessionId) setChatHistory([]);
        return;
      }

      try {
        const res = await axios.get(`http://localhost:8000/chat/history/${currentSessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const rows = res.data?.response?.data || [];
        const normalized = rows.map((row) => ({
          id: row.id,
          chat: row.message_content,
          response: row.response_text,
          createdAt: row.created_at,
          isAsync: row.is_async,
          status: row.is_async ? "completed" : "completed",
          jobId: row.job_id || null,
          toolCalls: row.raw_result?.tool_calls || [],
        }));

        setChatHistory(normalized);
      } catch (error) {
        console.error("Failed to load chat history:", error);
        toast.error("Failed to load chat history");
      }
    };

    fetchHistory();
  }, [currentSessionId, token]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading, streamedResponse]);

  const createNewSession = async () => {
    setCurrentSessionId(null);
    setChatHistory([]);
    setStreamedResponse("");
    if (!token) return;
    try {
      const res = await axios.post("http://localhost:8000/chat/sessions",
        { title: "New Chat" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newSession = res.data.response;
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
    } catch (e) {
      toast.error("Failed to create new chat");
    }
  };

  const confirmDeleteSession = (session) => {
    setSessionToDelete(session);
    setShowDeleteDialog(true);
  };

  const deleteSession = async () => {
    if (!sessionToDelete || !token) return;
    try {
      await axios.delete(`http://localhost:8000/chat/sessions/${sessionToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(sessions.filter(s => s.id !== sessionToDelete.id));
      if (currentSessionId === sessionToDelete.id) {
        setCurrentSessionId(sessions.length > 1 ? sessions.find(s => s.id !== sessionToDelete.id)?.id : null);
        setChatHistory([]);
      }
      toast.success("Chat deleted");
    } catch (e) {
      toast.error("Failed to delete chat");
    } finally {
      setShowDeleteDialog(false);
      setSessionToDelete(null);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;

    // Cancel any existing streaming request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create session if not exists
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      try {
        const res = await axios.post("http://localhost:8000/chat/sessions",
          { title: message.substring(0, 30) || "New Chat" },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const newSession = res.data.response;
        setSessions([newSession, ...sessions]);
        setCurrentSessionId(newSession.id);
        activeSessionId = newSession.id;
      } catch (e) {
        toast.error("Failed to create new chat session");
        return;
      }
    }

    const userMessage = message;
    const tempId = Date.now().toString();

    setChatHistory((prev) => [
      ...prev,
      {
        id: tempId,
        chat: userMessage,
        response: null,
        isAsync: !isWebSearch && runAsync,
        status: !isWebSearch && runAsync ? "planning" : "thinking",
        jobId: null,
        toolCalls: [],
      },
    ]);

    setLoading(true);
    setLoadingStage("thinking");
    setStreamedResponse("");
    setCurrentToolCalls([]);

    // Check if user is asking for re-formatting of previous data
    const isReformatRequest = /table|format|list|show.*(again|as)/i.test(userMessage);
    const shouldIncludeContext = isReformatRequest && conversationContext.lastRawData;

    try {
      if (isWebSearch) {
        const res = await axios.post(
          `http://localhost:8000/websearch?message=${encodeURIComponent(userMessage)}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setChatHistory((prev) => {
          const newHistory = [...prev];
          const lastIndex = newHistory.length - 1;
          newHistory[lastIndex] = { ...newHistory[lastIndex], response: res.data.response, status: "completed" };
          return newHistory;
        });
      } else {
        // Use streaming endpoint
        abortControllerRef.current = new AbortController();
        
        // Build context payload for re-formatting requests
        const contextPayload = shouldIncludeContext ? {
          previous_data: conversationContext.lastRawData,
          previous_data_type: conversationContext.lastDataType,
          format_request: userMessage,
        } : {};
        
        const response = await fetch("http://localhost:8000/chat/stream", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: userMessage,
            session_id: activeSessionId,
            ...contextPayload,
          }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error("Stream request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedResponse = "";
        let toolCalls = [];
        let currentMessageId = tempId;

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
                
                if (parsed.type === 'tool_call') {
                  toolCalls.push(parsed.tool);
                  setLoadingStage("using_tools");
                  setCurrentToolCalls(parsed.tool);
                  
                  // Update the last message with tool call - don't reset entire history
                  setChatHistory((prev) => {
                    const newHistory = [...prev];
                    const lastIndex = newHistory.length - 1;
                    if (lastIndex >= 0) {
                      newHistory[lastIndex] = { 
                        ...newHistory[lastIndex], 
                        toolCalls: [...(newHistory[lastIndex].toolCalls || []), parsed.tool],
                        status: "using_tools"
                      };
                    }
                    return newHistory;
                  });
                } else if (parsed.type === 'chunk') {
                  accumulatedResponse += parsed.content || "";
                  setStreamedResponse(accumulatedResponse);
                  
                  // Update chat history with streaming response
                  setChatHistory((prev) => {
                    const newHistory = [...prev];
                    const lastIndex = newHistory.length - 1;
                    if (lastIndex >= 0) {
                      newHistory[lastIndex] = { 
                        ...newHistory[lastIndex], 
                        response: accumulatedResponse,
                        status: "completed"
                      };
                    }
                    return newHistory;
                  });
                } else if (parsed.type === 'done') {
                  setLoading(false);
                  setCurrentToolCalls([]);
                  
                  // Update conversation context with tool outputs for future re-formatting requests
                  const lastHistoryIndex = chatHistory.length - 1;
                  const lastItem = chatHistory[lastHistoryIndex];
                  if (lastItem && lastItem.toolCalls) {
                    // Extract raw data from tool outputs for re-formatting
                    let rawData = null;
                    let dataType = null;
                    
                    for (const tool of lastItem.toolCalls) {
                      const toolName = tool.name || '';
                      const toolOutput = tool.output;
                      
                      // Detect data type and extract raw data
                      if (toolName.includes('cmdb') || toolName.includes('get_local_cmdb')) {
                        dataType = 'cmdb';
                        if (toolOutput && toolOutput.items) {
                          rawData = toolOutput.items;
                        } else if (toolOutput && toolOutput.status === 'ok') {
                          rawData = toolOutput;
                        }
                      } else if (toolName.includes('incident')) {
                        dataType = 'incidents';
                        if (toolOutput && toolOutput.incidents) {
                          rawData = toolOutput.incidents;
                        } else if (toolOutput && toolOutput.status === 'ok') {
                          rawData = toolOutput;
                        }
                      } else if (toolName.includes('knowledge')) {
                        dataType = 'knowledge';
                        if (toolOutput && toolOutput.matches) {
                          rawData = toolOutput.matches;
                        }
                      }
                      
                      // Update context if we found data
                      if (rawData) {
                        setConversationContext(prev => ({
                          ...prev,
                          lastToolOutputs: {
                            ...prev.lastToolOutputs,
                            [toolName]: toolOutput
                          },
                          lastDataType: dataType,
                          lastRawData: rawData,
                        }));
                      }
                    }
                  }
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }

        setLoading(false);

        // Update session title if it's the first message
        if (chatHistory.length === 0) {
          axios.put(`http://localhost:8000/chat/sessions/${activeSessionId}`,
            { title: userMessage.substring(0, 40) },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title: userMessage.substring(0, 40) } : s));
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Request cancelled");
      } else {
        console.error("Failed:", error);
        toast.error("Failed to send message");
      }
    } finally {
      setLoading(false);
      setMessage("");
      setCurrentToolCalls([]);
      abortControllerRef.current = null;
    }
  };

  const cancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setLoadingStage("thinking");
      setCurrentToolCalls([]);
    }
  };

  const ToolCallBadge = ({ tool }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const getIcon = (toolName) => {
      const name = toolName.toLowerCase();
      if (name.includes('cmdb') || name.includes('getfromcmdb')) return <Database className="h-3 w-3" />;
      if (name.includes('incident') || name.includes('create_incident') || name.includes('update_incident')) return <AlertCircle className="h-3 w-3" />;
      if (name.includes('infra') || name.includes('automation')) return <Wrench className="h-3 w-3" />;
      return <Bot className="h-3 w-3" />;
    };

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Badge variant="outline" className="cursor-pointer bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 border-purple-200 dark:border-purple-800">
            {getIcon(tool.name)}
            <span className="ml-1 text-xs">{tool.name}</span>
            {isOpen ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronRight className="h-3 w-3 ml-1" />}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 p-3 bg-muted/50 rounded-lg">
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
          {tool.output && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Result:</p>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap mt-1 text-green-600 dark:text-green-400">
                {typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)}
              </pre>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const MarkdownRenderer = ({ content }) => {
    if (!content) return null;
    
    // Helper function to parse and render markdown tables
    const renderTable = (lines, startIndex) => {
      // Find the table header and separator
      const tableLines = [];
      let i = startIndex;
      
      // Collect all table lines until we hit a non-table line
      while (i < lines.length) {
        const line = lines[i];
        // Table lines start with | or are part of table formatting
        if (line.trim().startsWith('|') || line.includes('|')) {
          tableLines.push(line);
          i++;
        } else if (line.trim() === '') {
          i++;
          continue;
        } else {
          break;
        }
      }
      
      if (tableLines.length < 2) return null;
      
      // Parse header
      const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
      
      // Skip separator line (index 1)
      // Parse data rows
      const rows = [];
      for (let j = 2; j < tableLines.length; j++) {
        const cells = tableLines[j].split('|').map(c => c.trim()).filter(c => c);
        if (cells.length > 0) {
          rows.push(cells);
        }
      }
      
      return { headers, rows, consumed: i - startIndex };
    };
    
    // Process content and extract tables
    const elements = [];
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      if (line.startsWith("# ")) {
        elements.push(<h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.substring(2)}</h1>);
      } else if (line.startsWith("## ")) {
        elements.push(<h2 key={i} className="text-lg font-semibold mt-3 mb-1">{line.substring(3)}</h2>);
      } else if (line.startsWith("### ")) {
        elements.push(<h3 key={i} className="text-base font-semibold mt-2 mb-1">{line.substring(4)}</h3>);
      } else if (line.startsWith("- ")) {
        elements.push(<li key={i} className="ml-4 list-disc">{line.substring(2)}</li>);
      } else if (line.startsWith("```")) {
        const code = line.substring(3);
        if (!code) {
          elements.push(null);
        } else {
          elements.push(<div key={i} className="bg-slate-950 p-3 rounded-md my-2 overflow-x-auto border border-slate-800"><code className="text-xs font-mono text-slate-50">{code}</code></div>);
        }
      } else if (line.match(/^\d+\.\s/)) {
        elements.push(<li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>);
      } else if (line.includes('|') && line.trim().startsWith('|')) {
        // This is a table - parse it
        const tableResult = renderTable(lines, i);
        if (tableResult) {
          elements.push(
            <div key={i} className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-border border border-border rounded-lg overflow-hidden">
                <thead className="bg-muted">
                  <tr>
                    {tableResult.headers.map((header, hi) => (
                      <th key={hi} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {tableResult.rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-2 text-sm text-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          i += tableResult.consumed;
        } else {
          elements.push(<p key={i} className="leading-relaxed">{line || <br />}</p>);
        }
      } else {
        elements.push(<p key={i} className="leading-relaxed">{line || <br />}</p>);
      }
      i++;
    }
    
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-2 text-foreground">
        {elements}
      </div>
    );
  };

  const LoadingIndicator = () => (
    <div className="flex justify-start w-full my-4">
      <div className="bg-muted/50 p-4 rounded-2xl rounded-tl-none space-y-2 animate-in fade-in slide-in-from-left-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingStage === "thinking" ? "Thinking..." : "Using tools..."}
        </div>
        {loadingStage === "using_tools" && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {currentToolCalls && currentToolCalls.name && (
          <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
            <Database className="h-3 w-3" />
            <span>Running: {currentToolCalls.name}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ClerkProvider>
      <SignedIn>
        <div className="h-screen w-full flex bg-background overflow-hidden relative">
          <Toaster position="top-center" />

          {/* Main Sidebar (Navigation) */}
          <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-50">
            <Sidebar />
          </div>

          {/* Chat Interface Container */}
          <main className="flex-1 flex md:pl-64 h-full">

            {/* Chat History Sidebar */}
            <div className={`${isSidebarOpen ? 'w-72' : 'w-0'} bg-gradient-to-b from-card to-muted/20 border-r transition-all duration-300 flex flex-col relative overflow-hidden`}>
              <div className="p-4 border-b flex items-center justify-between bg-card/50 backdrop-blur shrink-0">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chats
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="md:hidden">
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-3">
                <Button onClick={createNewSession} className="w-full justify-start gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90" variant="default">
                  <Plus className="h-4 w-4" /> New Chat
                </Button>
              </div>

              <ScrollArea className="flex-1 px-3 pb-3">
                <div className="space-y-1">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                        currentSessionId === session.id 
                          ? "bg-primary/10 border border-primary/20" 
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                      onClick={() => setCurrentSessionId(session.id)}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-medium truncate max-w-[180px]" title={session.title || "New Chat"}>{session.title || "New Chat"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.updated_at ? new Date(session.updated_at).toLocaleDateString() : 'Just now'}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteSession(session);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No chats yet</p>
                      <p className="text-xs">Start a new conversation</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full relative min-w-0">

              {/* Header */}
              <div className="h-14 border-b flex items-center px-4 justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
                <div className="flex items-center gap-2">
                  {!isSidebarOpen && (
                    <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="mr-2">
                      <PanelLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-sm">
                      {sessions.find(s => s.id === currentSessionId)?.title || "Assistant"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ModeToggle />
                  <UserButton />
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth bg-gradient-to-b from-background to-muted/5">
                <div className="max-w-3xl mx-auto space-y-6 pb-4">
                  {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                      <div className="bg-gradient-to-br from-primary/20 to-purple-500/20 p-5 rounded-full">
                        <Bot className="h-12 w-12 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        How can I help you today?
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        I can help you manage incidents, query CMDB data, run infrastructure automation, and more.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
                        <Button variant="outline" className="justify-start h-auto py-3 hover:bg-primary/5" onClick={() => setMessage("Show open incidents")}>
                          <FileText className="h-4 w-4 mr-2" /> Show open incidents
                        </Button>
                        <Button variant="outline" className="justify-start h-auto py-3 hover:bg-primary/5" onClick={() => setMessage("Check database servers in CMDB")}>
                          <Database className="h-4 w-4 mr-2" /> Query CMDB
                        </Button>
                        <Button variant="outline" className="justify-start h-auto py-3 hover:bg-primary/5" onClick={() => setMessage("Show system health status")}>
                          <Zap className="h-4 w-4 mr-2" /> System health
                        </Button>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((item, index) => (
                      <div key={item.id || index} className="space-y-4">
                        {/* User */}
                        <div className="flex justify-end">
                          <div className="flex gap-3 max-w-[85%]">
                            <div className="bg-gradient-to-r from-primary to-purple-600 text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-none shadow-sm">
                              <p className="text-sm">{item.chat}</p>
                            </div>
                            <div className="hidden sm:flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted border">
                              <User className="h-4 w-4" />
                            </div>
                          </div>
                        </div>

                        {/* Tool Calls */}
                        {item.toolCalls && item.toolCalls.length > 0 && (
                          <div className="flex justify-start ml-11">
                            <div className="flex flex-wrap gap-2">
                              {item.toolCalls.map((tool, ti) => (
                                <ToolCallBadge key={ti} tool={tool} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Assistant */}
                        {(item.response || item.isAsync) && (
                          <div className="flex justify-start">
                            <div className="flex gap-3 max-w-[85%]">
                              <div className="hidden sm:flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20">
                                <Bot className="h-4 w-4 text-primary" />
                              </div>
                              <div className="space-y-2">
                                <div className="bg-muted/50 px-4 py-3 rounded-2xl rounded-tl-none border shadow-sm">
                                  {item.response ? (
                                    <MarkdownRenderer content={item.response} />
                                  ) : (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                                      <Zap className="h-3 w-3" />
                                      {item.status || "Processing..."}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {loading && <LoadingIndicator />}
                  <div ref={bottomRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
                <div className="max-w-3xl mx-auto relative">
                  <div className="absolute left-2 top-2.5 flex items-center gap-1">
                    <Button
                      variant={runAsync ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRunAsync(!runAsync)}
                      title="Toggle Async Mode"
                    >
                      <Zap className={`h-4 w-4 ${runAsync ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                    </Button>
                  </div>
                  <Input
                    placeholder={runAsync ? "Describe long-running task..." : "Message Infra Assistant..."}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
                    disabled={loading}
                    className="pl-12 pr-12 py-6 rounded-full shadow-sm border-muted-foreground/20 focus-visible:ring-offset-2"
                  />
                  <div className="absolute right-2 top-1.5 flex items-center gap-1">
                    {loading ? (
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={cancelStream}
                        className="h-8 w-8 rounded-full"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSend}
                        size="icon"
                        disabled={loading || !message.trim()}
                        className="h-8 w-8 rounded-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-center mt-2">
                  <p className="text-[10px] text-muted-foreground">
                    Infra AI can make mistakes. Consider checking important information.
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Chat</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this chat? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={deleteSession}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SignedIn>
    </ClerkProvider>
  );
}
