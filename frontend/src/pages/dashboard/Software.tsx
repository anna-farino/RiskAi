import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Pencil, Trash2, RotateCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { serverUrl } from "@/utils/server-url";

// Form Schema
const softwareSchema = z.object({
  name: z.string().min(1, "Software name is required"),
  vendor: z.string().min(1, "Vendor name is required"),
  version: z.string().min(1, "Version is required"),
});

type Software = {
  id: string;
  name: string;
  vendor: string;
  version: string;
  createdAt: string;
  updatedAt: string;
};

interface Action {
  id: string;
  softwareId: string;
  title: string;
  recommendation: string;
  severity: string;
}

export default function Software() {
  const [editingSoftware, setEditingSoftware] = useState<Software | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [softwareToDelete, setSoftwareToDelete] = useState<Software | null>(null);
  const [userCanModifySoftware, setUserCanModifySoftware] = useState(false);
  const { toast } = useToast();
  const { data: user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(()=>{
    if (user?.permissions) {
      setUserCanModifySoftware(user.permissions.includes("software:edit"))
    }
  },[])

  // Form
  const form = useForm<z.infer<typeof softwareSchema>>({
    resolver: zodResolver(softwareSchema),
    defaultValues: {
      name: "",
      vendor: "",
      version: "",
    },
  });

  // Set form values when editing
  useEffect(() => {
    if (editingSoftware) {
      setShowForm(true);
      form.reset({
        name: editingSoftware.name,
        vendor: editingSoftware.vendor,
        version: editingSoftware.version,
      });
    }
  }, [editingSoftware, form]);

  // Queries
  const { data: software, isLoading, refetch, isFetching } = useQuery<Software[]>({
    queryKey: ["/api/software"],
    staleTime: 1000 * 60 * 60 * 12,
    queryFn: async () => {
      const response = await fetch(`${serverUrl}/api/software`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch software');
      return response.json();
    },
  });

  // Query for actions to show vulnerability status
  const { data: actions } = useQuery<Action[]>({
    queryKey: ["/api/analyze-vulnerability"],
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    queryFn: async () => {
      const response = await fetch(`${serverUrl}/api/analyze-vulnerability`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch vulnerability analysis');
      return response.json();
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof softwareSchema>) => {
      if (!userCanModifySoftware) return
      const response = await fetch(`${serverUrl}/api/software`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create software");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/software"] });
      toast({
        title: "Success",
        description: "Software added successfully",
        duration: 2000
      });
      form.reset();
      setShowForm(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof softwareSchema>) => {
      if (!userCanModifySoftware) return
      if (!editingSoftware) return;
      const response = await fetch(
        `${serverUrl}/api/software/${editingSoftware.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error("Failed to update software");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/software"] });
      toast({
        title: "Success",
        description: "Software updated successfully",
        duration: 2000
      });
      setEditingSoftware(null);
      setShowForm(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userCanModifySoftware) return
      const response = await fetch(`${serverUrl}/api/software/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete software");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/software"] });
      toast({
        title: "Success",
        description: "Software deleted successfully",
        duration: 2000
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000
      });
    },
  });

  const onSubmit = (data: z.infer<typeof softwareSchema>) => {
    if (editingSoftware) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    setSoftwareToDelete(null);
  };

  const handleCreateNew = () => {
    setEditingSoftware(null);
    form.reset();
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingSoftware(null);
    setShowForm(false);
    form.reset();
  };

  // Function to get vulnerability info for a software
  const getVulnerabilityInfo = (softwareId: string) => {
    const affectingActions = actions?.filter(action => action.softwareId === softwareId);
    if (!affectingActions?.length) return null;

    const highestSeverity = affectingActions.reduce((highest, current) => {
      const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[current.severity as keyof typeof severityOrder] > severityOrder[highest.severity as keyof typeof severityOrder]
        ? current : highest;
    }, affectingActions[0]);

    return {
      isAffected: true,
      severity: highestSeverity.severity,
      title: highestSeverity.title,
    };
  };

  // Function to get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "CRITICAL":
        return "text-red-500";
      case "HIGH":
        return "text-orange-500";
      case "MEDIUM":
        return "text-yellow-500";
      case "LOW":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col md:flex-row gap-y-4 items-start md:items-center justify-between">
        <h1 className="text-4xl font-bold">Software Management</h1>
        {userCanModifySoftware && 
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={handleCreateNew}
              disabled={showForm}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Software
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                  <RotateCw className="h-4 w-4" />
                )}
              <span className="ml-2">Refresh List</span>
            </Button>
          </div>
        }
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingSoftware ? "Edit Software" : "Add New Software"}</CardTitle>
            <CardDescription>
              Enter the details of the software used in your company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Software Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter software name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter vendor name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter version" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingSoftware ? "Update Software" : "Add Software"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Software List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading || isFetching ? (
          <div className="col-span-full flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !software?.length ? (
          <div className="col-span-full text-center text-muted-foreground">
            No software added yet
          </div>
        ) : (
          software?.map((item) => {
            const vulnInfo = getVulnerabilityInfo(item.id);
            return (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{item.name}</span>
                      {userCanModifySoftware && 
                          <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingSoftware(item)}
                            className="h-fit w-fit px-2 py-2"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSoftwareToDelete(item)}
                            className="h-fit w-fit px-2 py-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      }
                  </CardTitle>
                  <CardDescription>{item.vendor}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm">Version: {item.version}</p>

                    {/* Vulnerability Status */}
                    {vulnInfo ? (
                      <div className="mt-2 p-3 bg-background/50 rounded-lg border">
                        <p className="text-sm font-medium flex items-center justify-between">
                          <span>Security Status:</span>
                          <span className={`font-semibold ${getSeverityColor(vulnInfo.severity)}`}>
                            {vulnInfo.severity}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {vulnInfo.title}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 p-3 bg-background/50 rounded-lg border">
                        <p className="text-sm text-green-500 font-medium">
                          No Known Vulnerabilities
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!softwareToDelete} onOpenChange={() => setSoftwareToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-semibold">{softwareToDelete?.name}</span>{" "}
              from your software list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => softwareToDelete?.id && handleDelete(softwareToDelete?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
