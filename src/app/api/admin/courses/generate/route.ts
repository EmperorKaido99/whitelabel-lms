import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  try {
    if (ext === "pdf") {
      // pdf-parse is a CommonJS module
      const mod = await import("pdf-parse");
      const pdfParse = (mod as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ?? mod;
      const result = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
      return result.text.slice(0, 15000);
    }
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.slice(0, 15000);
    }
    if (ext === "xlsx") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      let text = "";
      for (const name of wb.SheetNames) {
        text += `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}\n\n`;
      }
      return text.slice(0, 15000);
    }
    if (ext === "pptx") {
      // PPTX is a ZIP — extract text from slide XMLs
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      let text = "";
      const slides = Object.keys(zip.files)
        .filter((n) => /ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort();
      for (const slide of slides) {
        const xml = await zip.files[slide].async("string");
        const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)];
        const slideText = matches
          .map((m) => m[1])
          .join(" ")
          .trim();
        if (slideText) text += slideText + "\n";
      }
      return text.slice(0, 15000);
    }
  } catch (err) {
    console.warn(`[generate] Failed to extract from ${file.name}:`, err);
  }

  return "";
}

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Could not parse form data." }, { status: 400 });
    }

    const description = (formData.get("description") as string) ?? "";
    const references = (formData.get("references") as string) ?? "";
    const files = formData.getAll("files") as File[];

    if (!description.trim() && files.length === 0 && !references.trim()) {
      return NextResponse.json(
        { error: "Please provide a course description or upload source materials." },
        { status: 400 }
      );
    }

    // Extract text from all uploaded files in parallel
    const extractions = await Promise.all(
      files.map(async (f) => {
        const text = await extractTextFromFile(f);
        return text ? `\n--- Content from ${f.name} ---\n${text}` : "";
      })
    );
    const extractedText = extractions.filter(Boolean).join("\n");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured. Add it to your .env.local file." },
        { status: 500 }
      );
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system:
        "You are an expert instructional designer creating professional e-learning courses. Generate engaging, educational content that is clear, practical, and well-structured. Always return valid JSON only — no markdown, no explanation.",
      messages: [{ role: "user", content: buildPrompt(description, references, extractedText) }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";

    let courseData: unknown;
    try {
      // Handle both raw JSON and ```json ... ``` wrapper
      const jsonMatch =
        raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      courseData = JSON.parse(jsonMatch[1]);
    } catch (parseErr) {
      console.error("[generate] JSON parse error:", parseErr, "\nRaw:", raw.slice(0, 500));
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, course: courseData });
  } catch (err) {
    console.error("[generate]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Generation failed: ${msg}` }, { status: 500 });
  }
}

function buildPrompt(description: string, references: string, extractedText: string): string {
  const parts: string[] = [];

  if (description) parts.push(`Course Description:\n${description}`);
  if (references) parts.push(`Reference Materials:\n${references}`);
  if (extractedText) parts.push(`Source Content:${extractedText}`);

  parts.push(`
Generate a complete course structure. Return ONLY a valid JSON object matching this exact schema:

{
  "title": "Concise, engaging course title",
  "description": "2–3 sentence course description",
  "targetAudience": "Who this course is for",
  "estimatedDuration": "Total time e.g. '2 hours'",
  "objectives": [
    "Learners will be able to...",
    "Learners will understand...",
    "Learners will demonstrate..."
  ],
  "lessons": [
    {
      "title": "Lesson title",
      "description": "One sentence lesson description",
      "estimatedDuration": "15 minutes",
      "content": "<h2>Lesson Title</h2>\\n<p>Full lesson content in HTML…</p>",
      "keyTakeaways": ["Key point 1", "Key point 2"],
      "quiz": [
        {
          "question": "Question text?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctIndex": 0,
          "explanation": "Why this answer is correct"
        }
      ]
    }
  ]
}

Requirements:
- 3–5 clear learning objectives
- 3–6 lessons
- Lesson HTML: 350–600 words using <h2>, <h3>, <p>, <ul>, <ol>, <blockquote>, <strong>, <em>
- 2–3 multiple choice questions per lesson (4 options each)
- Quiz questions must test comprehension, not just recall
- Content must be professional, practical, and directly relevant to the subject`);

  return parts.join("\n\n");
}
