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
export const RSS_SOURCES: FeedSource[] = [
  // ── AI-specific feeds (spec §4) ───────────────────────────────
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'models', aiFilter: false },
  { name: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/', category: 'models', aiFilter: false },
  { name: 'Wired', url: 'https://www.wired.com/feed/tag/ai/latest/rss', category: 'tools', aiFilter: false },
  { name: 'arXiv cs.AI', url: 'https://arxiv.org/rss/cs.AI', category: 'research', aiFilter: false, maxPerRun: 10 },
  { name: 'arXiv cs.LG', url: 'https://arxiv.org/rss/cs.LG', category: 'research', aiFilter: false, maxPerRun: 10 },
  { name: 'arXiv cs.CL', url: 'https://arxiv.org/rss/cs.CL', category: 'research', aiFilter: false, maxPerRun: 10 },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', category: 'research', aiFilter: true },
  { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/technology/news.rss', category: 'industry', aiFilter: true },
  // official blogs — Anthropic has no public RSS; needs a scraper (TODO, see README)
  { name: 'OpenAI', url: 'https://openai.com/blog/rss.xml', category: 'models', aiFilter: false },
  { name: 'DeepMind', url: 'https://deepmind.google/blog/rss.xml', category: 'models', aiFilter: false },
  { name: 'Meta AI', url: 'https://ai.meta.com/blog/rss/', category: 'models', aiFilter: false },

  // ── buzzoons-news-feeds.opml — CZ zpravodajství ───────────────
  { name: 'ČTK', url: 'https://www.ceskenoviny.cz/sluzby/rss/zpravy.php', category: 'industry', aiFilter: true },
  { name: 'ČT24', url: 'https://ct24.ceskatelevize.cz/rss/hlavni-zpravy', category: 'industry', aiFilter: true },
  { name: 'iROZHLAS', url: 'https://www.irozhlas.cz/rss/irozhlas', category: 'industry', aiFilter: true },
  { name: 'iROZHLAS Svět', url: 'https://www.irozhlas.cz/rss/irozhlas/section/zpravy-svet', category: 'industry', aiFilter: true },
  { name: 'Seznam Zprávy', url: 'https://www.seznamzpravy.cz/rss', category: 'industry', aiFilter: true },
  { name: 'iDNES', url: 'https://servis.idnes.cz/rss.aspx?c=zpravodaj', category: 'industry', aiFilter: true },
  { name: 'Novinky.cz', url: 'https://www.novinky.cz/rss2', category: 'industry', aiFilter: true },
  { name: 'Deník N', url: 'https://denikn.cz/feed', category: 'industry', aiFilter: true },
  { name: 'Aktuálně.cz', url: 'https://www.aktualne.cz/rss/', category: 'industry', aiFilter: true },
  { name: 'Hospodářské noviny', url: 'https://www.ihned.cz/?m=rss', category: 'industry', aiFilter: true },
  { name: 'Respekt', url: 'https://www.respekt.cz/rss/canal.xml', category: 'industry', aiFilter: true },
  { name: 'E15', url: 'https://www.e15.cz/rss', category: 'industry', aiFilter: true },

  // ── OPML — CZ media / marketing / tech ────────────────────────
  { name: 'MediaGuru', url: 'https://www.mediaguru.cz/rss/', category: 'industry', aiFilter: true },
  { name: 'MediaHub', url: 'https://mediahub.cz/feed/', category: 'industry', aiFilter: true },
  { name: 'MarketingSalesMedia', url: 'https://marketingsales.tyden.cz/rss.php', category: 'industry', aiFilter: true },
  { name: 'Lupa.cz', url: 'https://rss.lupa.cz/clanky/', category: 'tools', aiFilter: true },
  { name: 'Root.cz', url: 'https://rss.root.cz/rss/clanky/', category: 'tools', aiFilter: true },
  { name: 'Zdroják', url: 'https://zdrojak.cz/rss/', category: 'tools', aiFilter: true },
  { name: 'Živě.cz', url: 'https://www.zive.cz/rss/sc-47/', category: 'tools', aiFilter: true },

  // ── OPML — world hard news ────────────────────────────────────
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'industry', aiFilter: true },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', category: 'industry', aiFilter: true },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', category: 'industry', aiFilter: true },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'industry', aiFilter: true },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'industry', aiFilter: true },
  { name: 'Washington Post', url: 'https://feeds.washingtonpost.com/rss/world', category: 'industry', aiFilter: true },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-all', category: 'industry', aiFilter: true },
  { name: 'POLITICO Europe', url: 'https://www.politico.eu/feed/', category: 'industry', aiFilter: true },
  { name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/world.xml', category: 'industry', aiFilter: true },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', category: 'industry', aiFilter: true },
  { name: 'Reuters', url: 'https://news.google.com/rss/search?q=when:24h+allinurl:reuters.com&hl=en-US&gl=US&ceid=US:en', category: 'industry', aiFilter: true },
  { name: 'AP News', url: 'https://news.google.com/rss/search?q=when:24h+allinurl:apnews.com&hl=en-US&gl=US&ceid=US:en', category: 'industry', aiFilter: true },

  // ── OPML — world tech / social / creator ──────────────────────
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tools', aiFilter: true },
  { name: 'TechCrunch (all)', url: 'https://techcrunch.com/feed/', category: 'tools', aiFilter: true },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tools', aiFilter: true },
  { name: 'Social Media Today', url: 'https://www.socialmediatoday.com/feeds/news/', category: 'industry', aiFilter: true },
  { name: 'Marketing Brew', url: 'https://www.marketingbrew.com/feed', category: 'industry', aiFilter: true },
  { name: 'Adweek', url: 'https://www.adweek.com/feed/', category: 'industry', aiFilter: true },
  { name: 'Campaign UK', url: 'https://www.campaignlive.co.uk/rss/latest', category: 'industry', aiFilter: true },
  { name: 'Digiday', url: 'https://digiday.com/feed/', category: 'industry', aiFilter: true },
  { name: 'Tubefilter', url: 'https://www.tubefilter.com/feed/', category: 'industry', aiFilter: true },
  { name: 'Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', category: 'industry', aiFilter: true },
  { name: 'Variety', url: 'https://variety.com/feed/', category: 'industry', aiFilter: true },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'tools', aiFilter: true },
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
