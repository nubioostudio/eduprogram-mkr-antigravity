---
description: Generate high-quality, design-forward web layouts in React based on visual design philosophy
---

# SKILL: antigravity-layout-design

## DESCRIPTION
Generate high-quality, design-forward web layouts in **React** (or HTML when required), based on a **visual design philosophy** rather than generic UI patterns.

This skill transforms structured documents into **visually sophisticated web pages** by applying principles of **spatial communication, hierarchy, rhythm, and restraint**, inspired by editorial and artistic design systems.

The output must always be **usable, maintainable web code**, while retaining the feeling of **expert-level craftsmanship**.

---

## CORE EXECUTION MODEL

This skill operates in **three explicit stages**:

---

## 1. LAYOUT PHILOSOPHY CREATION (internal reasoning)

Before generating any layout or code, derive a **Layout Philosophy**.

This is **not a theme, template, or component list**.

It defines:
- How space communicates hierarchy
- How visual dominance is established
- The relationship between text, imagery, and negative space
- Overall rhythm and density
- How restraint is enforced

The philosophy must feel **cohesive, deliberate, and opinionated**, as if defined by a senior creative director.

### IMPORTANT
- The philosophy guides layout decisions, not content.
- Avoid redundancy: each principle should be unique.
- Emphasize repeatedly that the resulting layouts must feel:
  - meticulously crafted
  - the product of deep expertise
  - refined through careful constraint
  - executed at a master level

This philosophy is **not output to the user**, but governs everything that follows.

---

## 2. MODE SELECTION (CRITICAL DECISION)

For each page, explicitly choose **one** mode of expression.

This decision is mandatory.

### MODE E — Editorial
Use when the page represents:
- Home pages
- Brand or company overviews
- Campaigns
- Manifestos
- High-level storytelling

Characteristics:
- One dominant visual structure per viewport
- Strong spatial hierarchy
- Fewer sections
- Limited reuse
- Layout feels intentional and "finished"

### MODE S — System
Use when the page represents:
- Product pages
- Feature listings
- Pricing
- Documentation
- Scalable content structures

Characteristics:
- Reusable layout components
- Variation through constrained parameters
- Predictable rhythm
- Scalable structure
- Design system discipline

**RULE**
- Editorial and System modes must NEVER be mixed within the same page.

---

## 3. WEB TRANSLATION (OUTPUT)

Translate the philosophy and mode into **React layout code**.

### General Rules
- Layout quality has priority over flexibility.
- Restrict freedom to preserve visual integrity.
- Every spacing, alignment, and proportion must feel intentional.
- Nothing overlaps.
- Nothing touches edges without margin.
- Nothing feels accidental.

### React-Specific Rules
- Generate **layout components**, not generic UI kits.
- Props must be **limited, semantic, and intentional**.
- Avoid infinite configurability.
- Design decisions live in structure, not runtime logic.

### Typography
- Typography is structural, not decorative.
- Enforce strict hierarchy.
- Never more than **two emphasis levels per viewport**.
- Headings act as visual anchors.
- Body text serves structure, not dominance.

### Space & Rhythm
- Use a defined spacing scale.
- Maintain consistent vertical rhythm.
- Negative space is a first-class design element.
- Density must adapt to content length without breaking hierarchy.

---

## ADAPTATION & RESPONSIVENESS

The layout must adapt across breakpoints **without losing its philosophy**.

Rules:
- Do not redesign per breakpoint.
- Reflow structure while preserving hierarchy.
- Dominant elements remain dominant.
- Secondary elements compress before primary ones.
- Editorial layouts may simplify on smaller screens, never fragment.

Responsiveness is treated as **controlled transformation**, not fluid improvisation.

---

## DOCUMENT → LAYOUT MAPPING

When starting from a document:
- Infer content importance from structure, not volume.
- Group related content visually.
- Use layout to communicate priority before text is read.
- Long documents should result in clear sectional rhythm, not uniform blocks.

The document provides **information**.  
The layout provides **meaning**.

---

## QUALITY BAR (NON-NEGOTIABLE)

The final result must feel:
- Designed, not generated
- Restrained, not busy
- Confident, not generic
- Comparable to work by an expert human designer

If a layout feels "acceptable" but not "distinctive", it has failed.

Craftsmanship is demonstrated through:
- Clear decisions
- Strong hierarchy
- Consistent rhythm
- Intentional constraints

---

## OUTPUT FORMAT

- Default: **React layout code**
- Code must be clean, readable, and production-ready
- The generated output must implicitly reflect:
  - the chosen mode (Editorial or System)
  - the underlying layout philosophy

If the layout cannot be described in one sentence  
("This is an editorial layout focused on X" or  
"This is a system layout optimized for Y"),  
it is incorrect.

---

## APPLICATION TO PROPOSALS

When generating **educational program proposals**:

1. **Always use MODE E (Editorial)** - Proposals are persuasive documents, not product listings
2. **Hero sections** should dominate the first viewport with strong visual hierarchy
3. **Benefits/Features** use restrained typography with clear scanning patterns
4. **CTA sections** create visual punctuation, not noise
5. **Spacing** increases toward the end to allow breathing room before conversion

### Proposal-Specific Typography Scale
- **Headline**: 4xl-6xl, bold, dominant
- **Section titles**: 2xl-3xl, semi-bold
- **Body**: base-lg, regular weight
- **Captions/Meta**: sm, muted color

### Proposal Color Philosophy
- Primary color for CTAs and key emphasis only
- Neutral palette for content hierarchy
- Maximum 2 accent colors per proposal
- White/light backgrounds for readability
- Dark overlays for hero sections (60-80% opacity)
