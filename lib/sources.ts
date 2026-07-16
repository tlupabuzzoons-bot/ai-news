import type { Category } from './types';

export interface FeedSource {
  /** Display name shown in the source badge */
  name: string;
  url: string;
  /** Fallback category before Claude classifies (Phase 4) */
  category: Category;
  /** Apply the AI keyword allowlist (for general/non-AI feeds) */
  aiFilter: boolean;
  /** Cap on items taken per run (newest first). Default 25. */
  maxPerRun?: number;
}

// To add a source: add one entry here. Nothing else needs touching.
// Trimmed to the 10 most reliable sources (wire services, official labs,
// primary research, established tech press) — full catalog in git history.
export const RSS_SOURCES: FeedSource[] = [
  // models — official labs + established AI press
  { name: 'OpenAI', url: 'https://openai.com/blog/rss.xml', category: 'models', aiFilter: false },
  { name: 'DeepMind', url: 'https://deepmind.google/blog/rss.xml', category: 'models', aiFilter: false },
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'models', aiFilter: false },

  // research — primary source + best research journalism
  { name: 'arXiv cs.AI', url: 'https://arxiv.org/rss/cs.AI', category: 'research', aiFilter: false, maxPerRun: 10 },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', category: 'research', aiFilter: true },

  // industry — wire services + top financial press
  { name: 'Reuters', url: 'https://news.google.com/rss/search?q=when:24h+allinurl:reuters.com&hl=en-US&gl=US&ceid=US:en', category: 'industry', aiFilter: true },
  { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/technology/news.rss', category: 'industry', aiFilter: true },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'industry', aiFilter: true },

  // tools — established tech press with healthy feeds
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tools', aiFilter: true },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tools', aiFilter: true },
];

// Spec §4 allowlist + Czech equivalents (word-boundary matched; see matchesAiKeywords)
export const AI_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'llm',
  'model',
  'openai',
  'anthropic',
  'gemini',
  'claude',
  'gpt',
  'neural',
  'machine learning',
  'agent',
  // Czech
  'umělá inteligence',
  'umělé inteligence',
  'umělou inteligenci',
  'jazykový model',
  'jazykové modely',
  'strojové učení',
  'chatbot',
];
