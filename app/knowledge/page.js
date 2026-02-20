'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { ClerkProvider, SignedIn, UserButton, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Toaster, toast } from 'react-hot-toast';
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function KnowledgeBasePage() {
  const { getToken } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState('docs');
  const [archFile, setArchFile] = useState(null);
  const [archUploading, setArchUploading] = useState(false);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const token = await getToken({ template: 'auth_token' });
      if (!token) {
        toast.error('Authentication token missing');
        setLoading(false);
        return;
      }

      const { data } = await axios.get(`${API_BASE_URL}/knowledge/docs`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      const rows = data?.response?.data || [];
      setDocs(rows);
    } catch (error) {
      console.error('Error fetching knowledge base documents:', error);
      toast.error(error?.response?.data?.detail || 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      const token = await getToken({ template: 'auth_token' });
      if (!token) {
        toast.error('Authentication token missing');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);

      await axios.post(`${API_BASE_URL}/addKnowledge`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Knowledge document ingested successfully');
      setSelectedFile(null);
      // Reset file input element
      const input = document.getElementById('kb-file-input');
      if (input) {
        input.value = '';
      }
      await fetchDocs();
    } catch (error) {
      console.error('Error uploading knowledge document:', error);
      toast.error(error?.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleArchFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setArchFile(file);
  };

  const handleArchitectureUpload = async () => {
    if (!archFile) {
      toast.error('Please select an architecture document to upload');
      return;
    }

    try {
      setArchUploading(true);
      const token = await getToken({ template: 'auth_token' });
      if (!token) {
        toast.error('Authentication token missing');
        setArchUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', archFile);

      await axios.post(`${API_BASE_URL}/knowledge/architecture`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Architecture knowledge updated successfully');
      setArchFile(null);
      const input = document.getElementById('kb-arch-file-input');
      if (input) {
        input.value = '';
      }
    } catch (error) {
      console.error('Error uploading architecture knowledge document:', error);
      toast.error(error?.response?.data?.detail || 'Failed to upload architecture document');
    } finally {
      setArchUploading(false);
    }
  };

  const confirmDelete = (docId) => {
    setConfirmDeleteId(docId);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;

    const docId = confirmDeleteId;
    try {
      setDeletingId(docId);
      const token = await getToken({ template: 'auth_token' });
      if (!token) {
        toast.error('Authentication token missing');
        setDeletingId(null);
        return;
      }

      await axios.delete(`${API_BASE_URL}/knowledge/${encodeURIComponent(docId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      toast.success('Knowledge document deleted');
      setDocs((prev) => prev.filter((d) => d.doc_id !== docId));
    } catch (error) {
      console.error('Error deleting knowledge document:', error);
      toast.error(error?.response?.data?.detail || 'Failed to delete document');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

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
              <Toaster position="top-center" />

              <div className="md:hidden flex items-center justify-between mb-6">
                <Link href="/dashboard">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Infra.ai</h1>
                </Link>
                <div className="flex gap-2 items-center">
                  <ModeToggle />
                  <UserButton />
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Knowledge Base</h2>
                  <p className="mt-1 text-muted-foreground">
                    Upload SOPs and knowledge documents, review what is currently indexed, and remove
                    documents when they are outdated.
                  </p>
                </div>
              </div>

              {/* Tabs: Documents vs Architecture */}
              <div className="mb-6 border-b">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('docs')}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'docs'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                  >
                    Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('architecture')}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'architecture'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                  >
                    Architecture
                  </button>
                </nav>
              </div>

              {activeTab === 'docs' ? (
                <>
                  {/* Upload card - documents */}
                  <Card className="mb-8">
                    <CardHeader>
                      <CardTitle>Add knowledge document</CardTitle>
                      <CardDescription>
                        Supported formats: PDF, plain text, and markdown. The document will be split into
                        chunks, embedded via OpenRouter, and stored in the Pinecone index used by the
                        assistant.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Input
                          id="kb-file-input"
                          type="file"
                          accept=".pdf,.txt,.md,.markdown,.doc,.docx,.log,.json,.yaml,.yml"
                          onChange={handleFileChange}
                          className="max-w-md bg-background"
                        />
                        <Button
                          onClick={handleUpload}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                              Uploading...
                            </>
                          ) : (
                            'Upload & index'
                          )}
                        </Button>
                      </div>
                      {selectedFile && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Selected: <span className="font-medium">{selectedFile.name}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Documents table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Indexed documents</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="flex justify-center items-center py-8">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : docs.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          No knowledge documents found yet. Upload a document above to get started.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  File name
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Document ID
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Chunks
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Index
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Created at
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                              {docs.map((doc) => (
                                <tr key={doc.id || doc.doc_id} className="hover:bg-muted/50">
                                  <td className="px-4 py-3 text-sm font-medium">
                                    {doc.source_file_name || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                                    <span title={doc.doc_id}>{doc.doc_id?.substring(0, 8)}...</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {doc.chunks_indexed ?? '—'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {doc.index_name || 'infraai'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {formatDate(doc.created_at)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => confirmDelete(doc.doc_id)}
                                      disabled={deletingId === doc.doc_id}
                                    >
                                      {deletingId === doc.doc_id ? 'Deleting...' : 'Delete'}
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  {/* Architecture upload card */}
                  <Card className="mb-8">
                    <CardHeader>
                      <CardTitle>Upload architecture document</CardTitle>
                      <CardDescription>
                        Upload a Markdown, text, or PDF document that describes your overall infrastructure
                        architecture. It will be indexed into Pinecone and used as global context for the
                        assistant.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Input
                          id="kb-arch-file-input"
                          type="file"
                          accept=".md,.markdown,.txt,.pdf"
                          onChange={handleArchFileChange}
                          className="max-w-md bg-background"
                        />
                        <Button
                          onClick={handleArchitectureUpload}
                          disabled={archUploading}
                        >
                          {archUploading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                              Uploading...
                            </>
                          ) : (
                            'Upload architecture'
                          )}
                        </Button>
                      </div>
                      {archFile && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Selected: <span className="font-medium">{archFile.name}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </main>

          {/* Delete confirmation modal */}
          {confirmDeleteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <Card className="max-w-md w-full">
                <CardHeader>
                  <CardTitle>Delete knowledge document</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Are you sure you want to delete this knowledge document? This will remove all of its
                    chunks from the Pinecone index and cannot be undone.
                  </p>
                  <p className="text-xs text-muted-foreground mb-4 break-all">
                    Document ID: <span className="font-mono">{confirmDeleteId}</span>
                  </p>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}
