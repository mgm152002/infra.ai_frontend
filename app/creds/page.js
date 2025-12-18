'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import { useUser } from "@clerk/clerk-react";
import { redirect } from 'next/navigation';
import { Loader, Shield, Key, Cloud } from 'lucide-react';
import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { MdDashboard, MdSecurity } from 'react-icons/md';
import { BsChatFill } from 'react-icons/bs';
import { FaDatabase, FaBookOpen } from 'react-icons/fa';
import { toast, Toaster } from 'react-hot-toast';

export default function SimplifiedCreds() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  
  if (!user) {
    redirect('/');
  }
  
  const { getToken } = useAuth();

  // State for storing credentials
  const [credentials, setCredentials] = useState({
    aws: {
      access_key: "",
      secrete_access: "",
      region: "us-east-1",
      instance_id: "",
    },
    ssh: {
      key_file: '',
    },
    servicenow: {
      snow_key: "",
      snow_instance: "",
      snow_user: "",
      snow_password: "",
    },
    prometheus: {
      name: "",
      base_url: "",
      auth_type: "none", // 'none' or 'bearer'
      bearer_token: "",
    },
  });

  // Loading states for each credential type
  const [loadingStates, setLoadingStates] = useState({
    aws: false,
    ssh: false,
    servicenow: false,
    prometheus: false,
  });

  // State for active tab
  const [activeTab, setActiveTab] = useState('aws');
  
  // Initial loading state
  const [isLoading, setIsLoading] = useState(true);

  // Load credentials on component mount
  useEffect(() => {
    const fetchCredentials = async () => {
      if (!email) return;
      setIsLoading(true);
      try {
        const [awskeys, sshkeys, snowkeys] = await Promise.all([
          axios.get(`http://localhost:8000/getAwsKeys/${email}`),
          axios.get(`http://localhost:8000/getSSHKeys/${email}`),
          axios.get(`http://localhost:8000/getSnowKey/${email}`),
        ]);

        let promConfig = null;
        try {
          const token = await getToken({ template: 'auth_token' });
          if (token) {
            const promRes = await axios.get('http://localhost:8000/prometheus/config', {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
            });
            promConfig = promRes.data?.response || null;
          }
        } catch (error) {
          console.error('Error fetching Prometheus configuration:', error);
        }
        
        const creds = {
          aws: {
            access_key: awskeys.data.response.access_key || "",
            secrete_access: awskeys.data.response.secrete_access || "",
            region: awskeys.data.response.region || "us-east-1",
          },
          ssh: {
            key_file: sshkeys.data.key_file || "",
          },
          servicenow: {
            snow_key: snowkeys.data.response.snow_key || "",
            snow_instance: snowkeys.data.response.snow_instance || "",
            snow_user: snowkeys.data.response.snow_user || "",
            snow_password: snowkeys.data.response.snow_password || "",
          },
          prometheus: {
            name: promConfig?.name || "",
            base_url: promConfig?.base_url || "",
            auth_type: promConfig?.auth_type || "none",
            bearer_token: promConfig?.bearer_token || "",
          },
        };
        
        setCredentials(creds);
      } catch (error) {
        console.error("Error fetching credentials:", error);
        toast.error("Failed to load credentials. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCredentials();
  }, [email, getToken]);

  // Handle input changes
  const handleInputChange = (section, field, value) => {
    setCredentials(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  // Save AWS credentials
  const saveAWSCredentials = async () => {
    setLoadingStates(prev => ({ ...prev, aws: true }));
    try {
      const token = await getToken({ template: 'auth_token' });
      await axios.post(
        'http://localhost:8000/addAwsCredentials',
        {
          access_key: credentials.aws.access_key,
          secrete_access: credentials.aws.secrete_access,
          region: credentials.aws.region,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success('AWS credentials saved successfully!');
    } catch (error) {
      toast.error(`Error saving AWS credentials: ${error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, aws: false }));
    }
  };

  // Save SSH credentials
  const saveSSHCredentials = async () => {
    setLoadingStates(prev => ({ ...prev, ssh: true }));
    try {
      const token = await getToken({ template: 'auth_token' });
      await axios.post(
        'http://localhost:8000/uploadSSH',
        {
          key_file: credentials.ssh.key_file,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success('SSH credentials saved successfully!');
    } catch (error) {
      toast.error(`Error saving SSH credentials: ${error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, ssh: false }));
    }
  };

  // Save ServiceNow credentials
  const saveServiceNowCredentials = async () => {
    setLoadingStates(prev => ({ ...prev, servicenow: true }));
    try {
      const token = await getToken({ template: 'auth_token' });
      await axios.post(
        'http://localhost:8000/addSNOWCredentials',
        {
          snow_key: credentials.servicenow.snow_key,
          snow_instance: credentials.servicenow.snow_instance,
          snow_user: credentials.servicenow.snow_user,
          snow_password: credentials.servicenow.snow_password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success('ServiceNow credentials saved successfully!');
    } catch (error) {
      toast.error(`Error saving ServiceNow credentials: ${error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, servicenow: false }));
    }
  };

  // Save Prometheus configuration
  const savePrometheusConfig = async () => {
    setLoadingStates(prev => ({ ...prev, prometheus: true }));
    try {
      const token = await getToken({ template: 'auth_token' });
      await axios.post(
        'http://localhost:8000/prometheus/config',
        {
          name: credentials.prometheus.name || null,
          base_url: credentials.prometheus.base_url,
          auth_type: credentials.prometheus.auth_type,
          bearer_token:
            credentials.prometheus.auth_type === 'bearer'
              ? credentials.prometheus.bearer_token
              : null,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success('Prometheus datasource saved successfully!');
    } catch (error) {
      toast.error(`Error saving Prometheus datasource: ${error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, prometheus: false }));
    }
  };

  // Update AWS credentials
  const updateAWSCredentials = async () => {
    setLoadingStates(prev => ({ ...prev, aws: true }));
    try {
      const token = await getToken({ template: 'auth_token' });
      await axios.post(
        'http://localhost:8000/updateAWS',
        {
          access_key: credentials.aws.access_key,
          secrete_access: credentials.aws.secrete_access,
          region: credentials.aws.region,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success('AWS credentials updated successfully!');
    } catch (error) {
      toast.error(`Error updating AWS credentials: ${error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, aws: false }));
    }
  };

  // Update SSH credentials
  const updateSSHCredentials = async () => {
    setLoadingStates(prev => ({ ...prev, ssh: true }));
    try {
      const token = await getToken({ template: 'auth_token' });
      await axios.post(
        'http://localhost:8000/updateSSH',
        {
          key_file: credentials.ssh.key_file,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success('SSH credentials updated successfully!');
    } catch (error) {
      toast.error(`Error updating SSH credentials: ${error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, ssh: false }));
    }
  };

  // Update ServiceNow credentials
  const updateServiceNowCredentials = async () => {
    setLoadingStates(prev => ({ ...prev, servicenow: true }));
    try {
      const token = await getToken({ template: 'auth_token' });
      await axios.post(
        'http://localhost:8000/updateServiceNow',
        {
          snow_key: credentials.servicenow.snow_key,
          snow_instance: credentials.servicenow.snow_instance,
          snow_user: credentials.servicenow.snow_user,
          snow_password: credentials.servicenow.snow_password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success('ServiceNow credentials updated successfully!');
    } catch (error) {
      toast.error(`Error updating ServiceNow credentials: ${error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, servicenow: false }));
    }
  };

  // Render loading state
  if (isLoading) {
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
                      <Link
                        href="/dashboard"
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <MdDashboard className="w-5 h-5 mr-2" />
                        Dashboard
                      </Link>
                      <Link
                        href="/creds"
                        className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
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

            {/* Loading Content */}
            <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
              <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-blue-200 dark:border-blue-800 animate-pulse"></div>
                    <Loader className="w-24 h-24 absolute top-0 left-0 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Loading Credentials</h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Please wait while we fetch your credentials...
                    </p>
                  </div>
                  <div className="flex space-x-4">
                    <div className="flex flex-col items-center space-y-2">
                      <Cloud className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">AWS</span>
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                      <Key className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">SSH</span>
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                      <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">ServiceNow</span>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </SignedIn>
      </ClerkProvider>
    );
  }

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
                      className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Credentials Manager</h1>
              
              <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
                <button 
                  className={`px-4 py-3 mr-2 rounded-t-lg font-medium transition ${
                    activeTab === 'aws' 
                      ? 'bg-blue-600 text-white border-b-2 border-blue-600' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setActiveTab('aws')}
                >
                  AWS
                </button>
                <button 
                  className={`px-4 py-3 mr-2 rounded-t-lg font-medium transition ${
                    activeTab === 'ssh' 
                      ? 'bg-blue-600 text-white border-b-2 border-blue-600' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setActiveTab('ssh')}
                >
                  SSH
                </button>
                <button 
                  className={`px-4 py-3 mr-2 rounded-t-lg font-medium transition ${
                    activeTab === 'servicenow' 
                      ? 'bg-blue-600 text-white border-b-2 border-blue-600' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setActiveTab('servicenow')}
                >
                  ServiceNow
                </button>
                <button 
                  className={`px-4 py-3 rounded-t-lg font-medium transition ${
                    activeTab === 'prometheus' 
                      ? 'bg-blue-600 text-white border-b-2 border-blue-600' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setActiveTab('prometheus')}
                >
                  Prometheus
                </button>
              </div>
              
              <div className="mb-8">
                {activeTab === 'aws' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">Access Key</label>
                      <input
                        type="text"
                        value={credentials.aws.access_key}
                        onChange={(e) => handleInputChange('aws', 'access_key', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter AWS Access Key"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">Secret Key</label>
                      <input
                        type="password"
                        value={credentials.aws.secrete_access}
                        onChange={(e) => handleInputChange('aws', 'secrete_access', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter AWS Secret Key"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">Region</label>
                      <select
                        value={credentials.aws.region}
                        onChange={(e) => handleInputChange('aws', 'region', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="us-east-2">US East (Ohio)</option>
                        <option value="us-west-1">US West (N. California)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="eu-west-1">EU (Ireland)</option>
                        <option value="eu-central-1">EU (Frankfurt)</option>
                        <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                      </select>
                    </div>
                    <div className="flex justify-end space-x-4">
                      <button 
                        className={`px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center ${
                          loadingStates.aws ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                        onClick={saveAWSCredentials}
                        disabled={loadingStates.aws}
                      >
                        {loadingStates.aws && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                        {loadingStates.aws ? 'Saving...' : 'Save AWS Credentials'}
                      </button>
                      <button 
                        className={`px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center ${
                          loadingStates.aws ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                        onClick={updateAWSCredentials}
                        disabled={loadingStates.aws}
                      >
                        {loadingStates.aws && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                        {loadingStates.aws ? 'Updating...' : 'Update AWS Credentials'}
                      </button>
                    </div>
                  </div>
                )}
                
                {activeTab === 'ssh' && (
                  <div>
                    <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">SSH Private Key</label>
                    <textarea
                      value={credentials.ssh.key_file}
                      onChange={(e) => handleInputChange('ssh', 'key_file', e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono h-64"
                      placeholder="Enter SSH private key"
                    />
                    <div className="flex justify-end space-x-4">
                      <button 
                        className={`px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center ${
                          loadingStates.ssh ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                        onClick={saveSSHCredentials}
                        disabled={loadingStates.ssh}
                      >
                        {loadingStates.ssh && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                        {loadingStates.ssh ? 'Saving...' : 'Save SSH Credentials'}
                      </button>
                      <button 
                        className={`px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center ${
                          loadingStates.ssh ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                        onClick={updateSSHCredentials}
                        disabled={loadingStates.ssh}
                      >
                        {loadingStates.ssh && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                        {loadingStates.ssh ? 'Updating...' : 'Update SSH Credentials'}
                      </button>
                    </div>
                  </div>
                )}
                
                {activeTab === 'servicenow' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">Username</label>
                      <input
                        type="text"
                        value={credentials.servicenow.snow_user}
                        onChange={(e) => handleInputChange('servicenow', 'snow_user', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="ServiceNow Username"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">Password</label>
                      <input
                        type="password"
                        value={credentials.servicenow.snow_password}
                        onChange={(e) => handleInputChange('servicenow', 'snow_password', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="ServiceNow Password"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">Instance URL</label>
                      <input
                        type="text"
                        value={credentials.servicenow.snow_instance}
                        onChange={(e) => handleInputChange('servicenow', 'snow_instance', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., https://yourinstance.service-now.com"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">API Key</label>
                      <input
                        type="text"
                        value={credentials.servicenow.snow_key}
                        onChange={(e) => handleInputChange('servicenow', 'snow_key', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="ServiceNow API Key"
                      />
                    </div>
                    <div className="flex justify-end space-x-4">
                      <button 
                        className={`px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center ${
                          loadingStates.servicenow ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                        onClick={saveServiceNowCredentials}
                        disabled={loadingStates.servicenow}
                      >
                        {loadingStates.servicenow && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                        {loadingStates.servicenow ? 'Saving...' : 'Save ServiceNow Credentials'}
                      </button>
                      <button 
                        className={`px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center ${
                          loadingStates.servicenow ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                        onClick={updateServiceNowCredentials}
                        disabled={loadingStates.servicenow}
                      >
                        {loadingStates.servicenow && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                        {loadingStates.servicenow ? 'Updating...' : 'Update ServiceNow Credentials'}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'prometheus' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Configure a Prometheus datasource that Infra.ai can use to enrich incident
                      diagnostics with real-time metrics.
                    </p>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
                        Display name (optional)
                      </label>
                      <input
                        type="text"
                        value={credentials.prometheus.name}
                        onChange={(e) => handleInputChange('prometheus', 'name', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. Primary Prometheus"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={credentials.prometheus.base_url}
                        onChange={(e) => handleInputChange('prometheus', 'base_url', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. https://prometheus.example.com"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
                        Authentication
                      </label>
                      <select
                        value={credentials.prometheus.auth_type}
                        onChange={(e) => handleInputChange('prometheus', 'auth_type', e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="none">No authentication</option>
                        <option value="bearer">Bearer token</option>
                      </select>
                    </div>
                    {credentials.prometheus.auth_type === 'bearer' && (
                      <div>
                        <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
                          Bearer token
                        </label>
                        <textarea
                          value={credentials.prometheus.bearer_token}
                          onChange={(e) => handleInputChange('prometheus', 'bearer_token', e.target.value)}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono h-32"
                          placeholder="Paste bearer token used to access Prometheus HTTP API"
                        />
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button
                        className={`px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center ${
                          loadingStates.prometheus ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                        onClick={savePrometheusConfig}
                        disabled={loadingStates.prometheus}
                      >
                        {loadingStates.prometheus && (
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {loadingStates.prometheus ? 'Saving...' : 'Save Prometheus Config'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}
