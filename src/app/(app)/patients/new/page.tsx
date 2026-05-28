import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PatientForm } from "@/features/patients/components/patient-form";

export const metadata = { title: "New patient" };

export default function NewPatientPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/patients" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Patients
        </Link>
        <span>/</span>
        <span className="text-foreground">New patient</span>
      </div>

      <PageHeader
        title="Add patient"
        description="Capture demographics and a diagnostic panel. We'll run the prediction layer on save."
      />

      <PatientForm />
    </div>
  );
}
