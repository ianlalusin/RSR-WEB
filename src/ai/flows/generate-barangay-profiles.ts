'use server';

/**
 * @fileOverview A flow to generate representative profiles for each barangay.
 *
 * - generateBarangayProfiles - A function that handles the generation of barangay profiles.
 * - GenerateBarangayProfilesInput - The input type for the generateBarangayProfiles function.
 * - GenerateBarangayProfilesOutput - The return type for the generateBarangayProfiles function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBarangayProfilesInputSchema = z.object({
  barangayName: z.string().describe('The name of the barangay.'),
  districtName: z.string().describe('The name of the district the barangay belongs to.'),
  population: z.number().describe('The population of the barangay.'),
  votingPopulation: z.number().describe('The voting population of the barangay.'),
  favoredVotePct: z.number().describe('The percentage of votes for the favored candidate.'),
});

export type GenerateBarangayProfilesInput = z.infer<
  typeof GenerateBarangayProfilesInputSchema
>;

const GenerateBarangayProfilesOutputSchema = z.object({
  profiles: z
    .array(z.record(z.string()))
    .describe('An array of representative profiles for the barangay.'),
});

export type GenerateBarangayProfilesOutput = z.infer<
  typeof GenerateBarangayProfilesOutputSchema
>;

export async function generateBarangayProfiles(
  input: GenerateBarangayProfilesInput
): Promise<GenerateBarangayProfilesOutput> {
  return generateBarangayProfilesFlow(input);
}

const generateBarangayProfilesPrompt = ai.definePrompt({
  name: 'generateBarangayProfilesPrompt',
  input: {schema: GenerateBarangayProfilesInputSchema},
  output: {schema: GenerateBarangayProfilesOutputSchema},
  prompt: `You are an expert in generating representative profiles for residents of a barangay based on statistical data.

  Given the following information about a barangay, generate a list of representative profiles (approximately 5-10) as JSON records, reflecting the demographics and voting preferences. Each profile should be a JSON record with realistic data based on the provided data. The goal is to create profiles for data visualization and potential scenarios.

  Barangay Name: {{{barangayName}}}
  District Name: {{{districtName}}}
  Population: {{{population}}}
  Voting Population: {{{votingPopulation}}}
  Favored Vote Percentage: {{{favoredVotePct}}}

  Output the profiles as a JSON array of JSON records.
  Ensure the generated data is realistic, reasonably follows normal statistical distributions for age, income, etc., and representative of the provided barangay statistics.

  Example output:
  [
    {
      "name": "Juan Dela Cruz",
      "age": 45,
      "occupation": "Teacher",
      "votedForFavored": true,
      "income": 300000
    },
   {
      "name": "Maria Santos",
      "age": 32,
      "occupation": "Nurse",
      "votedForFavored": false,
      "income": 450000
    }
  ]
  `,
});

const generateBarangayProfilesFlow = ai.defineFlow(
  {
    name: 'generateBarangayProfilesFlow',
    inputSchema: GenerateBarangayProfilesInputSchema,
    outputSchema: GenerateBarangayProfilesOutputSchema,
  },
  async input => {
    const {output} = await generateBarangayProfilesPrompt(input);
    return output!;
  }
);
