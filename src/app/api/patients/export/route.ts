import { withErrorHandling } from "@/server/handler";
import { patientsCsv } from "@/services/export";
import { getCurrentUser } from "@/server/session";

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  const body = await patientsCsv(user ? { id: user.id, name: user.name } : null);
  const filename = `mira-patients-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
