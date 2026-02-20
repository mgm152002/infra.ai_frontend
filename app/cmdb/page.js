'use client';
import { useState, useEffect } from 'react';
import { useAuth, ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { Search, Plus, Trash2, Edit, LayoutGrid, List, RefreshCw, Database, Upload, Server, Folder } from 'lucide-react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const CMDB = () => {
  // Helper function to truncate text
  const truncateText = (text, maxLength = 30) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const [cmdbItems, setCmdbItems] = useState([]);
  const [services, setServices] = useState([]);
  const [groupedItems, setGroupedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table', 'grid', 'by-service'
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { getToken } = useAuth();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();
  // We need to manually register select since Shadcn Select is a controlled component wrapper
  // But for simplicity with react-hook-form + Shadcn Select, we can use a hidden input or Controller.
  // Given the complexity of wrapping everything in Controller now, I might use standard select with Shadcn styling or just try to adapt.
  // Actually, Shadcn Select is quite different. I'll stick to a native select styled with Tailwind class for now to avoid complex Controller setup, OR use the native HTML select with Shadcn styling if possible.
  // The Shadcn `Input` component renders an `input` tag.
  // I will use a native select with shadcn-like styling for simplicity, or just use the registered native select.

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const fetchServices = async () => {
    try {
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.get(`${API_BASE_URL}/services`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setServices(data.response.data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchCMDBItems = async () => {
    try {
      setLoading(true);
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.get(`${API_BASE_URL}/cmdb`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      // Sort items: manual first, then servicenow, or by date. 
      // Let's sort by created_at desc if available, or just keep as is.
      setCmdbItems(data.response.data || []);
    } catch (error) {
      console.error('Error fetching CMDB items:', error);
      toast.error('Failed to load CMDB items');
    } finally {
      setLoading(false);
    }
  };

  const fetchCMDBByService = async () => {
    try {
      setLoading(true);
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.get(`${API_BASE_URL}/cmdb/by-service`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setGroupedItems(data.response || []);
    } catch (error) {
      console.error('Error fetching CMDB by service:', error);
      toast.error('Failed to load CMDB by service');
    } finally {
      setLoading(false);
    }
  };

  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null); // 'pending', 'running', 'completed', 'failed'

  const pollJobStatus = async (jobId) => {
    const token = await getToken({ template: "auth_token" });
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/jobs/${jobId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        setSyncProgress(data.progress);
        setSyncStatus(data.status);

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          setSyncing(false);
          if (data.status === 'completed') {
            toast.success(`Sync completed! New: ${data.details.new}, Updated: ${data.details.updated}`);
            fetchCMDBItems();
          } else {
            toast.error(`Sync failed: ${data.details.error}`);
          }
          setTimeout(() => setSyncStatus(null), 3000); // Clear status after delay
        }
      } catch (error) {
        console.error("Error polling job:", error);
        clearInterval(interval);
        setSyncing(false);
        toast.error("Failed to track sync progress");
      }
    }, 2000); // Poll every 2 seconds
  };

  const syncWithServiceNow = async () => {
    try {
      setSyncing(true);
      setSyncProgress(0);
      setSyncStatus('pending');

      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.post(`${API_BASE_URL}/integrations/servicenow/sync-cmdb`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (data.status === 'success' && data.job_id) {
        toast.success("Sync started in background");
        pollJobStatus(data.job_id);
      } else {
        setSyncing(false);
        toast.error('Sync failed to start');
      }
    } catch (error) {
      console.error('Error syncing with ServiceNow:', error);
      setSyncing(false);
      toast.error(error.response?.data?.detail || 'Failed to sync with ServiceNow');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.post(`${API_BASE_URL}/uploadCMDB`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (data.status === 'success') {
        toast.success(`Imported: ${data.stats.added} items. Errors: ${data.stats.failed}`);
        fetchCMDBItems();
      } else {
        toast.error(data.message || 'Import failed');
      }

    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload CSV');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const searchCMDBItems = async () => {
    if (!searchQuery.trim()) {
      fetchCMDBItems();
      return;
    }

    try {
      setLoading(true);
      const token = await getToken({ template: "auth_token" });
      const { data } = await axios.get(`${API_BASE_URL}/cmdb/search/${searchQuery}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setCmdbItems(data.response.data || []);
    } catch (error) {
      console.error('Error searching CMDB items:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const createCMDBItem = async (formData) => {
    try {
      const token = await getToken({ template: "auth_token" });
      await axios.post(`${API_BASE_URL}/cmdb`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('CMDB item created successfully');
      setModalOpen(false);
      reset();
      fetchCMDBItems();
    } catch (error) {
      console.error('Error creating CMDB item:', error);
      toast.error(error.response?.data?.detail || 'Failed to create CMDB item');
    }
  };

  const updateCMDBItem = async (formData) => {
    try {
      const token = await getToken({ template: "auth_token" });
      await axios.put(`${API_BASE_URL}/cmdb/${editing}`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('CMDB item updated successfully');
      setModalOpen(false);
      setEditing(null);
      reset();
      fetchCMDBItems();
    } catch (error) {
      console.error('Error updating CMDB item:', error);
      toast.error(error.response?.data?.detail || 'Failed to update CMDB item');
    }
  };

  const deleteCMDBItem = async (tagId) => {
    try {
      const token = await getToken({ template: "auth_token" });
      await axios.delete(`${API_BASE_URL}/cmdb/${tagId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('CMDB item deleted successfully');
      setConfirmDelete(null);
      fetchCMDBItems();
    } catch (error) {
      console.error('Error deleting CMDB item:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete CMDB item');
    }
  };

  const onSubmit = (data) => {
    if (editing) {
      updateCMDBItem(data);
    } else {
      createCMDBItem(data);
    }
  };

  const editItem = (item) => {
    setEditing(item.tag_id);
    setValue('tag_id', item.tag_id);
    setValue('ip', item.ip);
    setValue('addr', item.addr);
    setValue('type', item.type);
    setValue('description', item.description);
    setValue('os', item.os);
    setValue('sys_id', item.sys_id || '');
    setValue('service_id', item.service_id || '');
    setValue('fqdn', item.fqdn || '');
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setEditing(null);
    reset({
      tag_id: '',
      ip: '',
      addr: '',
      type: '',
      description: '',
      os: '',
      sys_id: '',
      service_id: '',
      fqdn: ''
    });
    setModalOpen(true);
  };

  useEffect(() => {
    fetchServices();
    if (viewMode === 'by-service') {
      fetchCMDBByService();
    } else {
      fetchCMDBItems();
    }
  }, []);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery) {
        searchCMDBItems();
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Fetch data when view mode changes
  useEffect(() => {
    if (viewMode === 'by-service') {
      fetchCMDBByService();
    } else {
      fetchCMDBItems();
    }
  }, [viewMode]);

  return (
    <ClerkProvider>
      <SignedIn>
        <div className="h-full relative">
          <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-50 bg-gray-900">
            <Sidebar />
          </div>

          <div className="md:hidden z-50">
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
                  <h2 className="text-3xl font-bold tracking-tight">CMDB Management</h2>
                  <p className="mt-1 text-muted-foreground">
                    Manage your configuration items and assets.
                  </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      id="csv-upload"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('csv-upload').click()}
                      disabled={uploading}
                      className="flex-1 md:flex-none"
                    >
                      <Upload className={`w-4 h-4 mr-2 ${uploading ? 'animate-bounce' : ''}`} />
                      {uploading ? 'Importing...' : 'Import CSV'}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={syncWithServiceNow}
                    disabled={syncing}
                    className="flex-1 md:flex-none"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Import from ServiceNow'}
                  </Button>
                  <Button onClick={openCreateModal} className="flex-1 md:flex-none">
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Item
                  </Button>
                </div>
              </div>

              {/* Inline Sync Progress Bar */}
              {syncing && (
                <Card className="border-primary/50 bg-primary/5">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Syncing with ServiceNow...</span>
                          <span className="text-muted-foreground">{syncProgress}%</span>
                        </div>
                        <Progress value={syncProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          Status: {syncStatus === 'pending' ? 'Initializing...' : syncStatus === 'running' ? 'Fetching assets...' : syncStatus || 'Connecting...'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Search and View Options */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search CMDB items..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex bg-muted rounded-lg p-1">
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8"
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-4 w-4 mr-2" />
                    Table
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8"
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    Grid
                  </Button>
                  <Button
                    variant={viewMode === 'by-service' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8"
                    onClick={() => setViewMode('by-service')}
                  >
                    <Folder className="h-4 w-4 mr-2" />
                    By Service
                  </Button>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex justify-center items-center py-20">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {/* Table View */}
              {!loading && viewMode === 'table' && (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tag ID</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>FQDN</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>OS</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cmdbItems.length > 0 ? (
                          cmdbItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.tag_id}</TableCell>
                              <TableCell>{item.ip}</TableCell>
                              <TableCell className="max-w-[120px] truncate" title={item.fqdn || '-'}>{item.fqdn ? truncateText(item.fqdn, 15) : '-'}</TableCell>
                              <TableCell>
                                {item.service_id ? (
                                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0 max-w-[100px] truncate" title={services.find(s => s.id === item.service_id)?.name || item.service_id}>
                                    {truncateText(services.find(s => s.id === item.service_id)?.name || item.service_id, 15)}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{item.addr}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {item.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {item.source === 'servicenow' ? (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-0 flex w-fit items-center gap-1">
                                    <RefreshCw className="w-3 h-3" /> SNOW
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 border-0 flex w-fit items-center gap-1">
                                    <Database className="w-3 h-3" /> Manual
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{item.os}</TableCell>
                              <TableCell className="max-w-[200px] truncate" title={item.description}>{item.description}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => editItem(item)}>
                                    <Edit className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(item.tag_id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center h-24">
                              No CMDB items found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Grid View */}
              {!loading && viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cmdbItems.length > 0 ? (
                    cmdbItems.map((item) => (
                      <Card key={item.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="truncate max-w-[200px]">{truncateText(item.tag_id, 25)}</CardTitle>
                            <Badge variant="outline">
                              {item.type}
                            </Badge>
                          </div>
                          <div className="mt-2">
                            {item.source === 'servicenow' ? (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-0">
                                ServiceNow
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 border-0">
                                Manual
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">IP:</span> {item.ip}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">Location:</span> {item.addr}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">OS:</span> {item.os}
                            </p>
                            {item.fqdn && (
                              <p className="text-muted-foreground truncate" title={item.fqdn}>
                                <span className="font-medium text-foreground">FQDN:</span> {truncateText(item.fqdn, 25)}
                              </p>
                            )}
                            <p className="text-muted-foreground pt-2 truncate" title={item.description}>{truncateText(item.description, 50)}</p>
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => editItem(item)}>
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(item.tag_id)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-20 text-muted-foreground">No CMDB items found</div>
                  )}
                </div>
              )}

              {/* By Service View */}
              {!loading && viewMode === 'by-service' && (
                <div className="space-y-6">
                  {groupedItems.length > 0 ? (
                    groupedItems.map((group) => (
                      <Card key={group.service?.id || 'unassigned'}>
                        <CardHeader className="bg-muted/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {group.service?.id ? (
                                <Server className="h-5 w-5 text-primary" />
                              ) : (
                                <Folder className="h-5 w-5 text-muted-foreground" />
                              )}
                              <CardTitle className="truncate max-w-[300px]" title={group.service?.name || 'Unassigned'}>{truncateText(group.service?.name || 'Unassigned', 35)}</CardTitle>
                              <Badge variant="secondary">{group.host_count} hosts</Badge>
                            </div>
                            {group.service?.description && (
                              <p className="text-sm text-muted-foreground">{group.service.description}</p>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          {group.hosts && group.hosts.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tag ID</TableHead>
                                  <TableHead>IP Address</TableHead>
                                  <TableHead>FQDN</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>OS</TableHead>
                                  <TableHead>Location</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.hosts.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.tag_id}</TableCell>
                                    <TableCell>{item.ip}</TableCell>
                                    <TableCell className="max-w-[120px] truncate" title={item.fqdn || '-'}>{item.fqdn ? truncateText(item.fqdn, 15) : '-'}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{item.type}</Badge>
                                    </TableCell>
                                    <TableCell>{item.os}</TableCell>
                                    <TableCell>{item.addr}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => editItem(item)}>
                                          <Edit className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(item.tag_id)}>
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-muted-foreground text-center py-4">No hosts in this service</p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-20 text-muted-foreground">
                      No services found. Create services to organize your CMDB items.
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>

          {/* Create/Edit Modal */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[90vh] z-[100]">
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit CMDB Item' : 'Create New CMDB Item'}</DialogTitle>
                <DialogDescription>
                  Fill in the details for the configuration item.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="tag_id">Tag ID</Label>
                  <Input
                    id="tag_id"
                    placeholder="Enter tag ID"
                    {...register('tag_id', { required: 'Tag ID is required' })}
                  />
                  {errors.tag_id && <p className="text-xs text-red-500">{errors.tag_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sys_id">ServiceNow Sys ID (Optional)</Label>
                  <Input
                    id="sys_id"
                    placeholder="Enter ServiceNow Sys ID if applicable"
                    {...register('sys_id')}
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Use this to link manually created items to ServiceNow records.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ip">IP Address</Label>
                  <Input
                    id="ip"
                    placeholder="Enter IP address"
                    {...register('ip', {
                      required: 'IP address is required',
                      pattern: {
                        value: /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
                        message: 'Please enter a valid IPv4 address'
                      }
                    })}
                  />
                  {errors.ip && <p className="text-xs text-red-500">{errors.ip.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addr">Location</Label>
                  <Input
                    id="addr"
                    placeholder="Enter location"
                    {...register('addr', { required: 'Location is required' })}
                  />
                  {errors.addr && <p className="text-xs text-red-500">{errors.addr.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    {...register('type', { required: 'Type is required' })}
                  >
                    <option value="">Select a type</option>
                    <option value="server">Server</option>
                    <option value="router">Router</option>
                    <option value="switch">Switch</option>
                    <option value="firewall">Firewall</option>
                    <option value="workstation">Workstation</option>
                    <option value="storage">Storage</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="os">OS</Label>
                  <Input
                    id="os"
                    placeholder="Enter OS"
                    {...register('os', { required: 'OS is required' })}
                  />
                  {errors.os && <p className="text-xs text-red-500">{errors.os.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service_id">Service</Label>
                  <select
                    id="service_id"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    {...register('service_id')}
                  >
                    <option value="">Select a service (optional)</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.service_type || 'general'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[0.8rem] text-muted-foreground">
                    Assign this host to a service for better organization.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fqdn">FQDN (Fully Qualified Domain Name)</Label>
                  <Input
                    id="fqdn"
                    placeholder="e.g., web-server-01.example.com"
                    {...register('fqdn')}
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    The fully qualified domain name of this host.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter a description"
                    {...register('description', { required: 'Description is required' })}
                  />
                  {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Modal */}
          <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
            <DialogContent className="z-[100]">
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the CMDB item with Tag ID: <strong className="text-foreground">{confirmDelete}</strong>?
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => deleteCMDBItem(confirmDelete)}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>



        </div>
      </SignedIn>
    </ClerkProvider>
  );
};

export default CMDB;