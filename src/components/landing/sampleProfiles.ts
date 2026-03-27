export interface Profile {
  username: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  verification: { verified: boolean };
  agentMetrics: { totalReads: number };
  freshness: { score: number };
  updatedAt: number;
}

export const sampleProfiles: Profile[] = [
  {
    username: "houstongolden",
    name: "Houston Golden",
    tagline: "building the identity layer for every AI agent on the internet.",
    avatarUrl: "/assets/houston-portrait.jpeg",
    verification: { verified: true },
    agentMetrics: { totalReads: 12842 },
    freshness: { score: 96 },
    updatedAt: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
  },
  {
    username: "priya",
    name: "Priya Sharma",
    tagline: "teaching machines to be honest. alignment research @ anthropic.",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    verification: { verified: true },
    agentMetrics: { totalReads: 8421 },
    freshness: { score: 88 },
    updatedAt: Date.now() - 1000 * 60 * 60 * 18, // 18 hours ago
  },
  {
    username: "jmarcus",
    name: "Jordan Marcus",
    tagline: "3 exits, still shipping. building something new every 90 days.",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
    verification: { verified: false },
    agentMetrics: { totalReads: 3219 },
    freshness: { score: 79 },
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
  },
  {
    username: "sato-yuki",
    name: "Yuki Sato",
    tagline: "making payments feel invisible. staff eng @ stripe, distributed systems.",
    avatarUrl:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
    verification: { verified: true },
    agentMetrics: { totalReads: 6754 },
    freshness: { score: 95 },
    updatedAt: Date.now() - 1000 * 60 * 60 * 6, // 6 hours ago
  },
  {
    username: "emmawright",
    name: "Emma Wright",
    tagline: "creative director with strong feelings about kerning and whitespace.",
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
    verification: { verified: true },
    agentMetrics: { totalReads: 2187 },
    freshness: { score: 74 },
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5, // 5 days ago
  },
  {
    username: "kai",
    name: "Kai Andersen",
    tagline: "explaining the future to 50k developers on youtube. devrel @ vercel.",
    avatarUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face",
    verification: { verified: true },
    agentMetrics: { totalReads: 9312 },
    freshness: { score: 91 },
    updatedAt: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
  },
];
