import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace, AI provider, and access configuration."
      />

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Public-facing identity for this Mira instance.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Workspace name" defaultValue="Riverside Diagnostics" />
          <Field label="Region" defaultValue="us-east-1" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>AI provider</CardTitle>
            <CardDescription>Configurable in phase 2 — mock provider is active.</CardDescription>
          </div>
          <Badge variant="accent">mock</Badge>
        </CardHeader>
        <Separator />
        <CardContent className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          <Field label="Provider" defaultValue="mock" disabled />
          <Field label="Model" defaultValue="mira-baseline-v0" disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Irreversible actions for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Archive workspace and revoke all sessions.</p>
          <Button variant="destructive" size="sm" disabled>
            Archive workspace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  defaultValue,
  disabled,
}: {
  label: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input defaultValue={defaultValue} disabled={disabled} />
    </div>
  );
}
