"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@clerk/nextjs';
import { Plus, Pencil, Trash2, Bell, Clock, AlertTriangle, Mail, Hash } from "lucide-react";

export default function EscalationsPage() {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [escalations, setEscalations] = useState([]);
  const [alertTypes, setAlertTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEscalation, setEditingEscalation] = useState(null);
  const [formData, setFormData] = useState({
    alert_type_id: "",
    level: 1,
    wait_time_minutes: 30,
    contact_type: "email",
    contact_destination: "",
  });

  useEffect(() => {
    fetchEscalations();
    fetchAlertTypes();
  }, []);

  const fetchAlertTypes = async () => {
    try {
      const token = await getToken({ template: "auth_token" });
      if (!token) return;
      
      const response = await fetch("/api/alert-types", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.response) {
        setAlertTypes(data.response);
      }
    } catch (error) {
      console.error("Failed to fetch alert types:", error);
    }
  };

  const fetchEscalations = async () => {
    try {
      const token = await getToken({ template: "auth_token" });
      if (!token) {
        throw new Error("Not authenticated");
      }
      
      const response = await fetch("/api/escalation-rules", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.response) {
        setEscalations(data.response);
      }
    } catch (error) {
      console.error("Failed to fetch escalations:", error);
      toast({
        title: "Error",
        description: "Failed to load escalation rules. Please check if the backend is running.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = await getToken({ template: "auth_token" });
      if (!token) {
        throw new Error("Not authenticated");
      }
      
      const url = editingEscalation 
        ? `/api/escalation-rules/${editingEscalation.id}`
        : "/api/escalation-rules";
      
      const method = editingEscalation ? "PUT" : "POST";
      
      const payload = {
        ...formData,
        alert_type_id: parseInt(formData.alert_type_id),
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: editingEscalation 
            ? "Escalation rule updated" 
            : "Escalation rule created",
        });
        setIsDialogOpen(false);
        resetForm();
        fetchEscalations();
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (ruleId) => {
    if (!confirm("Are you sure you want to delete this escalation rule?")) return;
    
    try {
      const token = await getToken({ template: "auth_token" });
      if (!token) {
        throw new Error("Not authenticated");
      }
      
      const response = await fetch(`/api/escalation-rules/${ruleId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Escalation rule deleted",
        });
        fetchEscalations();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete escalation rule",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (escalation) => {
    setEditingEscalation(escalation);
    setFormData({
      alert_type_id: escalation.alert_type_id,
      level: escalation.level,
      wait_time_minutes: escalation.wait_time_minutes || 30,
      contact_type: escalation.contact_type || "email",
      contact_destination: escalation.contact_destination || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEscalation(null);
    setFormData({
      alert_type_id: "",
      level: 1,
      wait_time_minutes: 30,
      contact_type: "email",
      contact_destination: "",
    });
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 3: return "bg-red-500";
      case 2: return "bg-orange-500";
      case 1: return "bg-yellow-500";
      default: return "bg-green-500";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Alert Type Escalations</h1>
          <p className="text-muted-foreground">
            Configure escalation rules based on alert types
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Escalation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEscalation ? "Edit Escalation" : "Create Escalation"}
              </DialogTitle>
              <DialogDescription>
                Configure how incidents should be escalated based on alert type
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="alert_type_id">Alert Type</Label>
                  <Select 
                    value={formData.alert_type_id.toString()} 
                    onValueChange={(val) => setFormData({...formData, alert_type_id: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select alert type" />
                    </SelectTrigger>
                    <SelectContent>
                      {alertTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name || type.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="level">Escalation Level</Label>
                    <Select 
                      value={formData.level.toString()} 
                      onValueChange={(val) => setFormData({...formData, level: parseInt(val)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Level 1</SelectItem>
                        <SelectItem value="2">Level 2</SelectItem>
                        <SelectItem value="3">Level 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="wait_time_minutes">Wait Time (minutes)</Label>
                    <Input
                      id="wait_time_minutes"
                      type="number"
                      value={formData.wait_time_minutes}
                      onChange={(e) => setFormData({...formData, wait_time_minutes: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact_type">Contact Type</Label>
                  <Select 
                    value={formData.contact_type} 
                    onValueChange={(val) => setFormData({...formData, contact_type: val, contact_destination: ""})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact_destination">
                    {formData.contact_type === "slack" ? "Slack Channel" : "Email Address"}
                  </Label>
                  <div className="flex items-center gap-2">
                    {formData.contact_type === "slack" ? (
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Input
                      id="contact_destination"
                      value={formData.contact_destination}
                      onChange={(e) => setFormData({...formData, contact_destination: e.target.value})}
                      placeholder={formData.contact_type === "slack" ? "e.g., #incidents, #ops-alerts" : "e.g., oncall@company.com"}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.contact_type === "slack" 
                      ? "Enter the Slack channel name (with # prefix)" 
                      : "Enter the email address for notifications"}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingEscalation ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Escalation Matrix
          </CardTitle>
          <CardDescription>
            Manage how different alert types trigger escalation when resolution fails
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alert Type</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Wait Time</TableHead>
                <TableHead>Contact Type</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escalations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No escalation rules found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                escalations.map((escalation) => (
                  <TableRow key={escalation.id}>
                    <TableCell className="font-mono">
                      {escalation.alert_type_id}
                    </TableCell>
                    <TableCell>
                      <Badge className={getLevelColor(escalation.level)}>
                        Level {escalation.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {escalation.wait_time_minutes}m
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {escalation.contact_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {escalation.contact_type === "slack" ? (
                          <Hash className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Mail className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-sm">{escalation.contact_destination}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(escalation)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(escalation.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
