import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PatientTable } from "@/features/patients/components/patient-table";

export const metadata = { title: "Patients" };

export default function PatientsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description="All patients across the workspace. AI risk signals appear in-line."
        actions={
          <>
            <Button variant="outline" size="sm" disabled>
              Import CSV
            </Button>
            <Button asChild size="sm">
              <Link href="/patients/new">New patient</Link>
            </Button>
          </>
        }
      />
      <PatientTable />
    </div>
  );
}
