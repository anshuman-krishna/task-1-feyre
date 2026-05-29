import { prisma } from "@/server/prisma";

// search abstraction. v1 is keyword over patient name/email/condition +
// notes + cached summary text. the SearchClient interface is the seam:
// when pgvector lands, embeddings.search() drops in alongside keyword().

export type SearchHit = {
  kind: "patient" | "note" | "summary" | "observation";
  patientId: string;
  patientName: string;
  title: string;
  snippet: string;
  score: number;
};

export interface SearchClient {
  search(query: string, opts: { organizationId: string; limit?: number }): Promise<SearchHit[]>;
}

class KeywordSearchClient implements SearchClient {
  async search(
    query: string,
    opts: { organizationId: string; limit?: number },
  ): Promise<SearchHit[]> {
    const q = query.trim();
    if (q.length === 0) return [];
    const limit = opts.limit ?? 12;
    const ilike = `%${q}%`;

    const [patients, notes, summaries] = await Promise.all([
      prisma.patient.findMany({
        where: {
          organizationId: opts.organizationId,
          archivedAt: null,
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { aiPrediction: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: { id: true, fullName: true, aiPrediction: true, riskLevel: true },
      }),
      prisma.note.findMany({
        where: {
          body: { contains: q, mode: "insensitive" },
          patient: { organizationId: opts.organizationId },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { patient: { select: { id: true, fullName: true } } },
      }),
      prisma.patientSummary.findMany({
        where: {
          patient: { organizationId: opts.organizationId },
          OR: [
            { overview: { contains: q, mode: "insensitive" } },
            { trajectory: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        include: { patient: { select: { id: true, fullName: true } } },
      }),
    ]);

    const hits: SearchHit[] = [];

    for (const p of patients) {
      hits.push({
        kind: "patient",
        patientId: p.id,
        patientName: p.fullName,
        title: p.fullName,
        snippet: p.aiPrediction ?? `Risk: ${p.riskLevel ?? "unassessed"}`,
        score: score(q, p.fullName) + 4,
      });
    }
    for (const n of notes) {
      hits.push({
        kind: "note",
        patientId: n.patient.id,
        patientName: n.patient.fullName,
        title: `Note on ${n.patient.fullName}`,
        snippet: excerpt(n.body, q),
        score: score(q, n.body) + 2,
      });
    }
    for (const s of summaries) {
      hits.push({
        kind: "summary",
        patientId: s.patient.id,
        patientName: s.patient.fullName,
        title: `Summary — ${s.patient.fullName}`,
        snippet: excerpt(`${s.overview} ${s.trajectory}`, q),
        score: score(q, s.overview) + 3,
      });
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, limit);

    function score(qq: string, hay: string) {
      const lcQ = qq.toLowerCase();
      const lcH = hay.toLowerCase();
      if (lcH.startsWith(lcQ)) return 10;
      if (lcH.includes(` ${lcQ}`)) return 6;
      if (lcH.includes(lcQ)) return 3;
      return 1;
    }

    function excerpt(text: string, qq: string) {
      const idx = text.toLowerCase().indexOf(qq.toLowerCase());
      if (idx < 0) return text.slice(0, 120);
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + qq.length + 80);
      return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    }

    // unused helper retained for future pg trigram path
    void ilike;
  }
}

// vector-ready interface kept as a stub. when an embedding provider is
// wired, swap the default exported instance for a hybrid client that
// combines keyword + cosine similarity over PatientSummary embeddings.
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

class NullEmbeddingProvider implements EmbeddingProvider {
  async embed(): Promise<number[]> {
    return [];
  }
}

export const searchClient: SearchClient = new KeywordSearchClient();
export const embeddings: EmbeddingProvider = new NullEmbeddingProvider();
