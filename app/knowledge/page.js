'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { ClerkProvider, SignedIn, UserButton, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { MdDashboard, MdSecurity } from 'react-icons/md';
import { BsChatFill } from 'react-icons/bs';
import { FaDatabase, FaBookOpen } from 'react-icons/fa';
import { Toaster, toast } from 'react-hot-toast';

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Toaster position="top-center" />

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
                      className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
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
                        userButtonAvatarBox: 'w-10 h-10 rounded-full',
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Upload SOPs and knowledge documents, review what is currently indexed, and remove
                    documents when they are outdated.
                  </p>
                </div>
              </div>

              {/* Upload card */}
              <div className="mb-8 grid grid-cols-1 gap-6">
                <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Add knowledge document</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Supported formats: PDF, plain text, and markdown. The document will be split into
                    chunks, embedded via OpenRouter, and stored in the Pinecone index used by the
                    assistant.
                  </p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <input
                      id="kb-file-input"
                      type="file"
                      accept=".pdf,.txt,.md,.markdown,.doc,.docx,.log,.json,.yaml,.yml"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-900 dark:text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={uploading}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Uploading...
                        </>
                      ) : (
                        'Upload & index'
                      )}
                    </button>
                  </div>
                  {selectedFile && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Selected: <span className="font-medium">{selectedFile.name}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Documents table */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Indexed documents</h2>

                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : docs.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                    No knowledge documents found yet. Upload a document above to get started.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            File name
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Document ID
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Chunks
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Index
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Created at
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {docs.map((doc) => (
                          <tr key={doc.id || doc.doc_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                              {doc.source_file_name || '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono">
                              <span title={doc.doc_id}>{doc.doc_id}</span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                              {doc.chunks_indexed ?? '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                              {doc.index_name || 'infraai'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                              {formatDate(doc.created_at)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              <button
                                type="button"
                                onClick={() => confirmDelete(doc.doc_id)}
                                disabled={deletingId === doc.doc_id}
                                className="inline-flex items-center px-3 py-1.5 border border-red-600 text-xs font-medium rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingId === doc.doc_id ? 'Deleting...' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Delete confirmation modal */}
          {confirmDeleteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Delete knowledge document
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Are you sure you want to delete this knowledge document? This will remove all of its
                  chunks from the Pinecone index and cannot be undone.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 break-all">
                  Document ID: <span className="font-mono">{confirmDeleteId}</span>
                </p>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-md text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-md text-sm bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleDelete}
                  >
                    Delete
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
