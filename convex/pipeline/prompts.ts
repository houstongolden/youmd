/**
 * LLM prompt templates for the ingestion pipeline.
 * All prompts request JSON output with specific schemas.
 */

// ---------------------------------------------------------------------------
// System context shared across all prompts
// ---------------------------------------------------------------------------

const SYSTEM_CONTEXT = `You are an identity extraction and analysis engine for You.md, the identity context protocol for the agent internet (you-md/v1).

You.md is a structured identity context protocol that agents consume directly — authoritative, current, and controlled by the person it represents. The spec includes:
- you.json: machine-readable structured identity
- you.md: human-readable markdown entry file
- manifest.json: directory map and permissions

Your job is to extract, structure, and analyze personal identity data from raw source content. Always return valid JSON. Be accurate — never fabricate information that isn't present in the source material.`;

// ---------------------------------------------------------------------------
// Extraction prompts (per source type)
// ---------------------------------------------------------------------------

export const EXTRACTION_PROMPTS: Record<string, string> = {
  website: `${SYSTEM_CONTEXT}

You are extracting structured identity data from a personal website.

Analyze the provided website content and extract the following into a JSON object:

{
  "name": "Full name of the person",
  "tagline": "A one-line description or headline",
  "location": "City, State/Country if mentioned",
  "bio": "A paragraph bio synthesized from the about/homepage content",
  "role": "Current primary role/title",
  "projects": [
    {
      "name": "Project name",
      "role": "Their role in the project",
      "status": "active | building | completed",
      "url": "URL if available",
      "description": "Short description"
    }
  ],
  "links": {
    "platform_name": "url"
  },
  "about_content": "Raw about page content if found",
  "values": ["Value or principle mentioned"],
  "skills": ["Skill or expertise mentioned"],
  "credibility_signals": ["Notable achievements, numbers, press mentions"]
}

Only include fields where you found clear evidence in the content. Do not fabricate data. If a field has no evidence, use null.

Return ONLY the JSON object, no markdown fences, no explanation.`,

  linkedin: `${SYSTEM_CONTEXT}

You are extracting structured identity data from a LinkedIn profile.

Analyze the provided LinkedIn profile data and extract the following into a JSON object:

{
  "name": "Full name",
  "headline": "LinkedIn headline",
  "location": "Location from profile",
  "bio": "About/summary section content",
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "duration": "Time period",
      "description": "Role description if available",
      "is_current": true
    }
  ],
  "education": [
    {
      "institution": "School name",
      "degree": "Degree type and field",
      "year": "Graduation year or period"
    }
  ],
  "skills": ["Listed skills"],
  "recommendations_summary": "Summary themes from recommendations if available",
  "credibility_signals": ["Follower counts, endorsement counts, notable connections mentioned"],
  "projects": [
    {
      "name": "Project or company name",
      "role": "Role",
      "status": "active | completed",
      "description": "Brief description"
    }
  ]
}

Only include fields where you found clear evidence. Do not fabricate data. If a field has no evidence, use null.

Return ONLY the JSON object, no markdown fences, no explanation.`,

  x: `${SYSTEM_CONTEXT}

You are extracting structured identity data from an X (Twitter) profile.

Analyze the provided X/Twitter profile data and extract the following into a JSON object:

{
  "name": "Display name",
  "handle": "@handle",
  "bio": "Profile bio text",
  "location": "Location if set",
  "website_url": "Website URL from profile if set",
  "recent_themes": ["Recurring topics from recent posts"],
  "communication_style": {
    "tone": "Description of their posting tone",
    "formality": "casual | professional | mixed",
    "patterns": ["Notable communication patterns — e.g. uses threads, lots of hot takes, replies frequently"]
  },
  "key_topics": ["Primary topics they discuss"],
  "notable_posts": [
    {
      "summary": "Brief summary of a notable/representative post",
      "engagement": "Like/repost counts if available"
    }
  ],
  "audience_signals": {
    "follower_count": "If available",
    "engagement_level": "high | medium | low based on visible metrics"
  },
  "credibility_signals": ["Verified status, notable interactions, follower counts"]
}

Only include fields where you found clear evidence. Do not fabricate data. If a field has no evidence, use null.

Return ONLY the JSON object, no markdown fences, no explanation.`,

  blog: `${SYSTEM_CONTEXT}

You are extracting structured identity data from blog/newsletter content.

Analyze the provided blog content and extract the following into a JSON object:

{
  "name": "Author name if found",
  "blog_name": "Name of the blog/newsletter",
  "bio": "Author bio if present",
  "topics": ["Main topics covered across posts"],
  "writing_style": {
    "tone": "Description of writing tone",
    "structure": "How they structure posts",
    "vocabulary_level": "accessible | technical | academic | mixed"
  },
  "key_posts": [
    {
      "title": "Post title",
      "summary": "Brief summary",
      "topics": ["Topics covered"]
    }
  ],
  "expertise_areas": ["Areas of demonstrated expertise"],
  "values": ["Values or principles evident in writing"],
  "credibility_signals": ["Subscriber counts, notable mentions, expertise demonstrations"]
}

Only include fields where you found clear evidence. Do not fabricate data. If a field has no evidence, use null.

Return ONLY the JSON object, no markdown fences, no explanation.`,

  github: `${SYSTEM_CONTEXT}

You are extracting structured identity data from a GitHub profile.

Analyze the provided GitHub data and extract the following into a JSON object:

{
  "name": "Name from profile",
  "handle": "GitHub username",
  "bio": "Profile bio",
  "location": "Location if set",
  "projects": [
    {
      "name": "Repository name",
      "description": "Repo description",
      "language": "Primary language",
      "stars": "Star count if available",
      "role": "owner | contributor"
    }
  ],
  "skills": ["Programming languages and technologies used"],
  "contribution_patterns": "Description of their contribution activity",
  "credibility_signals": ["Notable repos, star counts, contribution streaks"]
}

Only include fields where you found clear evidence. Do not fabricate data. If a field has no evidence, use null.

Return ONLY the JSON object, no markdown fences, no explanation.`,

  youtube: `${SYSTEM_CONTEXT}

You are extracting structured identity data from YouTube channel content.

Analyze the provided YouTube data and extract the following into a JSON object:

{
  "name": "Channel name / creator name",
  "bio": "Channel description / about",
  "topics": ["Main content topics"],
  "style": {
    "format": "Type of content (tutorials, vlogs, essays, etc.)",
    "tone": "Tone description",
    "length": "Typical video length pattern"
  },
  "key_videos": [
    {
      "title": "Video title",
      "summary": "Brief summary if transcript available",
      "topics": ["Topics covered"]
    }
  ],
  "expertise_areas": ["Demonstrated expertise areas"],
  "credibility_signals": ["Subscriber count, view counts, notable collaborations"]
}

Only include fields where you found clear evidence. Do not fabricate data. If a field has no evidence, use null.

Return ONLY the JSON object, no markdown fences, no explanation.`,
};

// ---------------------------------------------------------------------------
// Analysis prompts
// ---------------------------------------------------------------------------

export const VOICE_ANALYSIS_PROMPT = `${SYSTEM_CONTEXT}

You are analyzing all extracted identity data to generate an author voice profile.

Given the following extracted data from multiple sources, create a detailed voice profile that captures how this person communicates.

Return a JSON object:

{
  "voice_summary": "2-3 sentence summary of their overall communication style",
  "tone": {
    "primary": "The dominant tone (e.g., direct, warm, analytical, energetic)",
    "secondary": "Secondary tone characteristics",
    "description": "Detailed tone description"
  },
  "formality": "casual | casual-professional | professional | academic",
  "patterns": [
    "Specific communication patterns observed (e.g., uses short punchy sentences, leads with data, uses analogies frequently)"
  ],
  "vocabulary": {
    "level": "accessible | technical | academic | mixed",
    "signature_phrases": ["Phrases or words they use repeatedly"],
    "industry_jargon": ["Industry-specific terms they use naturally"],
    "avoid": ["Things they seem to avoid in communication"]
  },
  "writing_style": {
    "paragraph_length": "short | medium | long",
    "sentence_structure": "Description of typical sentence structure",
    "formatting_preferences": "How they format content (lists, headers, etc.)"
  },
  "agent_instructions": "A paragraph telling an AI agent exactly how to write in this person's voice"
}

Base this ONLY on evidence from the provided data. Where evidence is thin, note uncertainty.

Return ONLY the JSON object, no markdown fences, no explanation.`;

export const TOPICS_ANALYSIS_PROMPT = `${SYSTEM_CONTEXT}

You are analyzing all extracted identity data to generate a topic and expertise map.

Given the following extracted data from multiple sources, create a structured topic map.

Return a JSON object:

{
  "primary_topics": [
    {
      "topic": "Topic name",
      "expertise_level": "thought_leader | expert | practitioner | enthusiast",
      "evidence": "Brief note on what sources show this"
    }
  ],
  "secondary_topics": [
    {
      "topic": "Topic name",
      "expertise_level": "thought_leader | expert | practitioner | enthusiast",
      "evidence": "Brief evidence note"
    }
  ],
  "industries": ["Industries they operate in"],
  "emerging_interests": ["Topics they seem to be newly exploring"],
  "topic_connections": [
    {
      "topics": ["Topic A", "Topic B"],
      "relationship": "How these topics connect in their work"
    }
  ]
}

Base this ONLY on evidence from the provided data.

Return ONLY the JSON object, no markdown fences, no explanation.`;

export const BIO_VARIANTS_PROMPT = `${SYSTEM_CONTEXT}

You are generating bio variants for a person based on all their extracted identity data.

Given the following extracted data, generate three bio variants written in this person's voice:

Return a JSON object:

{
  "short": "A single-line bio (under 120 characters). Punchy, memorable, captures the essence.",
  "medium": "A 2-3 sentence bio. Covers who they are, what they do, and one credibility signal.",
  "long": "A full paragraph bio (4-6 sentences). Comprehensive but engaging. Covers identity, current work, background, and what makes them notable."
}

Write in the person's own voice and tone as much as possible. Use third person. Be factual — only include information supported by the source data.

Return ONLY the JSON object, no markdown fences, no explanation.`;

export const FAQ_PROMPT = `${SYSTEM_CONTEXT}

You are generating a predicted FAQ about a person based on all their extracted identity data.

Given the following extracted data, predict the most likely questions someone (or an AI agent) would ask about this person, and answer them using the available data.

Return a JSON object:

{
  "faq": [
    {
      "question": "A likely question about this person",
      "answer": "The answer based on available data",
      "confidence": "high | medium | low"
    }
  ]
}

Generate 8-12 questions covering:
- Who they are and what they do
- Their current projects/focus
- Their expertise and background
- How to work with them or reach them
- Their communication preferences

Only answer with information supported by the source data. If the data doesn't support a confident answer, set confidence to "low" and note the uncertainty.

Return ONLY the JSON object, no markdown fences, no explanation.`;
