import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import OpenAI from 'openai';
import schemes from './schemes.json' with { type: 'json' };
import { catalogStatus, getCatalog, startCatalogSync, syncCatalog } from './catalog-sync.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const clean = (value) => String(value || '').trim().toLowerCase();

function matchesEligibility(profile, scheme) {
  const rules = scheme.rules || {};
  const occupation = clean(profile.occupation);
  const category = clean(profile.category);
  const education = clean(profile.education);
  const text = clean(profile.keywords);

  if (rules.occupations && (!occupation || !rules.occupations.includes(occupation))) return false;
  if (rules.categories && (!category || !rules.categories.includes(category))) return false;
  if (rules.maxIncome && profile.income && Number(profile.income) > rules.maxIncome) return false;
  if (rules.education && education && !rules.education.includes(education)) return false;
  if (rules.keywords && !rules.keywords.some((keyword) => text.includes(keyword))) return false;
  if (profile.requestedTypes?.length && !profile.requestedTypes.some((type) => clean(scheme.type).includes(type))) return false;
  return true;
}

function demoProfile(text) {
  const input = clean(text);
  const age = Number(input.match(/(?:age|aged|i'm|i am)\s*(\d{1,2})/)?.[1]) || null;
  const incomeMatch = input.match(/(?:income|earn(?:ing)?|salary)\D{0,15}(?:₹|rs\.?\s*)?([\d,.]+)\s*(lakh|lakhs|k)?/);
  let income = incomeMatch ? Number(incomeMatch[1].replace(/,/g, '')) : null;
  if (incomeMatch?.[2]?.startsWith('lakh')) income *= 100000;
  
  // Comprehensive state detection for demo mode
  let state = null;
  const statesList = ['andhra pradesh', 'telangana', 'karnataka', 'tamil nadu', 'maharashtra', 'kerala', 'delhi', 'uttar pradesh', 'gujarat', 'bihar', 'west bengal', 'odisha', 'punjab', 'rajasthan', 'madhya pradesh'];
  for (const s of statesList) {
    if (input.includes(s) || (s === 'andhra pradesh' && /\bap\b/.test(input)) || (s === 'tamil nadu' && /\btn\b/.test(input)) || (s === 'maharashtra' && /\bmh\b/.test(input))) {
      state = s.replace(/\b\w/g, c => c.toUpperCase());
      break;
    }
  }

  const category = ['ews', 'sc', 'st', 'obc', 'general'].find((item) => new RegExp(`\\b${item}\\b`).test(input))?.toUpperCase() || null;
  const occupation = /student|b\.?tech|college|university|undergraduate/.test(input) ? 'student' : /graduate|passed out|alumni/.test(input) ? 'graduate' : /street vendor|vendor|hawker/.test(input) ? 'street vendor' : /self.?employed|small business/.test(input) ? 'self employed' : /farmer|agriculturist/.test(input) ? 'farmer' : null;
  const education = /b\.?tech|engineering/.test(input) ? 'b.tech' : /post.?graduate|master|m\.?(?:tech|sc|a)/.test(input) ? 'postgraduate' : /diploma|polytechnic/.test(input) ? 'diploma' : /college|university|undergraduate|student/.test(input) ? 'undergraduate' : /school|class\s*(?:[6-9]|1[0-2])/.test(input) ? 'school' : null;
  const requestedTypes = ['internship', 'scholarship', 'loan', 'fee reimbursement'].filter((type) => input.includes(type));
  return { age, occupation, state, category, income, education, requestedTypes, keywords: input };
}

app.post('/api/analyze-intake', async (req, res) => {
  const intake = String(req.body?.intake || '').trim();
  if (intake.length < 5) {
    return res.status(400).json({ error: 'Please share a little more about your background.' });
  }

  try {
    let profile;
    let candidateSchemes = [];

    // 1. Dynamic AI Generation: Automatically fetch all central, state, and private/corporate schemes on the fly
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { 
            role: 'system', 
            content: `You are SetuAI, an autonomous welfare, scholarship, and internship opportunity discovery engine for India. 
            Analyze the user's background text. 
            1. Extract their profile JSON: {"age": number|null, "occupation": string|null, "state": string|null, "category": string|null, "income": number|null}.
            2. Automatically search and generate 6 to 10 highly relevant opportunities matching their profile. Include Central Government schemes, state schemes for their mentioned location, and private corporate scholarships or tech internships.
            Return a JSON object with this exact structure:
            {
              "profile": { ... },
              "schemes": [
                {
                  "id": "kebab-case-unique-id",
                  "title": "Official Scheme or Internship Title",
                  "level": "Central / State Name / Private / Corporate",
                  "department": "Ministry or Company Name",
                  "benefit": "Detailed financial benefit or monthly stipend",
                  "accent": "indigo",
                  "attachments": ["Income certificate", "Resume / ID Card", "Academic transcripts"],
                  "rules": { "states": ["state_name_or_central"] }
                }
              ]
            }` 
          },
          { role: 'user', content: intake }
        ]
      });

      const aiResult = JSON.parse(response.choices[0].message.content);
      profile = aiResult.profile || demoProfile(intake);
      
      // AI extracts the profile only. Opportunities always come from our verified catalog.
      candidateSchemes = await getCatalog();
    } else {
      // Fallback to local schemes if no OpenAI key
      profile = demoProfile(intake);
      candidateSchemes = await getCatalog();
    }

    // A dropdown selection is authoritative; it avoids relying on text/AI state detection.
    if (req.body?.selectedState) profile.state = String(req.body.selectedState).trim();

    // 2. Location rule: state chosen -> that state + Central/National/Private only.
    // No state -> return the complete India-wide catalog.
    let matchedSchemes = candidateSchemes.filter((scheme) => {
      if (!matchesEligibility(profile, scheme)) return false;
      const level = clean(scheme.level || '');
      const providerType = clean(scheme.providerType || '');
      const rulesStates = scheme.rules?.states || [];

      if (profile.state) {
        const targetState = clean(profile.state);
        const isNationwide = level === 'central' || level === 'national' || providerType === 'private' || rulesStates.some((state) => ['central', 'all', 'national'].includes(clean(state)));
        const isSelectedState = level === targetState || rulesStates.some((state) => clean(state) === targetState);
        return isNationwide || isSelectedState;
      }

      return true;
    });

    if (matchedSchemes.length === 0) {
      matchedSchemes = candidateSchemes;
    }

    return res.json({
      profile,
      schemes: matchedSchemes,
      analysisMode: process.env.OPENAI_API_KEY ? 'ai' : 'demo'
    });

  } catch (error) {
    console.error('Intake analysis failed:', error.message);
    const profile = demoProfile(intake);
    return res.json({ profile, schemes: await getCatalog(), analysisMode: 'demo' });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', sandbox: true }));

app.get('/api/catalog-status', async (_req, res) => res.json(await catalogStatus()));

// Manual sync is useful in a demo; production should protect this route with admin authentication.
app.post('/api/catalog/sync', async (_req, res) => {
  try { res.json(await syncCatalog()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// Allows a future admin panel or scheduled importer to browse the local catalog.
// Examples: /api/schemes?type=internship&provider=private
app.get('/api/schemes', async (req, res) => {
  const type = clean(req.query.type);
  const provider = clean(req.query.provider);
  const catalog = (await getCatalog()).filter((scheme) =>
    (!type || clean(scheme.type) === type) &&
    (!provider || clean(scheme.providerType) === provider)
  );
  res.json(catalog);
});

startCatalogSync();
app.listen(port, () => console.log(`SetuAI API listening on http://localhost:${port}`));
