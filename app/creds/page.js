'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth, useUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { Loader2, Shield, Key, Cloud, Server, Github, CheckSquare, FileText, Activity } from 'lucide-react';
import { ClerkProvider, SignedIn } from '@clerk/nextjs';
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';

import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import Toaster with no SSR
const ToasterComponent = dynamic(
  () => import('react-hot-toast').then((mod) => mod.Toaster),
  { ssr: false }
);

export default function SimplifiedCreds() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!user) {
    // redirect('/');
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
      auth_type: "none",
      bearer_token: "",
    },
    datadog: {
      api_key: "",
      app_key: "",
      site: "datadoghq.com"
    },
    github: {
      base_url: "https://api.github.com",
      token: "",
      default_owner: "",
      default_repo: "",
    },
    jira: {
      base_url: "",
      email: "",
      api_token: "",
    },
    confluence: {
      base_url: "",
      email: "",
      api_token: "",
    },
    pagerduty: {
      api_token: "",
      service_ids: "",
      team_ids: "",
    },
    slack: {
      slack_bot_token: "",
      slack_channel: "",
    },
    email: {
      smtp_server: "smtp.gmail.com",
      smtp_port: "587",
      sender_email: "",
      sender_password: "",
    },
  });

  const [loadingStates, setLoadingStates] = useState({
    aws: false,
    ssh: false,
    servicenow: false,
    prometheus: false,
    datadog: false,
    github: false,
    jira: false,
    confluence: false,
    pagerduty: false,
    slack: false,
    email: false,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCredentials = async () => {
      // 1. Load from LocalStorage first for instant UI
      const cachedSlack = localStorage.getItem('infra_slack_creds');
      const cachedEmail = localStorage.getItem('infra_email_creds');

      if (cachedSlack || cachedEmail) {
        const parsedSlack = cachedSlack ? JSON.parse(cachedSlack) : null;
        const parsedEmail = cachedEmail ? JSON.parse(cachedEmail) : null;
        setCredentials(prev => ({
          ...prev,
          slack: parsedSlack ? {
            slack_bot_token: parsedSlack.slack_bot_token || "",
            slack_channel: parsedSlack.slack_channel || ""
          } : prev.slack,
          email: parsedEmail ? {
            smtp_server: parsedEmail.smtp_server || "smtp.gmail.com",
            smtp_port: parsedEmail.smtp_port || 587,
            sender_email: parsedEmail.sender_email || "",
            sender_password: parsedEmail.sender_password || ""
          } : prev.email
        }));
        setLoadingStates(prev => ({
          ...prev,
          slack: !cachedSlack,
          email: !cachedEmail
        }));
      }

      if (!email) return;
      setIsLoading(true);

      const independentPromise = Promise.allSettled([
        axios.get(`http://localhost:8000/getAwsKeys/${email}`),
        axios.get(`http://localhost:8000/getSSHKeys/${email}`),
        axios.get(`http://localhost:8000/getSnowKey/${email}`),
      ]);

      const dependentPromise = (async () => {
        try {
          const token = await getToken({ template: 'auth_token' });
          if (!token) return [];
          const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          };
          return await Promise.allSettled([
            axios.get('http://localhost:8000/integrations/prometheus/config', { headers }),  // [0] promRes
            axios.get('http://localhost:8000/integrations/github/config', { headers }),      // [1] ghRes
            axios.get('http://localhost:8000/integrations/jira/config', { headers }),        // [2] jiraRes
            axios.get('http://localhost:8000/integrations/confluence/config', { headers }),  // [3] confRes
            axios.get('http://localhost:8000/integrations/pagerduty/config', { headers }),   // [4] pdRes
            axios.get('http://localhost:8000/integrations/datadog/config', { headers }),     // [5] ddRes
            axios.get(`http://localhost:8000/getSlackCredentials/${email}`, { headers }),    // [6] slackRes
            axios.get(`http://localhost:8000/getEmailCredentials/${email}`, { headers }),    // [7] emailRes
          ]);
        } catch (e) {
          console.error("Token/Integration fetch error", e);
          return [];
        }
      })();

      try {
        const [independentResults, dependentResults] = await Promise.all([independentPromise, dependentPromise]);

        // Process Independent Results (AWS, SSH, SNOW)
        const awskeys = independentResults[0].status === 'fulfilled' ? independentResults[0].value : { data: {} };
        const sshkeys = independentResults[1].status === 'fulfilled' ? independentResults[1].value : { data: {} };
        const snowkeys = independentResults[2].status === 'fulfilled' ? independentResults[2].value : { data: {} };

        // Process Dependent Results — destructuring now matches the 8-item array above
        const integrationResults = Array.isArray(dependentResults) ? dependentResults : [];
        const [promRes, ghRes, jiraRes, confRes, pdRes, ddRes, slackRes, emailRes] = integrationResults;

        const promConfig      = promRes?.status === 'fulfilled'   ? promRes.value.data?.response      || null : null;
        const githubConfig    = ghRes?.status === 'fulfilled'     ? ghRes.value.data?.response        || null : null;
        const jiraConfig      = jiraRes?.status === 'fulfilled'   ? jiraRes.value.data?.response      || null : null;
        const confluenceConfig= confRes?.status === 'fulfilled'   ? confRes.value.data?.response      || null : null;
        const pagerdutyConfig = pdRes?.status === 'fulfilled'     ? pdRes.value.data?.response        || null : null;
        const datadogConfig   = ddRes?.status === 'fulfilled'     ? ddRes.value.data?.response        || null : null;
        const slackConfig     = slackRes?.status === 'fulfilled'  ? slackRes.value.data?.response     || null : null;
        const emailConfig     = emailRes?.status === 'fulfilled'  ? emailRes.value.data?.response     || null : null;

        const creds = {
          aws: {
            access_key: awskeys.data.response?.access_key || "",
            secrete_access: awskeys.data.response?.secrete_access || "",
            region: awskeys.data.response?.region || "us-east-1",
          },
          ssh: {
            key_file: sshkeys.data.key_file || "",
          },
          servicenow: {
            snow_key: snowkeys.data.response?.snow_key || "",
            snow_instance: snowkeys.data.response?.snow_instance || "",
            snow_user: snowkeys.data.response?.snow_user || "",
            snow_password: snowkeys.data.response?.snow_password || "",
          },
          prometheus: {
            name: promConfig?.name || "",
            base_url: promConfig?.base_url || "",
            auth_type: promConfig?.auth_type || "none",
            bearer_token: promConfig?.bearer_token || "",
          },
          datadog: {
            api_key: datadogConfig?.api_key || "",
            app_key: datadogConfig?.app_key || "",
            site: datadogConfig?.site || "datadoghq.com"
          },
          github: {
            base_url: githubConfig?.base_url || "https://api.github.com",
            token: githubConfig?.token || "",
            default_owner: githubConfig?.default_owner || "",
            default_repo: githubConfig?.default_repo || "",
          },
          jira: {
            base_url: jiraConfig?.base_url || "",
            email: jiraConfig?.email || "",
            api_token: jiraConfig?.api_token || "",
          },
          confluence: {
            base_url: confluenceConfig?.base_url || "",
            email: confluenceConfig?.email || "",
            api_token: confluenceConfig?.api_token || "",
          },
          pagerduty: {
            api_token: pagerdutyConfig?.api_token || "",
            service_ids: pagerdutyConfig?.service_ids || "",
            team_ids: pagerdutyConfig?.team_ids || "",
          },
          slack: {
            slack_bot_token: slackConfig?.slack_bot_token || "",
            slack_channel: slackConfig?.slack_channel || "",
          },
          email: {
            smtp_server: emailConfig?.smtp_server || (cachedEmail ? (JSON.parse(cachedEmail).smtp_server || "smtp.gmail.com") : "smtp.gmail.com"),
            smtp_port: emailConfig?.smtp_port || (cachedEmail ? (JSON.parse(cachedEmail).smtp_port || 587) : 587),
            sender_email: emailConfig?.sender_email || (cachedEmail ? (JSON.parse(cachedEmail).sender_email || "") : ""),
            sender_password: emailConfig?.sender_password || (cachedEmail ? (JSON.parse(cachedEmail).sender_password || "") : ""),
          },
        };

        setCredentials(creds);
      } catch (error) {
        console.error("Error fetching credentials:", error);
        toast.error("Failed to load credentials.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCredentials();
  }, [email, getToken]);

  const handleInputChange = (section, field, value) => {
    setCredentials(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const saveOrUpdate = async (type, isUpdate, url, payload, successMsg, onSuccess) => {
    setLoadingStates(prev => ({ ...prev, [type]: true }));
    try {
      const token = await getToken({ template: 'auth_token' });
      await axios.post(
        url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (onSuccess) onSuccess(payload);
      toast.success(successMsg);
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, [type]: false }));
    }
  };

  const saveAWSCredentials = () => saveOrUpdate('aws', false, 'http://localhost:8000/addAwsCredentials', { ...credentials.aws }, 'AWS credentials saved!');
  const updateAWSCredentials = () => saveOrUpdate('aws', true, 'http://localhost:8000/updateAWS', { ...credentials.aws }, 'AWS credentials updated!');
  const saveSSHCredentials = () => saveOrUpdate('ssh', false, 'http://localhost:8000/uploadSSH', { key_file: credentials.ssh.key_file }, 'SSH credentials saved!');
  const updateSSHCredentials = () => saveOrUpdate('ssh', true, 'http://localhost:8000/updateSSH', { key_file: credentials.ssh.key_file }, 'SSH credentials updated!');
  const saveServiceNowCredentials = () => saveOrUpdate('servicenow', false, 'http://localhost:8000/addSNOWCredentials', { ...credentials.servicenow }, 'ServiceNow credentials saved!');
  const updateServiceNowCredentials = () => saveOrUpdate('servicenow', true, 'http://localhost:8000/updateServiceNow', { ...credentials.servicenow }, 'ServiceNow credentials updated!');

  const savePrometheusConfig = () => {
    const payload = { ...credentials.prometheus };
    if (payload.auth_type !== 'bearer') payload.bearer_token = null;
    saveOrUpdate('prometheus', false, 'http://localhost:8000/integrations/prometheus/config', payload, 'Prometheus config saved!');
  };

  const saveDatadogConfig = () => saveOrUpdate('datadog', false, 'http://localhost:8000/integrations/datadog/config', { ...credentials.datadog }, 'Datadog config saved!');
  const saveGitHubConfig = () => saveOrUpdate('github', false, 'http://localhost:8000/integrations/github/config', { ...credentials.github }, 'GitHub config saved!');
  const saveJiraConfig = () => saveOrUpdate('jira', false, 'http://localhost:8000/integrations/jira/config', { ...credentials.jira }, 'Jira config saved!');
  const saveConfluenceConfig = () => saveOrUpdate('confluence', false, 'http://localhost:8000/integrations/confluence/config', { ...credentials.confluence }, 'Confluence config saved!');
  const savePagerDutyConfig = () => saveOrUpdate('pagerduty', false, 'http://localhost:8000/integrations/pagerduty/config', { ...credentials.pagerduty }, 'PagerDuty config saved!');

  const saveSlackCredentials = () => saveOrUpdate(
    'slack',
    false,
    'http://localhost:8000/addSlackCredentials',
    { ...credentials.slack },
    'Slack credentials saved!',
    (data) => localStorage.setItem('infra_slack_creds', JSON.stringify(data))
  );

  const saveEmailCredentials = () => saveOrUpdate(
    'email',
    false,
    'http://localhost:8000/addEmailCredentials',
    { ...credentials.email },
    'Email credentials saved!',
    (data) => localStorage.setItem('infra_email_creds', JSON.stringify(data))
  );

  return (
    <ClerkProvider>
      <SignedIn>
        <div className="h-full relative">
          <ToasterComponent position="top-center" />
          <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-80 bg-gray-900">
            <Sidebar />
          </div>
          <div className="md:hidden">
            <MobileSidebar />
          </div>
          <main className="md:pl-72 pb-10">
            <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">

              <div className="md:hidden flex items-center justify-between mb-4">
                <div className="font-bold text-lg">Infra.ai</div>
                <div className="flex gap-2 items-center">
                  <ModeToggle />
                  <UserButton />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Credentials & Integrations</h1>
                  <p className="text-muted-foreground mt-2">
                    Manage your cloud keys, service connections, and observability tools.
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[50vh] space-y-6 animate-in fade-in zoom-in-95 duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                    <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Loading Credentials...</h3>
                    <p className="text-sm text-muted-foreground">Fetching your keys and configurations concurrently.</p>
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="aws" className="w-full flex flex-col md:flex-row gap-6">
                  <TabsList className="flex flex-col h-auto w-full md:w-64 justify-start space-y-1 bg-transparent p-0">
                    <TabsTrigger value="aws" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Cloud className="mr-2 h-4 w-4" /> AWS
                    </TabsTrigger>
                    <TabsTrigger value="ssh" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Key className="mr-2 h-4 w-4" /> SSH Keys
                    </TabsTrigger>
                    <TabsTrigger value="servicenow" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Shield className="mr-2 h-4 w-4" /> ServiceNow
                    </TabsTrigger>
                    <TabsTrigger value="prometheus" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Activity className="mr-2 h-4 w-4" /> Prometheus
                    </TabsTrigger>
                    <TabsTrigger value="datadog" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Activity className="mr-2 h-4 w-4" /> Datadog
                    </TabsTrigger>
                    <TabsTrigger value="github" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Github className="mr-2 h-4 w-4" /> GitHub
                    </TabsTrigger>
                    <TabsTrigger value="jira" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <CheckSquare className="mr-2 h-4 w-4" /> Jira
                    </TabsTrigger>
                    <TabsTrigger value="confluence" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <FileText className="mr-2 h-4 w-4" /> Confluence
                    </TabsTrigger>
                    <TabsTrigger value="pagerduty" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Activity className="mr-2 h-4 w-4" /> PagerDuty
                    </TabsTrigger>
                    <TabsTrigger value="slack" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Activity className="mr-2 h-4 w-4" /> Slack
                    </TabsTrigger>
                    <TabsTrigger value="email" className="w-full justify-start px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Activity className="mr-2 h-4 w-4" /> Email
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1">
                    {/* AWS Tab */}
                    <TabsContent value="aws" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>AWS Configuration</CardTitle>
                          <CardDescription>Enter your AWS credentials to manage EC2 instances and other resources.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Access Key</Label>
                            <Input
                              value={credentials.aws.access_key}
                              onChange={(e) => handleInputChange('aws', 'access_key', e.target.value)}
                              placeholder="AWS Access Key"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Secret Key</Label>
                            <Input
                              type="password"
                              value={credentials.aws.secrete_access}
                              onChange={(e) => handleInputChange('aws', 'secrete_access', e.target.value)}
                              placeholder="AWS Secret Key"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Region</Label>
                            <Select
                              value={credentials.aws.region || "us-east-1"}
                              onValueChange={(value) => handleInputChange('aws', 'region', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select region" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                                <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                                <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                                <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                                <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                                <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                                <SelectItem value="ap-south-1">Asia Pacific (Mumbai)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          <Button variant="outline" onClick={updateAWSCredentials} disabled={loadingStates.aws}>
                            {loadingStates.aws && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Existing
                          </Button>
                          <Button onClick={saveAWSCredentials} disabled={loadingStates.aws}>
                            {loadingStates.aws && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save New
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* SSH Tab */}
                    <TabsContent value="ssh" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>SSH Keys</CardTitle>
                          <CardDescription>Provide your SSH private key for remote server access.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Private Key</Label>
                            <Textarea
                              className="font-mono h-64"
                              value={credentials.ssh.key_file}
                              onChange={(e) => handleInputChange('ssh', 'key_file', e.target.value)}
                              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          <Button variant="outline" onClick={updateSSHCredentials} disabled={loadingStates.ssh}>
                            {loadingStates.ssh && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Existing
                          </Button>
                          <Button onClick={saveSSHCredentials} disabled={loadingStates.ssh}>
                            {loadingStates.ssh && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save New
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* ServiceNow Tab */}
                    <TabsContent value="servicenow" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>ServiceNow</CardTitle>
                          <CardDescription>Connect to your ServiceNow instance for ITSM integration.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Instance URL</Label>
                            <Input
                              value={credentials.servicenow.snow_instance}
                              onChange={(e) => handleInputChange('servicenow', 'snow_instance', e.target.value)}
                              placeholder="https://your-instance.service-now.com"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Username</Label>
                              <Input
                                value={credentials.servicenow.snow_user}
                                onChange={(e) => handleInputChange('servicenow', 'snow_user', e.target.value)}
                                placeholder="Username"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Password</Label>
                              <Input
                                type="password"
                                value={credentials.servicenow.snow_password}
                                onChange={(e) => handleInputChange('servicenow', 'snow_password', e.target.value)}
                                placeholder="Password"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>API Key (Optional if User/Pass used)</Label>
                            <Input
                              value={credentials.servicenow.snow_key}
                              onChange={(e) => handleInputChange('servicenow', 'snow_key', e.target.value)}
                              placeholder="ServiceNow API Key"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          <Button variant="outline" onClick={updateServiceNowCredentials} disabled={loadingStates.servicenow}>
                            {loadingStates.servicenow && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Existing
                          </Button>
                          <Button onClick={saveServiceNowCredentials} disabled={loadingStates.servicenow}>
                            {loadingStates.servicenow && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save New
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* Prometheus Tab */}
                    <TabsContent value="prometheus" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Prometheus</CardTitle>
                          <CardDescription>Connect to Prometheus for metrics and alerting.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input
                              value={credentials.prometheus.name}
                              onChange={(e) => handleInputChange('prometheus', 'name', e.target.value)}
                              placeholder="e.g. Production Prometheus"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Base URL</Label>
                            <Input
                              value={credentials.prometheus.base_url}
                              onChange={(e) => handleInputChange('prometheus', 'base_url', e.target.value)}
                              placeholder="https://prometheus.example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Authentication</Label>
                            <Select
                              value={credentials.prometheus.auth_type || "none"}
                              onValueChange={(value) => handleInputChange('prometheus', 'auth_type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Authentication</SelectItem>
                                <SelectItem value="bearer">Bearer Token</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {credentials.prometheus.auth_type === 'bearer' && (
                            <div className="space-y-2">
                              <Label>Bearer Token</Label>
                              <Textarea
                                value={credentials.prometheus.bearer_token}
                                onChange={(e) => handleInputChange('prometheus', 'bearer_token', e.target.value)}
                                placeholder="Enter token..."
                              />
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button onClick={savePrometheusConfig} disabled={loadingStates.prometheus}>
                            {loadingStates.prometheus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* Datadog Tab */}
                    <TabsContent value="datadog" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Datadog</CardTitle>
                          <CardDescription>Connect to Datadog for observability.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                              type="password"
                              value={credentials.datadog.api_key}
                              onChange={(e) => handleInputChange('datadog', 'api_key', e.target.value)}
                              placeholder="Datadog API Key"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Application Key</Label>
                            <Input
                              type="password"
                              value={credentials.datadog.app_key}
                              onChange={(e) => handleInputChange('datadog', 'app_key', e.target.value)}
                              placeholder="Datadog Application Key"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Site</Label>
                            <Input
                              value={credentials.datadog.site || "datadoghq.com"}
                              onChange={(e) => handleInputChange('datadog', 'site', e.target.value)}
                              placeholder="datadoghq.com"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button onClick={saveDatadogConfig} disabled={loadingStates.datadog}>
                            {loadingStates.datadog && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* GitHub Tab */}
                    <TabsContent value="github" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>GitHub</CardTitle>
                          <CardDescription>Integrate with GitHub for repository access.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Base URL</Label>
                            <Input
                              value={credentials.github.base_url || "https://api.github.com"}
                              onChange={(e) => handleInputChange('github', 'base_url', e.target.value)}
                              placeholder="https://api.github.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Personal Access Token</Label>
                            <Input
                              type="password"
                              value={credentials.github.token}
                              onChange={(e) => handleInputChange('github', 'token', e.target.value)}
                              placeholder="ghp_..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Default Owner/Org</Label>
                              <Input
                                value={credentials.github.default_owner}
                                onChange={(e) => handleInputChange('github', 'default_owner', e.target.value)}
                                placeholder="e.g. my-org"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Default Repo</Label>
                              <Input
                                value={credentials.github.default_repo}
                                onChange={(e) => handleInputChange('github', 'default_repo', e.target.value)}
                                placeholder="e.g. infra"
                              />
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button onClick={saveGitHubConfig} disabled={loadingStates.github}>
                            {loadingStates.github && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* Jira Tab */}
                    <TabsContent value="jira" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Jira</CardTitle>
                          <CardDescription>Connect Jira for ticket management.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Base URL</Label>
                            <Input
                              value={credentials.jira.base_url}
                              onChange={(e) => handleInputChange('jira', 'base_url', e.target.value)}
                              placeholder="https://your-domain.atlassian.net"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              value={credentials.jira.email}
                              onChange={(e) => handleInputChange('jira', 'email', e.target.value)}
                              placeholder="you@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>API Token</Label>
                            <Input
                              type="password"
                              value={credentials.jira.api_token}
                              onChange={(e) => handleInputChange('jira', 'api_token', e.target.value)}
                              placeholder="Jira API Token"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button onClick={saveJiraConfig} disabled={loadingStates.jira}>
                            {loadingStates.jira && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* Confluence Tab */}
                    <TabsContent value="confluence" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Confluence</CardTitle>
                          <CardDescription>Connect Confluence for knowledge base access.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Base URL</Label>
                            <Input
                              value={credentials.confluence.base_url}
                              onChange={(e) => handleInputChange('confluence', 'base_url', e.target.value)}
                              placeholder="https://your-domain.atlassian.net/wiki"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              value={credentials.confluence.email}
                              onChange={(e) => handleInputChange('confluence', 'email', e.target.value)}
                              placeholder="you@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>API Token</Label>
                            <Input
                              type="password"
                              value={credentials.confluence.api_token}
                              onChange={(e) => handleInputChange('confluence', 'api_token', e.target.value)}
                              placeholder="Confluence API Token"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button onClick={saveConfluenceConfig} disabled={loadingStates.confluence}>
                            {loadingStates.confluence && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* PagerDuty Tab */}
                    <TabsContent value="pagerduty" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>PagerDuty</CardTitle>
                          <CardDescription>Connect PagerDuty for on-call management.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>API Token</Label>
                            <Input
                              type="password"
                              value={credentials.pagerduty.api_token}
                              onChange={(e) => handleInputChange('pagerduty', 'api_token', e.target.value)}
                              placeholder="PagerDuty API Token"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Service IDs</Label>
                            <Input
                              value={credentials.pagerduty.service_ids}
                              onChange={(e) => handleInputChange('pagerduty', 'service_ids', e.target.value)}
                              placeholder="Comma separated IDs"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Team IDs</Label>
                            <Input
                              value={credentials.pagerduty.team_ids}
                              onChange={(e) => handleInputChange('pagerduty', 'team_ids', e.target.value)}
                              placeholder="Comma separated IDs"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button onClick={savePagerDutyConfig} disabled={loadingStates.pagerduty}>
                            {loadingStates.pagerduty && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* Slack Tab */}
                    <TabsContent value="slack" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Slack</CardTitle>
                          <CardDescription>Connect Slack for notifications and incident management.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Bot Token</Label>
                            <Input
                              type="password"
                              value={credentials.slack.slack_bot_token}
                              onChange={(e) => handleInputChange('slack', 'slack_bot_token', e.target.value)}
                              placeholder="xoxb-..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Default Channel (Optional)</Label>
                            <Input
                              value={credentials.slack.slack_channel}
                              onChange={(e) => handleInputChange('slack', 'slack_channel', e.target.value)}
                              placeholder="#incidents"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button onClick={saveSlackCredentials} disabled={loadingStates.slack}>
                            {loadingStates.slack && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* Email Tab */}
                    <TabsContent value="email" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Email</CardTitle>
                          <CardDescription>Configure SMTP settings for email notifications.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>SMTP Server</Label>
                            <Input
                              value={credentials.email.smtp_server}
                              onChange={(e) => handleInputChange('email', 'smtp_server', e.target.value)}
                              placeholder="smtp.gmail.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>SMTP Port</Label>
                            <Input
                              type="number"
                              value={String(credentials.email.smtp_port)}
                              onChange={(e) => handleInputChange('email', 'smtp_port', String(e.target.value))}
                              placeholder="587"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Sender Email</Label>
                            <Input
                              value={credentials.email.sender_email}
                              onChange={(e) => handleInputChange('email', 'sender_email', e.target.value)}
                              placeholder="you@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Sender Password</Label>
                            <Input
                              type="password"
                              value={credentials.email.sender_password}
                              onChange={(e) => handleInputChange('email', 'sender_password', e.target.value)}
                              placeholder="App Password"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button onClick={saveEmailCredentials} disabled={loadingStates.email}>
                            {loadingStates.email && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </div>
          </main>
        </div>
      </SignedIn>
    </ClerkProvider>
  );
}