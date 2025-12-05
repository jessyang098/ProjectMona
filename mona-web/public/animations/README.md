# Gesture Animations

This folder contains Mixamo FBX animation files for Mona's gestures.

## Download Instructions

1. Go to [Mixamo](https://www.mixamo.com/) and sign in (free Adobe account)
2. Select any character (doesn't matter, we only need bones)
3. Download these animations with these settings:

### Download Settings
- **Format**: FBX for Unity (.fbx)
- **Skin**: Without Skin
- **Frame rate**: 30
- **Uniform**: ☑ (if available)

### Required Animations

#### Happy/Excited (2 animations)
- `wave.fbx` - Search "Wave" → Download any friendly wave
- `excited.fbx` - Search "Excited" → Download energetic movement

#### Curious (2 animations)
- `thinking.fbx` - Search "Thinking" → Download contemplative pose
- `looking_around.fbx` - Search "Looking Around" → Download scanning motion

#### Embarrassed (2 animations)
- `shy.fbx` - Search "Shy" → Download bashful gesture
- `dismissing.fbx` - Search "Dismissing Gesture" → Download hand wave-off

#### Sad/Concerned (1 animation)
- `sad_idle.fbx` - Search "Sad Idle" → Download dejected pose

#### Neutral (1 animation)
- `standing_idle.fbx` - Search "Standing Idle" → Download neutral standing

## File Structure

```
animations/
├── wave.fbx
├── excited.fbx
├── thinking.fbx
├── looking_around.fbx
├── shy.fbx
├── dismissing.fbx
├── sad_idle.fbx
└── standing_idle.fbx
```

## Testing

Once you've downloaded the animations, they'll automatically load when you start the app!

To test:
1. Start the frontend: `npm run dev`
2. Open browser console
3. Look for: `✓ Loaded X/8 gestures`
4. Chat with Mona and watch for gesture animations!

## Troubleshooting

- **Animations don't load**: Check file names match exactly (case-sensitive)
- **Gestures look weird**: Make sure you selected "Without Skin" when downloading
- **No gestures play**: Check browser console for loading errors
