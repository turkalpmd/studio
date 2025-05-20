'use server';

/**
 * @fileOverview This file defines a Genkit flow for providing real-time feedback on CPR compression rate.
 *
 * - CompressionFeedbackInput: Input type for the compression feedback flow.
 * - CompressionFeedbackOutput: Output type for the compression feedback flow.
 * - getCompressionFeedback: A function to get real-time feedback on CPR compression rate.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CompressionFeedbackInputSchema = z.object({
  compressionRate: z
    .number()
    .describe('The current compression rate in compressions per minute (CPM).'),
});
export type CompressionFeedbackInput = z.infer<typeof CompressionFeedbackInputSchema>;

const CompressionFeedbackOutputSchema = z.object({
  feedback: z
    .string()
    .describe(
      'Verbal feedback on the compression rate, such as "Press faster", "Good pace", or "Press slower".'
    ),
});
export type CompressionFeedbackOutput = z.infer<typeof CompressionFeedbackOutputSchema>;

export async function getCompressionFeedback(
  input: CompressionFeedbackInput
): Promise<CompressionFeedbackOutput> {
  return compressionFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'compressionFeedbackPrompt',
  input: {schema: CompressionFeedbackInputSchema},
  output: {schema: CompressionFeedbackOutputSchema},
  prompt: `You are a CPR coach providing real-time feedback on chest compression rate.

  The current compression rate is {{{compressionRate}}} CPM.

  Provide feedback to help the user maintain a compression rate of 100-120 CPM. Be concise.

  Examples:
  - If the compression rate is below 100 CPM, respond with "Press faster".
  - If the compression rate is above 120 CPM, respond with "Press slower".
  - If the compression rate is between 100 and 120 CPM, respond with "Good pace".`,
});

const compressionFeedbackFlow = ai.defineFlow(
  {
    name: 'compressionFeedbackFlow',
    inputSchema: CompressionFeedbackInputSchema,
    outputSchema: CompressionFeedbackOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
