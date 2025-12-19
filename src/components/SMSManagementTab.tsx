import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Users, Phone, ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface OptedInEmployee {
  id: string;
  full_name: string;
  phone: string;
  sms_opted_in_at: string;
}

interface SMSMessage {
  id: string;
  direction: string;
  phone_number: string;
  message: string;
  status: string;
  parsed_intent: string | null;
  created_at: string;
  profile_id: string | null;
  profiles?: { full_name: string } | null;
}

export function SMSManagementTab() {
  const [loading, setLoading] = useState(true);
  const [optedInEmployees, setOptedInEmployees] = useState<OptedInEmployee[]>([]);
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) return;

      // Get total employees in company
      const { count: total } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("company_id", profile.company_id);

      setTotalEmployees(total || 0);

      // Get opted-in employees
      const { data: optedIn } = await supabase
        .from("profiles")
        .select("id, full_name, phone, sms_opted_in_at")
        .eq("company_id", profile.company_id)
        .eq("sms_opted_in", true)
        .not("phone", "is", null);

      setOptedInEmployees(optedIn || []);

      // Get SMS messages for company
      const { data: smsMessages } = await supabase
        .from("sms_messages")
        .select(`
          id,
          direction,
          phone_number,
          message,
          status,
          parsed_intent,
          created_at,
          profile_id,
          profiles (full_name)
        `)
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(50);

      setMessages(smsMessages || []);
    } catch (error: any) {
      toast({
        title: "Error loading SMS data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedEmployee || !messageText.trim()) {
      toast({
        title: "Missing information",
        description: "Please select an employee and enter a message",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          profileId: selectedEmployee,
          message: messageText.trim(),
          messageType: "manager_message",
        },
      });

      if (error) throw error;

      toast({
        title: "Message sent",
        description: "SMS sent successfully",
      });

      setMessageText("");
      setSelectedEmployee("");
      loadData(); // Refresh message list
    } catch (error: any) {
      toast({
        title: "Failed to send SMS",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 4) return phone;
    return `***-***-${phone.slice(-4)}`;
  };

  const optInRate = totalEmployees > 0 
    ? Math.round((optedInEmployees.length / totalEmployees) * 100) 
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading SMS data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              SMS Opt-in Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{optInRate}%</div>
            <p className="text-xs text-muted-foreground">
              {optedInEmployees.length} of {totalEmployees} employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-accent" />
              Active Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{optedInEmployees.length}</div>
            <p className="text-xs text-muted-foreground">Ready to receive SMS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.filter(m => m.direction === "outbound").length}
            </div>
            <p className="text-xs text-muted-foreground">Last 50 messages</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Send Message Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Message
            </CardTitle>
            <CardDescription>
              Send an SMS to an opted-in team member
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {optedInEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({maskPhone(emp.phone)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <Textarea
                placeholder="Type your message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                maxLength={160}
                rows={3}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{messageText.length}/160 characters</span>
                <span>1 SMS segment</span>
              </div>
            </div>

            <Button
              onClick={handleSendMessage}
              disabled={sending || !selectedEmployee || !messageText.trim()}
              className="w-full"
            >
              {sending ? "Sending..." : "Send SMS"}
            </Button>
          </CardContent>
        </Card>

        {/* Opted-in Employees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Opted-in Employees
            </CardTitle>
            <CardDescription>
              Team members receiving SMS notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {optedInEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No employees have opted in to SMS yet
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {optedInEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <div>
                      <p className="font-medium text-sm">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {maskPhone(emp.phone)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {emp.sms_opted_in_at
                        ? format(new Date(emp.sms_opted_in_at), "MMM d")
                        : "Active"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Message History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message History
              </CardTitle>
              <CardDescription>Recent SMS activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Direction</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <Badge
                        variant={msg.direction === "outbound" ? "default" : "secondary"}
                        className="flex items-center gap-1 w-fit"
                      >
                        {msg.direction === "outbound" ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3" />
                        )}
                        {msg.direction === "outbound" ? "Out" : "In"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {msg.profiles?.full_name || maskPhone(msg.phone_number)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {msg.message}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={msg.status === "sent" ? "default" : "outline"}
                      >
                        {msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {msg.parsed_intent && (
                        <Badge variant="outline">{msg.parsed_intent}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(msg.created_at), "MMM d, h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
