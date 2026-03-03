/**
 * Parses tanvi_Kb_Links.xlsx and ayesha_KB_links.xlsx
 * Extracts Column A (Link) and Column B (Content_Part1) only
 * Outputs a combined knowledge_base.json in data/
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

function extractTitle(content) {
  if (!content) return '';
  // Look for "## Title\n\nActual Title" pattern
  const titleMatch = content.match(/##\s*Title\s*\n+(.+?)(?:\n|$)/);
  if (titleMatch) return titleMatch[1].trim();
  // Fallback: first non-empty line
  const lines = content.split('\n').filter(l => l.trim());
  return lines[0]?.replace(/^#+\s*/, '').trim() || '';
}

function extractSummary(content, maxLen = 1500) {
  if (!content) return '';

  // Remove the title header
  let text = content.replace(/^##\s*Title\s*\n+.+?\n/i, '');

  // Try to find Abstract or Overview section
  const abstractMatch = text.match(/##\s*(?:Abstract|Overview|Summary|Introduction|Key\s*(?:Points|Takeaways))\s*\n+([\s\S]*?)(?=\n##\s|\n---|\n\*\*References|$)/i);
  if (abstractMatch) {
    text = abstractMatch[1];
  }

  // Clean up markdown artifacts
  text = text
    .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/#{1,6}\s*/g, '') // remove heading markers
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // remove bold/italic
    .replace(/\n{3,}/g, '\n\n') // collapse multiple newlines
    .trim();

  if (text.length > maxLen) {
    text = text.substring(0, maxLen).replace(/\s+\S*$/, '') + '...';
  }

  return text;
}

function extractKeywords(title, content) {
  const text = (title + ' ' + (content || '').substring(0, 3000)).toLowerCase();

  // Common health/medical keywords to look for
  const healthTerms = [
    'fever', 'cough', 'cold', 'flu', 'headache', 'migraine', 'diabetes',
    'blood pressure', 'hypertension', 'cholesterol', 'heart', 'cardiac',
    'asthma', 'allergy', 'allergies', 'skin', 'dermatitis', 'acne',
    'weight loss', 'weight gain', 'obesity', 'bmi', 'nutrition',
    'vitamin', 'mineral', 'iron', 'calcium', 'protein', 'fiber',
    'digestion', 'gut', 'stomach', 'acid reflux', 'constipation', 'diarrhea',
    'sleep', 'insomnia', 'fatigue', 'stress', 'anxiety', 'depression',
    'exercise', 'workout', 'fitness', 'yoga', 'meditation',
    'pregnancy', 'prenatal', 'postnatal', 'menstrual', 'pcod', 'pcos',
    'thyroid', 'hormone', 'immunity', 'immune', 'infection',
    'dehydration', 'hydration', 'water intake',
    'back pain', 'joint pain', 'arthritis', 'muscle', 'bone',
    'eye', 'vision', 'dental', 'oral health',
    'liver', 'kidney', 'lung', 'respiratory',
    'cancer', 'tumor', 'inflammation',
    'diet', 'fasting', 'intermittent fasting', 'keto', 'vegan',
    'sugar', 'glycemic', 'insulin', 'prediabetes',
    'covid', 'coronavirus', 'pandemic',
    'antibiotic', 'medication', 'drug', 'supplement',
    'child', 'pediatric', 'elderly', 'geriatric',
    'mental health', 'wellness', 'self-care',
    'food poisoning', 'nausea', 'vomiting',
    'hair loss', 'dandruff',
    'smoking', 'alcohol',
    'uti', 'urinary',
    'sore throat', 'tonsil', 'sinusitis', 'sinus',
  ];

  const found = healthTerms.filter(term => text.includes(term));
  return [...new Set(found)];
}

function parseFile(filePath, source) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const entries = [];
  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const link = rows[i]?.[0]; // Column A
    const content = rows[i]?.[1]; // Column B

    if (!link || !content) continue;

    const title = extractTitle(String(content));
    const summary = extractSummary(String(content));
    const keywords = extractKeywords(title, String(content));

    if (!title && !summary) continue;

    entries.push({
      id: `${source}_${i}`,
      source_file: source,
      source_url: String(link).trim(),
      title,
      summary,
      keywords,
    });
  }

  return entries;
}

// Parse both files
console.log('Parsing tanvi_Kb_Links.xlsx...');
const tanviEntries = parseFile(
  path.join(DATA_DIR, 'tanvi_Kb_Links.xlsx'),
  'tanvi'
);
console.log(`  -> ${tanviEntries.length} entries`);

console.log('Parsing ayesha_KB_links.xlsx...');
const ayeshaEntries = parseFile(
  path.join(DATA_DIR, 'ayesha_KB_links.xlsx'),
  'ayesha'
);
console.log(`  -> ${ayeshaEntries.length} entries`);

const combined = [...tanviEntries, ...ayeshaEntries];
console.log(`Total: ${combined.length} entries`);

// Write output
const outputPath = path.join(DATA_DIR, 'knowledge_base.json');
fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2), 'utf-8');
console.log(`Written to ${outputPath}`);

// Print some stats
const allKeywords = combined.flatMap(e => e.keywords);
const keywordCounts = {};
allKeywords.forEach(k => { keywordCounts[k] = (keywordCounts[k] || 0) + 1; });
const topKeywords = Object.entries(keywordCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);
console.log('\nTop 20 keywords:');
topKeywords.forEach(([k, c]) => console.log(`  ${k}: ${c}`));
