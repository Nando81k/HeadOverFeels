# Apple-Style Scroll Animation Guide - Quick Reference

## 🎬 Animation Types Available

| Animation | Component | Use Case | Example Location |
|-----------|-----------|----------|------------------|
| **Progress Bar** | `ScrollProgressBar` | Show scroll progress | Top of page |
| **Parallax** | `ParallaxSection` | Add depth | Hero backgrounds |
| **Fade** | `FadeOnScroll` | Smooth transitions | Hero sections |
| **Reveal** | `ScrollReveal` | Element entry | All sections |
| **Stagger** | `StaggerScrollChildren` | Sequential reveals | Value cards |
| **Scale** | `ScaleOnScroll` | Breathing effect | Headers |
| **Text Reveal** | `TextReveal` | Dramatic text | Headlines |
| **Pinning** | `PinnedSection` | Apple-style showcase | Product demos |
| **Horizontal** | `HorizontalScroll` | Galleries | Product carousels |
| **Rotate** | `RotateOnScroll` | Dynamic movement | Icons, products |

## 📝 Quick Usage Examples

### 1. Simple Fade In Reveal
```tsx
<ScrollReveal variant="fade" duration={0.8}>
  <YourComponent />
</ScrollReveal>
```

### 2. Slide Up with Stagger Children
```tsx
<ScrollReveal variant="slideUp">
  <StaggerScrollChildren staggerDelay={0.15}>
    <StaggerScrollItem>Item 1</StaggerScrollItem>
    <StaggerScrollItem>Item 2</StaggerScrollItem>
  </StaggerScrollChildren>
</ScrollReveal>
```

### 3. Parallax Background
```tsx
<ParallaxSection speed={0.6}>
  <HeroSection />
</ParallaxSection>
```

### 4. Text Reveal Word by Word
```tsx
<TextReveal 
  text="Your Amazing Headline" 
  mode="word"
  className="text-4xl font-bold"
/>
```

### 5. Pinned Scroll Experience (Apple-style)
```tsx
<PinnedSection height="400vh">
  <YourStickyContent />
</PinnedSection>
```

## 🎯 Home Page Animation Flow

```
┌─────────────────────────────────────┐
│   Scroll Progress Bar (fixed top)   │
└─────────────────────────────────────┘
              ↓ Scroll Down
┌─────────────────────────────────────┐
│  Neon Hero (Parallax + Fade Out)    │
│  - Background moves slower (0.6x)   │
│  - Fades as you scroll               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Drop Hero (Scale Reveal)            │
│  - Scales from 0.8 to 1.0            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Best Sellers (Slide Right)          │
│  - Slides in from left               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Categories (Blur Reveal)            │
│  - Blurs from 10px to 0              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Mission (Slide Up + Stagger)        │
│  - Header: Text Reveal               │
│  - Cards: Stagger 0.15s delay        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│                                      │
│     PINNED SHOWCASE (400vh)          │
│                                      │
│  Product stays centered while:       │
│  Stage 1 (0-25%):  "Premium Mats"   │
│  Stage 2 (25-50%): "Timeless"       │
│  Stage 3 (50-75%): "Limited Ed"     │
│  Stage 4 (75-100%):"Sustainable"    │
│                                      │
│  Product also:                       │
│  - Scales 0.8 → 1.2                  │
│  - Rotates 0° → 360°                 │
│                                      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  View All (Parallax + Scale)         │
│  - Text Reveal on headline           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Newsletter (Blur + Scale)           │
│  - Breathing effect on container     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│            Footer                    │
└─────────────────────────────────────┘
```

## ⚙️ Customization Options

### ScrollReveal Variants
- `fade` - Opacity only
- `slideUp` - From bottom
- `slideLeft` - From right
- `slideRight` - From left
- `scale` - Size change
- `blur` - Blur effect

### Timing Controls
```tsx
<ScrollReveal 
  variant="slideUp"
  duration={0.8}      // Animation duration
  delay={0.2}         // Start delay
/>
```

### Parallax Speed
```tsx
<ParallaxSection speed={0.5}>  {/* 0.5 = half speed */}
<ParallaxSection speed={0.7}>  {/* 0.7 = slower */}
```

### Scale Range
```tsx
<ScaleOnScroll scaleRange={[0.8, 1]}>  {/* Grows */}
<ScaleOnScroll scaleRange={[1, 0.8]}>  {/* Shrinks */}
```

## 🚀 Performance Tips

1. **Use `once: true`** for reveals that shouldn't re-animate
2. **Avoid animating** `width`, `height`, `top`, `left`
3. **Prefer** `transform` and `opacity` (GPU accelerated)
4. **Use spring physics** for natural motion
5. **Add margin to IntersectionObserver** to pre-load animations

## 🎨 Design Principles

- **Subtle is Better**: Don't overdo animations
- **Context Matters**: Match animation to content importance
- **Performance First**: Always test on mobile devices
- **Accessibility**: Respect `prefers-reduced-motion`
- **Consistency**: Use similar animations for similar elements

## 📱 Mobile Considerations

- All animations work on mobile
- Touch-optimized scroll physics
- Pinned sections adapt to screen size
- Reduced animation complexity on low-end devices

## 🔧 Troubleshooting

### Animation Not Triggering?
- Check if component is in viewport
- Verify `once` setting
- Inspect margin offset

### Janky Scrolling?
- Ensure using transform/opacity only
- Check for layout-triggering properties
- Reduce animation complexity

### Text Not Revealing?
- Verify text prop is string
- Check className inheritance
- Inspect stagger timing

## 🎓 Learn More

See `docs/APPLE-SCROLL-ANIMATIONS.md` for comprehensive documentation including:
- Detailed technical implementation
- Performance metrics
- Browser compatibility
- Future enhancement opportunities
