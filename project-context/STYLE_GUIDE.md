# You.md — Style Guide Reference

PRD Version: 2.3
Design Prototype: https://github.com/houstongolden/youmd-b73d50c7
Live Preview: https://youmd.lovable.app/

## Design Direction (v2.3)

Terminal-native identity system. Monochrome + burnt orange accent.
NOT a SaaS dashboard. Infrastructure with soul.

## Color System

Dark mode default. Light mode via .light class.

### Dark
- bg: #0D0D0D
- bg-raised: #171717
- text-primary: #EAE6E1
- text-secondary: #A89E91
- border: #2E2E2E

### Light (.light)
- bg: warm super-light beige / ivory gradient, not stark white
- bg-raised: warm off-white beige
- text-primary: warm charcoal
- text-secondary: muted warm gray
- border: soft warm gray

### Accent (burnt orange)
- accent: #C46A3A (links, CTAs, beam, logo)
- accent-dark: #A8552E (hover)
- accent-mid: #D27A4F
- accent-light: #E3A17A
- accent-wash: #271D16

### Shell Surface Rule
- Shell chrome and active fills should use warm charcoal / warm beige neutral surfaces, not pure black.
- Avoid orange gradients fading over solid black; it reads seasonal/costume-like instead of sophisticated.
- Burnt orange should stay a small accent line, label, status, or hover cue, never the dominant fill behind large shell surfaces.

## Typography
- Headings/Brand: JetBrains Mono
- Body: Inter
- Code: JetBrains Mono
- Hierarchy via spacing + opacity (0.3-0.9), NOT font weight

## Key Components
- Terminal Panel (bg-raised, 1px border, 3-dot header)
- CLI Pill (copy-to-clipboard)
- Glass Nav (--flag navigation)
- PixelYOU Logo (canvas-drawn)
- ASCII Portrait System
- FadeUp animation (IntersectionObserver)
- Boot sequence typewriter
- Count-up metrics

## Design Prototype Location
/tmp/youmd-lovable/src/
