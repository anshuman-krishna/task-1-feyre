import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const order: { key: string; label: string; unit: string }[] = [
  { key: "glucose", label: "Glucose", unit: "mg/dL" },
  { key: "haemoglobin", label: "Haemoglobin", unit: "g/dL" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg/dL" },
  { key: "systolic", label: "Systolic", unit: "mmHg" },
  { key: "diastolic", label: "Diastolic", unit: "mmHg" },
  { key: "bmi", label: "BMI", unit: "kg/m²" },
];

export function BiomarkerAverages({ averages }: { averages: Record<string, number | null> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Biomarker averages</CardTitle>
        <CardDescription>Across all active patients with values present.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {order.map((m) => {
          const v = averages[m.key];
          return (
            <div key={m.key} className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {m.label}
              </p>
              <p className="font-mono text-lg text-foreground">
                {v == null ? "—" : v.toFixed(1)}
                <span className="ml-1 font-sans text-[10px] text-muted-foreground">{m.unit}</span>
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
