import { GoogleGenAI } from "@google/genai";

// Initialize the GoogleGenAI instance.
// It automatically looks for the GEMINI_API_KEY or VITE_GEMINI_API_KEY environment variable.
const ai = new GoogleGenAI({});

/**
 * Calls the Gemini model to continue the text based on the provided context.
 * @param context The text content from the ProseMirror editor.
 * @returns A promise that resolves to the generated text snippet.
 */
export async function getAutocompletion(context: string): Promise<string> {
  // A system instruction to guide the model's behavior.
  const systemInstruction = "You are an AI writing assistant. Your task is to continue the provided text naturally and coherently. Only output the continuation text, do not repeat the original prompt or add any introductory phrases. Keep the continuation concise (e.g., 2-4 sentences).";

  // The prompt for the model.
  const prompt = `Continue the following text: "${context}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // A fast model suitable for text completion
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        // Set a low temperature for more deterministic/logical continuations
        temperature: 0.5,
        // Set a max output length for brevity
        maxOutputTokens: 100,
      }
    });

    // Clean up the generated text to remove potential leading/trailing whitespace
    const generatedText = response.text.trim();
    
    // Add a space at the beginning if the completion doesn't start with one,
    // to ensure a smooth transition when inserting it into the editor.
    return generatedText.startsWith(' ') || generatedText.length === 0 ? generatedText : ` ${generatedText}`;

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Throw a specific error for the XState machine to catch
    throw new Error("Failed to get autocompletion from the AI.");
  }
}

