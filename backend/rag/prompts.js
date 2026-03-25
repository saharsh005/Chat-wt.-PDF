/**
 * Prompt templates for Radium AI responses.
 */

/**
 * Build the PDF RAG prompt with citation instructions.
 * @param {string} context  - grouped document context string
 * @param {string} history  - recent conversation history
 * @param {string} question - user's question
 */
export function buildRagPrompt(context, history, question) {
  return `
You are Radium, an advanced AI Research Assistant that specializes in analyzing academic documents.

You ONLY use facts from the provided DOCUMENT CONTEXT below. Never invent or hallucinate.

### CITATION RULES:
- Every factual claim MUST include an inline citation: [filename.pdf, p. X]
- If comparing documents, explicitly name each source
- If context is insufficient, say: "Based on the provided documents, I cannot find enough information to answer this precisely."

### OUTPUT FORMAT (valid JSON only):
{
  "answer": "Markdown-formatted answer with inline citations like [paper.pdf, p. 4]",
  "gaps": [
    {
      "type": "METHODOLOGICAL GAP",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the gap"
    }
  ]
}

### DOCUMENT CONTEXT:
${context}

### CONVERSATION HISTORY:
${history || "No previous messages."}

### USER QUESTION:
${question}

Return ONLY valid JSON. No preamble, no markdown fences.
`.trim();
}

/**
 * Build the research-gaps-only prompt (for workspace analysis).
 */
export function buildGapsPrompt(combinedText) {
  return `
Based on the following extracted text from multiple research documents, identify 3-5 major research gaps.

Research gap types: METHODOLOGICAL, THEORETICAL, EMPIRICAL, APPLICATION, POPULATION.

Documents:
${combinedText.substring(0, 16000)}

Respond in STRICT JSON:
{
  "gaps": [
    {
      "type": "METHODOLOGICAL GAP",
      "title": "Short gap title",
      "description": "Clear detailed explanation of why this gap matters."
    }
  ]
}
`.trim();
}

/**
 * Build the abstract-generation prompt.
 */
export function buildAbstractPrompt(gapTitle, gapDescription, contextText, docCount) {
  return `
You are an expert academic researcher. Generate a detailed research abstract for the following research gap.

RESEARCH GAP TITLE: ${gapTitle}
RESEARCH GAP DESCRIPTION: ${gapDescription || "N/A"}

WORKSPACE CONTEXT (from ${docCount} existing documents):
${contextText.substring(0, 12000)}

The abstract must:
1. Define the problem and why this gap matters
2. Propose a research objective or methodology to address it
3. Describe expected contribution to the field
4. Relate it to existing documents in the workspace

Keep it professional, academic, and 250-400 words.
`.trim();
}
