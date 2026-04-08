import { NextResponse } from "next/server";

/**
 * GET /schema/you-md/v1.json — Public JSON Schema for the you-md/v1
 * identity context protocol. Profile responses advertise this URL via
 * a `Link: ...; rel="describedby"` header, so agents that want to
 * validate or introspect a profile can fetch the schema here.
 */

const SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://you.md/schema/you-md/v1.json",
  title: "you-md/v1",
  description:
    "Identity context protocol for humans on the agent internet. " +
    "A you-md/v1 document describes a person's identity, current focus, projects, " +
    "values, voice, and agent-interaction preferences in a structured, " +
    "agent-readable form.",
  type: "object",
  required: ["schema", "identity"],
  properties: {
    schema: {
      type: "string",
      const: "you-md/v1",
      description: "Schema identifier. Must be the literal string 'you-md/v1'.",
    },
    username: {
      type: "string",
      description: "Canonical username (slug) for this profile.",
    },
    generated_at: {
      type: "string",
      format: "date-time",
      description: "ISO 8601 timestamp of when this document was compiled.",
    },
    identity: {
      type: "object",
      description: "Core identity — name, tagline, location, bio.",
      properties: {
        name: { type: "string", description: "Full display name." },
        tagline: {
          type: "string",
          description: "One-line descriptor (e.g. 'Founder, BAMF Media').",
        },
        location: {
          type: "string",
          description: "Geographic location (free-form, e.g. 'Miami, FL').",
        },
        bio: {
          type: "object",
          description: "Bio at three levels of detail.",
          properties: {
            short: {
              type: "string",
              description: "One sentence. For search snippets, cards.",
            },
            medium: {
              type: "string",
              description: "One paragraph. For profile pages, intros.",
            },
            long: {
              type: "string",
              description: "Full biography. For deep context.",
            },
          },
        },
      },
    },
    now: {
      type: "object",
      description: "What this person is working on right now.",
      properties: {
        focus: {
          type: "array",
          description: "Short phrases describing current focus areas.",
          items: { type: "string" },
        },
        updated_at: {
          type: "string",
          format: "date",
          description: "Date the 'now' section was last updated.",
        },
      },
    },
    projects: {
      type: "array",
      description: "Active projects and ventures.",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            description:
              "Project name (plain text — do NOT include markdown headings).",
          },
          role: {
            type: "string",
            description: "Role in the project (e.g. 'Founder', 'Maintainer').",
          },
          status: {
            type: "string",
            description: "Lifecycle status (e.g. 'building', 'shipped', 'archived').",
          },
          description: {
            type: "string",
            description: "One- or two-sentence description.",
          },
          url: {
            type: "string",
            format: "uri",
            description: "Canonical URL for the project.",
          },
        },
      },
    },
    values: {
      type: "array",
      description: "Core values — short phrases, one per item.",
      items: { type: "string" },
    },
    links: {
      type: "object",
      description:
        "Map of link name to URL (e.g. { twitter: 'https://x.com/...' }).",
      additionalProperties: { type: "string", format: "uri" },
    },
    preferences: {
      type: "object",
      description: "How this person prefers to be interacted with.",
      properties: {
        agent: {
          type: "object",
          description: "Preferences for AI agents working on behalf of or with this person.",
          properties: {
            tone: {
              type: "string",
              description:
                "Preferred tone (e.g. 'direct', 'warm'). Plain text — NOT markdown.",
            },
            formality: {
              type: "string",
              description:
                "Formality level (e.g. 'casual', 'casual-professional', 'formal').",
            },
            avoid: {
              type: "array",
              description: "Things to avoid (words, topics, behaviors).",
              items: { type: "string" },
            },
          },
        },
        writing: {
          type: "object",
          description: "Writing preferences for content produced on their behalf.",
          properties: {
            style: {
              type: "string",
              description: "Writing style descriptor (e.g. 'punchy', 'analytical').",
            },
            format: {
              type: "string",
              description: "Preferred output format (e.g. 'markdown preferred').",
            },
          },
        },
      },
    },
    voice: {
      type: "object",
      description: "How this person sounds in their own words.",
      properties: {
        overall: {
          type: "string",
          description: "Overall voice summary across platforms.",
        },
        platforms: {
          type: "object",
          description: "Per-platform voice variations.",
          properties: {
            linkedin: { type: ["string", "null"] },
            x: { type: ["string", "null"] },
            blog: { type: ["string", "null"] },
          },
          additionalProperties: { type: ["string", "null"] },
        },
      },
    },
    agent_directives: {
      type: "object",
      description:
        "Behavioral instructions for any AI interacting with this person.",
      properties: {
        communication_style: {
          type: "string",
          description: "How the agent should communicate with them.",
        },
        default_stack: {
          type: "string",
          description: "Preferred technology / tools stack for coding tasks.",
        },
        current_goal: {
          type: "string",
          description: "Current top-level goal the agent should optimize for.",
        },
        negative_prompts: {
          type: "array",
          description: "Things the agent should NOT do.",
          items: { type: "string" },
        },
      },
    },
    agent_guide: {
      type: "object",
      description:
        "Navigation guide — tells agents where to find specific context.",
      properties: {
        summary: {
          type: "string",
          description: "Top-level summary of how to use this document.",
        },
        for_coding: {
          type: "string",
          description: "Which fields to consult for coding tasks.",
        },
        for_writing: {
          type: "string",
          description: "Which fields to consult for writing tasks.",
        },
        for_research: {
          type: "string",
          description: "Which fields to consult for research tasks.",
        },
      },
    },
  },
  additionalProperties: true,
} as const;

export async function GET() {
  return NextResponse.json(SCHEMA, {
    status: 200,
    headers: {
      "Content-Type": "application/schema+json",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
