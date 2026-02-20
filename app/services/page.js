'use client';
import { useState, useEffect } from 'react';
import { useAuth, ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { Plus, Trash2, Edit, Server, Search, Folder } from 'lucide-react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const Services = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { getToken } = useAuth();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const fetchServices = async () => {
    try {
      setLoading(true);
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
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const createService = async (formData) => {
    try {
      const token = await getToken({ template: "auth_token" });
      await axios.post(`${API_BASE_URL}/services`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('Service created successfully');
      setModalOpen(false);
      reset();
      fetchServices();
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error(error.response?.data?.detail || 'Failed to create service');
    }
  };

  const updateService = async (formData) => {
    try {
      const token = await getToken({ template: "auth_token" });
      await axios.put(`${API_BASE_URL}/services/${editing}`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('Service updated successfully');
      setModalOpen(false);
      setEditing(null);
      reset();
      fetchServices();
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error(error.response?.data?.detail || 'Failed to update service');
    }
  };

  const deleteService = async (serviceId) => {
    try {
      const token = await getToken({ template: "auth_token" });
      await axios.delete(`${API_BASE_URL}/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('Service deleted successfully');
      setConfirmDelete(null);
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete service');
    }
  };

  const onSubmit = (data) => {
    if (editing) {
      updateService(data);
    } else {
      createService(data);
    }
  };

  const editService = (service) => {
    setEditing(service.id);
    setValue('name', service.name);
    setValue('description', service.description || '');
    setValue('service_type', service.service_type || '');
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setEditing(null);
    reset({
      name: '',
      description: '',
      service_type: ''
    });
    setModalOpen(true);
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (service.description && service.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (service.service_type && service.service_type.toLowerCase().includes(searchQuery.toLowerCase()))
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
                  <h2 className="text-3xl font-bold tracking-tight">Service Management</h2>
                  <p className="mt-1 text-muted-foreground">
                    Manage services to organize your CMDB hosts.
                  </p>
                </div>
                <Button onClick={openCreateModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Service
                </Button>
              </div>

              {/* Search */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search services..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex justify-center items-center py-20">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {/* Services Table */}
              {!loading && (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredServices.length > 0 ? (
                          filteredServices.map((service) => (
                            <TableRow key={service.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Server className="h-4 w-4 text-primary" />
                                  {service.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                {service.service_type ? (
                                  <Badge variant="outline">
                                    {service.service_type}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{service.description || '-'}</TableCell>
                              <TableCell>
                                {service.created_at ? new Date(service.created_at).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => editService(service)}>
                                    <Edit className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(service.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                              {searchQuery ? 'No services found matching your search' : 'No services found. Create a service to organize your hosts.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>

          {/* Create/Edit Modal */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Service' : 'Create New Service'}</DialogTitle>
                <DialogDescription>
                  Define a service to organize your CMDB hosts.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Service Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Web Application, Database Cluster"
                    {...register('name', { required: 'Service name is required' })}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service_type">Service Type</Label>
                  <select
                    id="service_type"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    {...register('service_type')}
                  >
                    <option value="">Select a type</option>
                    <option value="web">Web Application</option>
                    <option value="api">API Service</option>
                    <option value="database">Database</option>
                    <option value="cache">Cache</option>
                    <option value="queue">Message Queue</option>
                    <option value="storage">Storage</option>
                    <option value="authentication">Authentication</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="logging">Logging</option>
                    <option value="networking">Networking</option>
                    <option value="security">Security</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this service does..."
                    {...register('description')}
                  />
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this service? 
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => deleteService(confirmDelete)}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SignedIn>
    </ClerkProvider>
  );
};

export default Services;
