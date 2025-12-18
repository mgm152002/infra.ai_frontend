// pages/cmdb.js or pages/cmdb/index.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth, ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import axios from 'axios';
import Head from 'next/head';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { IoIosSearch } from "react-icons/io";
import Link from 'next/link';
import { MdDashboard, MdSecurity } from 'react-icons/md';
import { BsChatFill } from 'react-icons/bs';
import { FaDatabase, FaBookOpen } from 'react-icons/fa';

// Form validation
import { useForm } from 'react-hook-form';

const CMDB = () => {
  // State management
  const [cmdbItems, setCmdbItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Authentication
  const { getToken } = useAuth();
  
  // Form handling with react-hook-form
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  // API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  // Fetch all CMDB items
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
      setCmdbItems(data.response.data || []);
    } catch (error) {
      console.error('Error fetching CMDB items:', error);
      toast.error('Failed to load CMDB items');
    } finally {
      setLoading(false);
    }
  };

  // Search CMDB items
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

  // Create new CMDB item
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

  // Update CMDB item
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

  // Delete CMDB item
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

  // Handle form submission
  const onSubmit = (data) => {
    if (editing) {
      updateCMDBItem(data);
    } else {
      createCMDBItem(data);
    }
  };

  // Load existing item data for editing
  const editItem = (item) => {
    setEditing(item.tag_id);
    // Set form values
    setValue('tag_id', item.tag_id);
    setValue('ip', item.ip);
    setValue('addr', item.addr);
    setValue('type', item.type);
    setValue('description', item.description);
    setModalOpen(true);
  };

  // Open modal for creating new item
  const openCreateModal = () => {
    setEditing(null);
    reset({
      tag_id: '',
      ip: '',
      addr: '',
      type: '',
      description: ''
    });
    setModalOpen(true);
  };

  // Initialize data on component mount
  useEffect(() => {
    fetchCMDBItems();
  }, []);

  // Handle search when query changes
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery) {
        searchCMDBItems();
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

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
                    <Link href="/cmdb" className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400">
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CMDB Management</h1>
                <button 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                  onClick={openCreateModal}
                >
                  Add New Item
                </button>
              </div>

              {/* Search and View Options */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center flex-1 max-w-md">
                  <input 
                    type="text" 
                    placeholder="Search CMDB items..." 
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg transition-colors duration-200"
                    onClick={searchCMDBItems}
                  >
                    <IoIosSearch size={20} />
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <button 
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                      viewMode === 'table' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                    onClick={() => setViewMode('table')}
                  >
                    Table
                  </button>
                  <button 
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                      viewMode === 'grid' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                    onClick={() => setViewMode('grid')}
                  >
                    Grid
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex justify-center items-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {/* Table View */}
              {!loading && viewMode === 'table' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tag ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">OS</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {cmdbItems.length > 0 ? (
                        cmdbItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.tag_id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.ip}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.addr}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {item.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.os}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{item.description}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => editItem(item)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDelete(item.tag_id)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No CMDB items found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Grid View */}
              {!loading && viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cmdbItems.length > 0 ? (
                    cmdbItems.map((item) => (
                      <div key={item.id} className="bg-white dark:bg-gray-700 shadow rounded-lg overflow-hidden">
                        <div className="p-6">
                          <div className="flex justify-between items-start">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{item.tag_id}</h2>
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {item.type}
                            </span>
                          </div>
                          <div className="mt-4 space-y-2">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">IP:</span> {item.ip}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Location:</span> {item.addr}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">OS:</span> {item.os}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
                          </div>
                          <div className="mt-4 flex justify-end space-x-2">
                            <button
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              onClick={() => editItem(item)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              onClick={() => setConfirmDelete(item.tag_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">No CMDB items found</div>
                  )}
                </div>
              )}
            </div>
          </main>

          {/* Create/Edit Modal */}
          {modalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-11/12 max-w-2xl">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {editing ? 'Edit CMDB Item' : 'Create New CMDB Item'}
                  </h3>
                  
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Tag ID</span>
                      </label>
                      <input 
                        type="text" 
                        className={`input input-bordered ${errors.tag_id ? 'input-error' : ''}`}
                        placeholder="Enter tag ID"
                        {...register('tag_id', { required: 'Tag ID is required' })}
                      />
                      {errors.tag_id && (
                        <label className="label">
                          <span className="label-text-alt text-error">{errors.tag_id.message}</span>
                        </label>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">IP Address</span>
                      </label>
                      <input 
                        type="text" 
                        className={`input input-bordered ${errors.ip ? 'input-error' : ''}`}
                        placeholder="Enter IP address"
                        {...register('ip', { 
                          required: 'IP address is required',
                          pattern: {
                            value: /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
                            message: 'Please enter a valid IPv4 address'
                          }
                        })}
                      />
                      {errors.ip && (
                        <label className="label">
                          <span className="label-text-alt text-error">{errors.ip.message}</span>
                        </label>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Location</span>
                      </label>
                      <input 
                        type="text" 
                        className={`input input-bordered ${errors.addr ? 'input-error' : ''}`}
                        placeholder="Enter location"
                        {...register('addr', { required: 'Location is required' })}
                      />
                      {errors.addr && (
                        <label className="label">
                          <span className="label-text-alt text-error">{errors.addr.message}</span>
                        </label>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Type</span>
                      </label>
                      <select
                        className={`select select-bordered ${errors.type ? 'select-error' : ''}`}
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
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">OS</span>
                      </label>
                      <input 
                        type="text" 
                        className={`input input-bordered ${errors.os ? 'input-error' : ''}`}
                        placeholder="Enter OS (e.g., Ubuntu 20.04)"
                        {...register('os', { required: 'OS is required' })}
                      />
                      {errors.os && (
                        <label className="label">
                          <span className="label-text-alt text-error">{errors.os.message}</span>
                        </label>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Description</span>
                      </label>
                      <textarea 
                        className={`textarea textarea-bordered ${errors.description ? 'textarea-error' : ''}`}
                        placeholder="Enter a description"
                        rows="3"
                        {...register('description', { required: 'Description is required' })}
                      ></textarea>
                      {errors.description && (
                        <label className="label">
                          <span className="label-text-alt text-error">{errors.description.message}</span>
                        </label>
                      )}
                    </div>

                    <div className="flex justify-end space-x-2 mt-6">
                      <button 
                        type="button" 
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
                        onClick={() => {
                          setModalOpen(false);
                          setEditing(null);
                          reset();
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                      >
                        {editing ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {confirmDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Confirm Deletion</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Are you sure you want to delete the CMDB item with Tag ID: <strong className="text-gray-900 dark:text-white">{confirmDelete}</strong>?
                </p>
                <p className="text-red-600 dark:text-red-400 mt-2">This action cannot be undone.</p>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <button 
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
                    onClick={() => setConfirmDelete(null)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                    onClick={() => deleteCMDBItem(confirmDelete)}
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
};

export default CMDB;