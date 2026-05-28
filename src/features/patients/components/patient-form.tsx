"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BiomarkerInput } from "./biomarker-input";
import { PatientCreateSchema, type PatientCreateInput } from "../schema";
import { useCreatePatient } from "../queries";

export function PatientForm() {
  const router = useRouter();
  const create = useCreatePatient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatientCreateInput>({
    resolver: zodResolver(PatientCreateSchema),
    defaultValues: {
      fullName: "",
      email: "",
      dob: "",
      sex: undefined,
      glucose: null,
      haemoglobin: null,
      cholesterol: null,
      systolic: null,
      diastolic: null,
      bmi: null,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const patient = await create.mutateAsync(values);
      toast.success("Patient created", {
        description: patient.aiPrediction
          ? `AI observation: ${patient.aiPrediction}`
          : "No biomarkers were provided — prediction skipped.",
      });
      router.push(`/patients/${patient.id}`);
    } catch (err) {
      toast.error("Could not create patient", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  });

  const biomarkerBound = (key: keyof PatientCreateInput) => ({
    value: (watch(key) as number | null | undefined)?.toString() ?? "",
    onChange: (v: string) =>
      setValue(key, (v === "" ? null : Number(v)) as never, { shouldValidate: true }),
  });

  const sexValue = (watch("sex") as string | null | undefined) ?? undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Demographics shown on the patient record.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.fullName?.message}>
            <Input {...register("fullName")} placeholder="e.g. Naomi Carter" autoFocus />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} placeholder="patient@email.com" />
          </Field>
          <Field label="Date of birth" error={errors.dob?.message}>
            <Input type="date" {...register("dob")} />
          </Field>
          <Field label="Sex" error={errors.sex?.message as string | undefined}>
            <Select
              value={sexValue}
              onValueChange={(v) => setValue("sex", v as "male" | "female" | "other")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Diagnostic panel</CardTitle>
            <CardDescription>
              Provided values trigger an automatic AI prediction on save.
            </CardDescription>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            <Sparkles className="h-3 w-3" /> auto-predict
          </span>
        </CardHeader>
        <Separator />
        <CardContent className="grid grid-cols-1 gap-5 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <BiomarkerInput
            name="glucose"
            label="Fasting glucose"
            unit="mg/dL"
            {...biomarkerBound("glucose")}
          />
          <BiomarkerInput
            name="haemoglobin"
            label="Haemoglobin"
            unit="g/dL"
            step="0.1"
            {...biomarkerBound("haemoglobin")}
          />
          <BiomarkerInput
            name="cholesterol"
            label="Total cholesterol"
            unit="mg/dL"
            {...biomarkerBound("cholesterol")}
          />
          <BiomarkerInput
            name="systolic"
            label="Systolic BP"
            unit="mmHg"
            step="1"
            {...biomarkerBound("systolic")}
          />
          <BiomarkerInput
            name="diastolic"
            label="Diastolic BP"
            unit="mmHg"
            step="1"
            {...biomarkerBound("diastolic")}
          />
          <BiomarkerInput
            name="bmi"
            label="BMI"
            unit="kg/m²"
            step="0.1"
            {...biomarkerBound("bmi")}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p>
          Predictions are AI-generated risk signals. They are not diagnoses and should be reviewed by
          a clinician.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save patient"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground">{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
