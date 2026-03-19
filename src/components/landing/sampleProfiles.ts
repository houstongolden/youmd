export interface Profile {
  username: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  verification: { verified: boolean };
  agentMetrics: { totalReads: number };
  freshness: { score: number };
}

export const sampleProfiles: Profile[] = [
  {
    username: "houstong",
    name: "Houston Golden",
    tagline: "Founder, BAMF Media. Building You.md.",
    avatarUrl: "/assets/houston-portrait.jpeg",
    verification: { verified: true },
    agentMetrics: { totalReads: 12842 },
    freshness: { score: 92 },
  },
  {
    username: "priya",
    name: "Priya Sharma",
    tagline: "ML engineer @ Anthropic. Alignment researcher.",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    verification: { verified: true },
    agentMetrics: { totalReads: 8421 },
    freshness: { score: 88 },
  },
  {
    username: "jmarcus",
    name: "Jordan Marcus",
    tagline: "Indie hacker. 3 exits. Building in public.",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
    verification: { verified: false },
    agentMetrics: { totalReads: 3219 },
    freshness: { score: 79 },
  },
  {
    username: "sato-yuki",
    name: "Yuki Sato",
    tagline: "Staff engineer @ Stripe. Distributed systems.",
    avatarUrl:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
    verification: { verified: true },
    agentMetrics: { totalReads: 6754 },
    freshness: { score: 95 },
  },
  {
    username: "emmawright",
    name: "Emma Wright",
    tagline:
      "Creative director. Brand strategist. Strong feelings about kerning.",
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
    verification: { verified: true },
    agentMetrics: { totalReads: 2187 },
    freshness: { score: 74 },
  },
  {
    username: "kai",
    name: "Kai Andersen",
    tagline: "DevRel lead @ Vercel. 50k YouTube subscribers.",
    avatarUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face",
    verification: { verified: true },
    agentMetrics: { totalReads: 9312 },
    freshness: { score: 91 },
  },
];
