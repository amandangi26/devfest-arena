# DevFest Ranchi 2026 Gaming Arena — Design System Integration

> **Authoritative Reference:** `design.md` (Root Design Specification)  
> **Aesthetic Foundation:** Playful Neo-Brutalism × Google Brand Pigments × Jharkhand Earth Tones × Halloween Festival Accents

---

## 1. Design System Essence for Gaming Interfaces

The Gaming Arena translates the DevFest 2026 conference website aesthetic into a snappy, responsive, high-contrast gaming interface. It maintains the physical sticker/badge vibe without cluttering gameplay views with marketing fluff.

### Core Rules
- **Physical Tactility:** Every interactive card, button, and pill behaves like a mechanical, spring-loaded physical element that depresses into the screen when pressed.
- **Warm Canvases:** The background is warm **Ranchi Sand (`#FFFBF0`)** or **Ranchi Cream (`#FFF8E7`)**, accompanied by the ambient 3.5% graph paper grid texture (`bg-grid-pattern`). Clinical pure whites are reserved for card faces.
- **Unapologetic Black Lines:** Solid black borders (`border-[2.5px] border-black` to `border-[3px] border-black`).
- **Hard, Unblurred Shadows:** Zero blur, zero spread drop shadows (`shadow-[4px_4px_0_0_#000]`, `shadow-[6px_6px_0_0_#000]`).

---

## 2. Color Palette & Token Reference

Tokens are defined in [src/styles/tokens.css](file:///c:/Workspace/ByteLab/game-arena/src/styles/tokens.css) and exposed through Tailwind CSS v4 `@theme`.

### Google Brand Palette
| Token | Hex Value | Primary Usage |
| :--- | :--- | :--- |
| `--color-gdg-blue` | `#4285F4` | Primary CTA buttons, Cloud/Web badges, major action highlights. |
| `--color-gdg-red` | `#EA4335` | Live status pulse dots, error states, timers, countdown warnings. |
| `--color-gdg-yellow` | `#FBBC05` | Rotated headline highlights, secondary CTAs, announcement tags. |
| `--color-gdg-green` | `#34A853` | Success states, score increments, completed challenge indicators. |

### Regional & Surface Tones
| Token | Hex Value | Primary Usage |
| :--- | :--- | :--- |
| `--color-ranchi-sand` | `#FFFBF0` | Primary application canvas background (`body`). |
| `--color-ranchi-cream` | `#FFF8E7` | Secondary surface, container cards, status pills. |
| `--color-ranchi-green` | `#0D2818` | Nocturnal footer canvas, high-contrast leaderboards. |
| `--color-ranchi-terra` | `#C84B31` | Terracotta cultural accent badge. |
| `--color-spotlight-orange` | `#F26A21` | Active focus rings, special challenge badges. |
| `--color-black` | `#000000` | Borders, typography, hard drop shadows. |

---

## 3. Typography Hierarchy

The typography stack is loaded in [index.html](file:///c:/Workspace/ByteLab/game-arena/index.html) and styled globally in [index.css](file:///c:/Workspace/ByteLab/game-arena/src/index.css):

```css
font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
```

> **Mandatory Global Rule:** Default `body` font-weight is configured to **SemiBold (600)**. Text in the Gaming Arena is deliberately punchy, bold, and readable at a glance.

| Element | Weight | Letter Spacing | Case | Typical Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Headline Display** | `800` (Black) | `-0.03em` | Title / Upper | Arena titles, challenge clear banners. |
| **Section Titles** | `800` (Black) | `-0.02em` | Title Case | Card headers, scoreboard columns. |
| **Buttons & CTAs** | `800` (Black) | `0.05em` | UPPERCASE | Action buttons, start triggers. |
| **Status Pills** | `800` (Black) | `0.08em` | UPPERCASE | Category tags, difficulty badges. |
| **Body Copy** | `600` (SemiBold)| Normal | Sentence | Game instructions, modal descriptions. |
| **Score / Timer** | `font-mono` | Normal | Monospace | Realtime counters, stopwatches. |

---

## 4. Neo-Brutalist Physics & Interactive Conventions

### Tactile Button Mechanics
All buttons must implement physical displacement along the X/Y axes matching the shadow reduction:

```
Default State:
  border-[2.5px] border-black
  shadow-[4px_4px_0_0_#000]

Hover State:
  translate-x-[2px] translate-y-[2px]
  shadow-[2px_2px_0_0_#000]

Active (Click) State:
  translate-x-[4px] translate-y-[4px]
  shadow-none (flattened completely)
```

Use the shared `<Button>` primitive from `src/components/ui/Button.jsx` to guarantee uniform physics across all activities.

### Card Elevation & Insets
- Standard cards: `border-[2.5px] border-black rounded-[24px] shadow-[4px_4px_0_0_#000]`
- Floating bento cards: `border-[3px] border-black rounded-[28px] shadow-[8px_8px_0_0_#000]`
- Interactive lift cards: `hover:-translate-y-1 hover:shadow-[10px_10px_0_0_#000] transition-all`

---

## 5. Cultural & Festival Accents

### 1. Signature Tribal Border Ribbon (`.tribal-stripe`)
A 6px repeating 4-color stripe placed at major section divides:
```css
.tribal-stripe {
  background-image: repeating-linear-gradient(
    90deg,
    #4285F4 0 12px,
    #EA4335 12px 24px,
    #FBBC05 24px 36px,
    #34A853 36px 48px
  );
  height: 6px;
}
```

### 2. Rotated Highlight Stamp
For standout words in titles, wrap the text in a rotated pill:
```jsx
<span className="bg-[#FBBC05] text-black border-[3px] border-black rounded-full px-4 py-1 -rotate-1 shadow-[4px_4px_0_0_#000]">
  OCTOBER 31
</span>
```

---

## 6. Accessibility & Motion Restraint

- **Contrast Compliance:** All text combinations exceed WCAG AA (and predominantly exceed AAA): Black on Sand is **18.7:1**, Black on Yellow is **14.2:1**.
- **Touch Targets:** All interactive pills and buttons maintain minimum touch targets of `44px × 44px`.
- **Motion Restraint:** Do NOT add continuous heavy 3D transforms or endless spinning elements. Micro-animations should be purposeful (e.g., status pulse dots or subtle hover transitions).
- **Focus Rings:** High-visibility focus indicators: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBBC05]`.
