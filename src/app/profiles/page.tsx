import type { Metadata } from "next";
import { ProfilesDirectoryContent } from "./profiles-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profiles — you.md",
  description:
    "Browse identity profiles on the you.md network. Every profile readable by any AI agent.",
  openGraph: {
    title: "Profiles — you.md",
    description:
      "Browse identity profiles on the you.md network. Every profile readable by any AI agent.",
    url: "https://you.md/profiles",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profiles — you.md",
    description:
      "Browse identity profiles on the you.md network. Every profile readable by any AI agent.",
  },
  alternates: {
    canonical: "https://you.md/profiles",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "you.md Profiles Directory",
  description:
    "Browse identity profiles on the you.md network. Every profile readable by any AI agent.",
  url: "https://you.md/profiles",
  isPartOf: {
    "@type": "WebSite",
    name: "you.md",
    url: "https://you.md",
  },
};

export default function ProfilesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfilesDirectoryContent />
    </>
  );
}
