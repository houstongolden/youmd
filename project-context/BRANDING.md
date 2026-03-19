# You.md — Brand Identity Guide

Version: 2.3
Last Updated: 2026-03-19

## Brand Names

| Name | Usage |
|---|---|
| **YOU** | Logo/brand mark, rendered as PixelYOU canvas logotype |
| **you.md** | Product name in text, always monospace, always lowercase with .md |
| **youmd** | CLI command / npm package name |

## Core Concept

**Terminal is the interface. Ascension is the meaning.**

"I am initializing myself into the agent internet."

You.md is not a SaaS dashboard. It is a command-line identity system with a symbolic, minimal visual language. Infrastructure with soul.

## Visual Metaphor: Ascension

Identity captured, structured, and shared with a higher intelligence. The Beam — a vertical column of structured data — is the core symbol. Not decorative glow, but a pathway.

## The ASCII Portrait

The signature visual feature. Every user's photo converted to ASCII art via luminance-to-character density mapping, rendered in burnt orange tones. This IS the visual identity — "what you look like to machines."

## Color System

### Dark Mode (Default)
```
Background:      #0D0D0D    (0 0% 5%)
Raised:          #171717    (0 0% 9%)
Text Primary:    #EAE6E1    (30 10% 92%)
Text Secondary:  #A89E91    (30 8% 65%)
Border:          #2E2E2E    (0 0% 18%)
```

### Light Mode (.light class)
```
Background:      #F6F3EF    (36 20% 96%)
Raised:          #FFFFFF    (0 0% 100%)
Text Primary:    #141414    (0 0% 8%)
Text Secondary:  #524A3E    (30 8% 32%)
Border:          #D9D1C5    (30 10% 84%)
```

### Accent (Burnt Orange)
```
accent:          #C46A3A    links, CTAs, beam, logo         █
accent-dark:     #A8552E    hover states
accent-mid:      #D27A4F    secondary emphasis, ASCII ▓     ▓
accent-light:    #E3A17A    soft indicators, ASCII ▒        ▒
accent-wash:     #271D16    subtle backgrounds              ░
```

**Rules:**
- Accent appears sparingly. Pages are 90%+ monochrome.
- No full-bleed accent backgrounds.
- No second accent color. Ever.

## Typography

| Role | Font | Notes |
|---|---|---|
| Headings/Brand/Labels | JetBrains Mono | All headings, logo, commands, section labels, nav |
| Body | Inter | Paragraphs, bios, descriptions |
| Code/Terminal | JetBrains Mono | Inline code, JSON, CLI output |

**Hierarchy via spacing + opacity (0.3–0.9), NOT font weight.**

### Size Scale
```
8px    badges, version tags
9px    metrics, timestamps
10px   section labels, nav items
11px   section headers, CLI output
12px   nav brand, profile names
13px   body descriptions
14-15px primary body, bio
16-20px hero statements
```

## Design Principles

1. Terminal-native, not SaaS
2. Monochrome + accent, not multi-color
3. Structured, not decorative
4. Calm, not flashy
5. Symbolic, not illustrative
6. Command-driven, not click-driven
7. The beam is the structural motif
8. Everything feels like system output
9. Profiles are live system surfaces
10. Identity in code (ASCII portrait)

## Component Library

### Terminal Panel
Primary container. bg-raised, 1px border, 4px radius, 3-dot header with filename.

### CLI Pill
Copy-to-clipboard. Mono text, bg-raised, 1px border. Format: `$ npx youmd init █ [copy]`

### CTA Buttons
- Primary: accent bg, white text, mono. Hover: accent-dark.
- Outline: 1px border, muted text. Hover: accent border + text.
- Command-style: prefixed with `>` (e.g., `> enter system`)

### Glass Nav
bg 0.9 opacity, 1px border, 12px blur. Nav items as `--flag` format.

### Section Labels
Uppercase, tracking-widest, 10px, mono, muted. Format: `── LABEL ──`

## Animation Rules

All animation is purposeful — reinforces the terminal/system metaphor.

- **FadeUp:** translateY(24px)→0, opacity 0→1, IntersectionObserver
- **Boot sequence:** typewriter at 55ms/char
- **Count-up:** metrics animate 0→target on viewport entry
- **Blinking cursor:** `█` with CSS step-end 1s
- **Status pulse:** green dot with box-shadow pulse
- No decorative animations. No gratuitous motion.

## What NOT To Do

- No rounded cards with drop shadows
- No colorful multi-hue CTAs
- No dashboard grids (this isn't Stripe/Linear)
- No display fonts, serif fonts, handwriting fonts
- No "big marketing headline" energy
- No illustrations of people (ASCII portrait IS the person)
- No emoji anywhere
- No gradients (except the beam motif)
- No background textures or patterns
