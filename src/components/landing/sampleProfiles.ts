export interface Profile {
  username: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  verification: { verified: boolean };
  agentMetrics: { totalReads: number };
  freshness: { score: number };
  updatedAt: number;
  isClaimed?: boolean;
}

// Real profiles — Houston is claimed, others are unclaimed placeholders
// based on real public AI/SaaS founders for authenticity
export const sampleProfiles: Profile[] = [
  {
    username: "houstongolden",
    name: "Houston Golden",
    tagline: "Founder, You.md + BAMF Media. Building the identity context protocol.",
    avatarUrl: "/assets/houston-portrait.jpeg",
    verification: { verified: true },
    agentMetrics: { totalReads: 14200 },
    freshness: { score: 95 },
    updatedAt: Date.now() - 1000 * 60 * 12,
    isClaimed: true,
  },
  {
    username: "dariuslukas",
    name: "Dario Amodei",
    tagline: "CEO, Anthropic. Building safe AI systems.",
    avatarUrl: "",
    verification: { verified: false },
    agentMetrics: { totalReads: 0 },
    freshness: { score: 0 },
    updatedAt: 0,
    isClaimed: false,
  },
  {
    username: "sama",
    name: "Sam Altman",
    tagline: "CEO, OpenAI. AGI researcher and investor.",
    avatarUrl: "",
    verification: { verified: false },
    agentMetrics: { totalReads: 0 },
    freshness: { score: 0 },
    updatedAt: 0,
    isClaimed: false,
  },
  {
    username: "swyx",
    name: "Shawn Wang",
    tagline: "Founder, smol.ai. AI engineer, writer, speaker.",
    avatarUrl: "",
    verification: { verified: false },
    agentMetrics: { totalReads: 0 },
    freshness: { score: 0 },
    updatedAt: 0,
    isClaimed: false,
  },
  {
    username: "jaredpalmer",
    name: "Jared Palmer",
    tagline: "CEO, Turborepo / Vercel. Building dev tools.",
    avatarUrl: "",
    verification: { verified: false },
    agentMetrics: { totalReads: 0 },
    freshness: { score: 0 },
    updatedAt: 0,
    isClaimed: false,
  },
  {
    username: "disler",
    name: "Peter Disler",
    tagline: "Creator of The Library. AI-native development tools.",
    avatarUrl: "",
    verification: { verified: false },
    agentMetrics: { totalReads: 0 },
    freshness: { score: 0 },
    updatedAt: 0,
    isClaimed: false,
  },
];
