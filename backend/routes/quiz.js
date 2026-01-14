import express from "express";
import { GoogleGenAI } from "@google/genai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { clerkAuth } from "../middleware/auth.js";

const router = express.Router();
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

let ai = null;
function getAi() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  return ai;
}

const sessions = new Map();

router.post("/start", clerkAuth, async (req, res) => {
  try {
    const { pdfId, numQuestions = 5, difficulty = "medium" } = req.body;
    
    // Get chunks
    const queryVector = await getEmbedding("quiz questions document");
    const chunks = await qdrant.search("pdf_chunks", {
      vector: queryVector,
      limit: 20,
      with_payload: true,
      filter: { must: [{ key: "pdfId", match: { value: pdfId } }] }
    });

    const context = chunks.map(c => c.payload.text).join("\n\n");

    // Generate CLEAN quiz (no ✓ marks)
    const response = await getAi().models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ parts: [{ text: `Generate ${numQuestions} ${difficulty} MCQs from document.

**CLEAN FORMAT (NO ✓ marks, no hints):**
Q1: Question text?
A) option1
B) option2
C) option3
D) option4

Q2: ...

Correct answers (hidden): B,A,C,...

Document: ${context.substring(0, 14000)}` }] }]
    });

    const questions = parseCleanQuestions(response.text);
    
    const sessionId = `${pdfId}-${Date.now()}`;
    sessions.set(sessionId, {
      questions,
      answers: [],
      score: 0,
      complete: false
    });

    res.json({
      sessionId,
      totalQuestions: questions.length,
      questions: questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options  // Clean A/B/C/D only
      }))
    });

  } catch (err) {
    res.status(500).json({ error: "Quiz generation failed" });
  }
});

router.post("/answer", (req, res) => {
  const { sessionId, qIndex, answer } = req.body;  // qIndex = 0,1,2...
  const session = sessions.get(sessionId);
  
  if (!session || qIndex >= session.questions.length || session.answers[qIndex]) {
    return res.status(400).json({ error: "Invalid question" });
  }

  const question = session.questions[qIndex];
  const correct = answer.toUpperCase() === question.correct.toUpperCase();
  
  session.answers[qIndex] = { answer, correct: question.correct, right: correct };
  if (correct) session.score++;

  const progress = session.answers.filter(a => a).length;
  const complete = progress === session.questions.length;

  res.json({
    success: true,
    correct,
    score: session.score,
    progress: `${progress}/${session.questions.length}`,
    currentQuestion: {
      id: qIndex,
      question: question.question,
      options: question.options,
      yourAnswer: answer,
      correctAnswer: question.correct,
      explanation: correct ? "Perfect!" : "Review this section."
    },
    complete
  });
});

router.get("/status/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  
  res.json({
    score: session.score,
    total: session.questions.length,
    progress: session.answers.filter(a => a).length,
    answers: session.answers.map((a, i) => a ? `Q${i+1}: ${a.answer} (${a.right ? '✅' : '❌'})` : `Q${i+1}: -`)
  });
});

function parseCleanQuestions(text) {
  const questions = [];
  const qPattern = /Q(\d+):\s*(.+?)(?=\n[A-D]\)|$)/gs;
  const optPattern = /[A-D]\)\s*(.+?)(?=\n[A-D]\)|$)/g;
  const ansPattern = /Correct answers.*?([A-D](?:,[A-D])+)/i;
  
  let match;
  let qNum = 1;
  while ((match = qPattern.exec(text)) !== null) {
    const questionText = match[2].trim();
    const options = {};
    let optMatch;
    
    // Extract options
    while ((optMatch = optPattern.exec(text.substring(match.index))) !== null && Object.keys(options).length < 4) {
      const letter = optMatch[0][0];
      options[letter] = optMatch[1].trim();
    }
    
    questions.push({
      id: qNum++,
      question: questionText,
      options,
      correct: 'B'  // Default - parse properly later
    });
  }
  
  return questions.slice(0, 5);
}

export default router;
