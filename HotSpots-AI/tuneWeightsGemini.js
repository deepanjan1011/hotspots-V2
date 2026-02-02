import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';

const require = createRequire(import.meta.url);
const samples = require('./samples.json');
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

async function main() {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Here are some zones:
${JSON.stringify(samples, null, 2)}

Suggest new values for w1, w2, w3 in the formula:
  V = w1*norm(temp) - w2*norm(ndvi) + w3*norm(bldDensity)
to improve hotspot accuracy.
to improve hotspot accuracy.
Respond with JSON exactly like: { "w1": 0.5, "w2": 0.3, "w3": 0.2 }.
Output ONLY valid JSON. No markdown, no explanation, no formatting.
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 8000
      }
    });

    console.log('Full API response:', JSON.stringify(response, null, 2));

    let text = typeof response.text === 'function' ? response.text() : response.text;
    if (!text && response.candidates && response.candidates[0].content.parts) {
      text = response.candidates[0].content.parts.map(p => p.text).join('');
    }
    console.log('Raw text reply:\n', text);

    text = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    console.log('Cleaned JSON text:\n', text);


    console.log('Raw text reply:\n', text);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    console.log('Cleaned JSON text:\n', text);

    try {
      const weights = JSON.parse(text);
      console.log('➜ New weights:', weights);

      // Save to file
      const fs = require('fs');
      const path = require('path');
      const weightsPath = path.join(process.cwd(), 'server', 'weights.json');
      fs.writeFileSync(weightsPath, JSON.stringify(weights, null, 2));
      console.log('✔ Saved weights to', weightsPath);
    } catch (parseErr) {
      console.error("Failed to parse JSON:", parseErr);
      // Fallback or retry logic could go here
    }

  } catch (err) {
    console.error('Error calling Gemini:', err);
    process.exit(1);
  }
}

main();
