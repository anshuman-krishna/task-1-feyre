import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Droplet, HeartPulse, Mail, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "@/components/risk-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ageFromDob, formatDate, initials } from "@/lib/format";
import { prisma } from "@/server/prisma";
import { listPatientActivity } from "@/services/activity";
import { hasBiomarkers } from "@/services/prediction";
import { PredictionCard } from "@/features/predictions/components/prediction-card";
import { PredictionTimeline } from "@/features/predictions/components/prediction-timeline";
import { NoteList } from "@/features/notes/components/note-list";
import { ActivityFeed } from "@/features/activity/components/activity-feed";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [patient, notes, predictions, activity] = await Promise.all([
    prisma.patient.findUnique({ where: { id } }),
    prisma.note.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" } }),
    prisma.predictionLog.findMany({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    listPatientActivity(id),
  ]);

  if (!patient || patient.archivedAt) notFound();

  const latest = predictions[0]
    ? {
        id: predictions[0].id,
        riskLevel: predictions[0].riskLevel,
        condition: predictions[0].condition,
        confidence: predictions[0].confidence,
        summary: predictions[0].summary,
        recommendations: predictions[0].recommendations as string[],
        observations: predictions[0].observations as {
          label: string;
          value: number | null;
          status: "ok" | "watch" | "elevated" | "critical";
          hint: string;
        }[],
        provider: predictions[0].provider,
        model: predictions[0].model,
        createdAt: predictions[0].createdAt.toISOString(),
      }
    : null;

  const timelineEntries = predictions.map((p) => ({
    id: p.id,
    provider: p.provider,
    riskLevel: p.riskLevel,
    condition: p.condition,
    confidence: p.confidence,
    summary: p.summary,
    latencyMs: p.latencyMs,
    error: p.error,
    createdAt: p.createdAt.toISOString(),
  }));

  const activityEntries = activity.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/patients" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Patients
        </Link>
        <span>/</span>
        <span className="text-foreground">{patient.fullName}</span>
      </div>

      <PageHeader
        title={patient.fullName}
        description={`Patient record · created ${formatDate(patient.createdAt)}`}
        actions={
          <>
            <Button variant="outline" size="sm" disabled>
              Edit
            </Button>
            <Button size="sm" disabled>
              <Sparkles className="h-3.5 w-3.5" /> Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {initials(patient.fullName)}
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base">{patient.fullName}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {patient.email}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {ageFromDob(patient.dob)} yrs · DOB{" "}
                    {formatDate(patient.dob)}
                  </span>
                  {patient.sex && <span className="capitalize">{patient.sex}</span>}
                </CardDescription>
              </div>
            </div>
            <RiskBadge level={patient.riskLevel} />
          </CardHeader>
          <Separator />
          <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-6">
            <Biomarker icon={<Droplet className="h-3 w-3" />} label="Glucose" value={patient.glucose} unit="mg/dL" />
            <Biomarker label="Haemoglobin" value={patient.haemoglobin} unit="g/dL" />
            <Biomarker label="Cholesterol" value={patient.cholesterol} unit="mg/dL" />
            <Biomarker
              icon={<HeartPulse className="h-3 w-3" />}
              label="BP"
              value={
                patient.systolic && patient.diastolic
                  ? `${patient.systolic}/${patient.diastolic}`
                  : null
              }
              unit="mmHg"
            />
            <Biomarker label="BMI" value={patient.bmi} unit="kg/m²" />
            <Biomarker
              label="Last predicted"
              value={patient.lastPredictedAt ? formatDate(patient.lastPredictedAt) : null}
            />
          </CardContent>
        </Card>

        <PredictionCard
          patientId={patient.id}
          latest={latest}
          hasBiomarkers={hasBiomarkers(patient)}
        />
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          <PredictionTimeline entries={timelineEntries} />
        </TabsContent>
        <TabsContent value="notes">
          <NoteList
            patientId={patient.id}
            initial={notes.map((n) => ({
              id: n.id,
              body: n.body,
              author: n.author,
              createdAt: n.createdAt.toISOString(),
            }))}
          />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityFeed
            entries={activityEntries}
            title="Activity"
            description="All events on this patient record."
            compact
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Biomarker({
  icon,
  label,
  value,
  unit,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number | string | null;
  unit?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="font-mono text-sm text-foreground">
        {value == null || value === "" ? "—" : String(value)}
        {value != null && unit ? (
          <span className="ml-1 font-sans text-[10px] text-muted-foreground">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}
