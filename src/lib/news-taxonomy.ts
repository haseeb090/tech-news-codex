export interface TopicDefinition {
  id: string;
  label: string;
  keywords: string[];
}

export const topicDefinitions: TopicDefinition[] = [
  { id: "ai", label: "AI", keywords: ["ai", "openai", "chatgpt", "llm", "language model", "anthropic", "gemini", "copilot", "grok", "agent"] },
  { id: "security", label: "Security", keywords: ["security", "cyber", "breach", "malware", "ransomware", "vulnerability", "exploit", "phishing", "hack", "cisa"] },
  { id: "cloud", label: "Cloud", keywords: ["cloud", "aws", "azure", "gcp", "google cloud", "datacenter", "serverless", "kubernetes"] },
  { id: "devices", label: "Devices", keywords: ["laptop", "phone", "smartphone", "pixel", "iphone", "galaxy", "tablet", "wearable", "earbuds", "tv"] },
  { id: "software", label: "Software", keywords: ["windows", "linux", "macos", "android", "ios", "app", "software", "browser", "update", "release"] },
  { id: "developer", label: "Developer Tools", keywords: ["developer", "api", "github", "framework", "typescript", "javascript", "python", "programming", "devops", "rollup", "vite"] },
  { id: "chips", label: "Chips & Hardware", keywords: ["chip", "gpu", "cpu", "nvidia", "amd", "intel", "semiconductor", "hardware", "processor"] },
  { id: "robotics", label: "Robotics", keywords: ["robot", "robotics", "automation", "drone", "autonomous"] },
  { id: "science", label: "Science", keywords: ["science", "research", "space", "nasa", "physics", "biotech", "quantum"] },
  { id: "policy", label: "Policy", keywords: ["law", "policy", "regulation", "court", "antitrust", "copyright", "government", "eu", "congress"] },
  { id: "business", label: "Business", keywords: ["startup", "earnings", "acquisition", "funding", "market", "revenue", "deal", "ipo"] },
];

export const inferTopics = (input: { title: string; body: string; source?: string }): string[] => {
  const haystack = `${input.title} ${input.body} ${input.source || ""}`.toLowerCase();

  const matches = topicDefinitions
    .map((topic) => ({
      id: topic.id,
      score: topic.keywords.reduce((count, keyword) => (haystack.includes(keyword) ? count + 1 : count), 0),
    }))
    .filter((topic) => topic.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((topic) => topic.id);

  return matches.slice(0, 3);
};

export const getTopicLabel = (topicId: string): string =>
  topicDefinitions.find((topic) => topic.id === topicId)?.label || topicId;
