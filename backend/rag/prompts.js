/**
 * RAG prompt builder for Radium.
 *
 * Design principles:
 *
 * 1. STRICT GROUNDING — the model is explicitly forbidden from
 *    using outside knowledge. Every claim must trace to a [n] citation.
 *
 * 2. REAL CITATIONS — citations are [1], [2], … that map 1-to-1 to
 *    the numbered context blocks.  The model must NOT invent page
 *    numbers or paper names not present in context.
 *
 * 3. FORCED COMPARISON — when multiple documents are present, the
 *    model must compare them explicitly rather than answering per-doc.
 *
 * 4. HONEST GAPS — if the context does not contain enough information
 *    the model must say so, not hallucinate a plausible-sounding answer.
 *
 * 5. JSON OUTPUT — structured so chat.js can reliably parse answer,
 *    citations used, and any identified gaps.
 */

/**
 * @param {string} context       Numbered citation blocks from buildContext()
 * @param {string} historyText   Last N turns of conversation, pre-formatted
 * @param {string} question      The user's current question
 * @returns {string}             The full prompt string to send to the LLM
 */
export function buildRagPrompt(context, historyText, question) {
  return `You are Radium, a precise academic research assistant.

════════════════════════════════════════
CONTEXT — Retrieved document chunks
(Each block is numbered [1], [2], … with its source, page, and section)
════════════════════════════════════════
${context}
════════════════════════════════════════

${historyText ? `CONVERSATION HISTORY:\n${historyText}\n\n` : ""}QUESTION:
${question}

════════════════════════════════════════
STRICT RULES — you MUST follow all of these:
════════════════════════════════════════

1. USE ONLY THE PROVIDED CONTEXT.
   Do NOT use any outside knowledge. If the context does not contain
   enough information to answer fully, say so explicitly.

2. CITE EVERY CLAIM with [n] — the number of the context block it came from.
   Example: "InstructGPT uses PPO for fine-tuning [2]."
   NEVER invent page numbers like "p. 11" or "p. 30".
   NEVER cite a paper name that is not in the context blocks above.

3. COMPARE ACROSS DOCUMENTS when multiple sources are present.
   Do not answer each paper in isolation — synthesise and contrast.
   Example: "While InstructGPT uses PPO [2], DeepSeek-R1 uses GRPO [4],
   which removes the need for a critic network."

4. IF CONTEXT IS INSUFFICIENT, say:
   "The provided documents do not contain enough information about X."
   Do NOT fill the gap with hallucinated facts.

5. STRUCTURE your answer as:
   • Key Finding (1-2 sentences directly answering the question)
   • Detailed Comparison / Explanation (with inline [n] citations)
   • Gaps (list anything the question asked about that the context
     does NOT cover — be honest, do not fabricate)

════════════════════════════════════════
OUTPUT FORMAT — respond ONLY with valid JSON, no markdown fences:
════════════════════════════════════════
{
  "answer": "<full structured answer in Markdown, with inline [n] citations>",
  "citationsUsed": [1, 3, 5],
  "gaps": ["<topic not covered by context>", "..."]
}`;
}

/**
 * Builds the research-gaps prompt.
 */
export function buildGapsPrompt(contextText) {
  return `You are Radium, a research assistant that identifies open research gaps from the provided documents.

CONTEXT:
${contextText}

Instructions:
1. Identify up to 3 important research gaps or unanswered questions.
2. For each gap, provide a title and a short description.
3. Use only the information in the context. If the context is insufficient, return an empty gaps list.
4. Output valid JSON only.

Example output:
{
  "gaps": [
    {
      "title": "...",
      "description": "..."
    }
  ]
}`;
}

/**
 * Builds the abstract generation prompt.
 */
export function buildAbstractPrompt(gapTitle, gapDescription, contextText, pdfCount) {
  return `You are Radium, an academic research assistant.

The goal is to write a short abstract for a research direction based on the gap described below.

Gap Title: ${gapTitle}
Gap Description: ${gapDescription}

Context from ${pdfCount} PDF document(s):
${contextText}

Instructions:
- Use only the provided context.
- If the context does not contain enough information to write a useful abstract, say "Insufficient context to draft an abstract."
- Keep the abstract concise and academic.
- Do not invent details.

Write the abstract as a single paragraph.`;
}

/**
 * Builds the internet-search synthesis prompt (no citation-number rules,
 * since those chunks are not pre-numbered).
 */
export function buildInternetPrompt(paperContext, question) {
  return `You are Radium, an academic research assistant.

The following abstracts were retrieved from CrossRef and Semantic Scholar.
Use them to answer the question. Cite papers by their title and year.
If the abstracts are insufficient, say so — do not fabricate details.

RETRIEVED PAPERS:
${paperContext || "No abstracts available."}

QUESTION:
${question}

Write a clear, well-structured academic answer in Markdown.
Cite papers inline as (Author et al., Year) where possible.`;
}