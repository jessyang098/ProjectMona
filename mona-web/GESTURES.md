# Gesture Animation System

Week 5 completion - Emotion-driven gesture animations using Mixamo FBX files.

## What's Implemented

✅ **Gesture Manager** ([gestureManager.ts](lib/animation/gestureManager.ts))
- Loads and manages Mixamo FBX animations
- Triggers gestures based on current emotion
- Automatic random gesture playback
- Manual gesture triggering
- Priority-based gesture selection

✅ **VRM Integration** ([VRMAvatar.tsx](components/VRMAvatar.tsx))
- Gesture manager lifecycle management
- Emotion tracking and gesture updates
- Animation mixer updates in render loop
- Proper cleanup on unmount

✅ **Animation Folder** ([public/animations/](../public/animations/))
- Ready for Mixamo FBX files
- README with download instructions
- Supports 8 gesture types

## How It Works

### 1. Emotion → Gesture Mapping

Each gesture is configured with:
- **Trigger emotions**: Which emotions can trigger this gesture
- **Priority**: Higher = more likely to be selected
- **Path**: Location of the FBX file

```typescript
{
  name: "wave",
  path: "/animations/wave.fbx",
  triggerEmotions: ["happy", "excited"],
  priority: 8
}
```

### 2. Automatic Playback

The system automatically:
- Monitors current emotion state
- Triggers random gestures every 10-20 seconds
- Selects gestures appropriate for the emotion
- Weighs selection by priority

### 3. Manual Triggering

You can manually trigger gestures:
```typescript
gestureManager.playGesture("wave");
gestureManager.playRandomGesture();
```

## Gesture Types

| Gesture | Emotions | Priority | Description |
|---------|----------|----------|-------------|
| `wave` | happy, excited | 8 | Friendly wave |
| `excited_jump` | excited | 9 | Energetic jump |
| `thinking` | curious | 7 | Contemplative pose |
| `looking_around` | curious | 6 | Scanning motion |
| `shy_gesture` | embarrassed | 8 | Bashful gesture |
| `dismissing` | embarrassed | 7 | Hand wave-off |
| `sad_idle` | sad, concerned | 6 | Dejected pose |
| `standing_idle` | neutral | 5 | Neutral standing |

## Configuration

Gesture behavior can be customized in [VRMAvatar.tsx:205](components/VRMAvatar.tsx#L205):

```typescript
new GestureManager(vrm, {
  gestureChance: 0.4,        // 40% chance to trigger
  minGestureInterval: 10,    // Minimum 10s between gestures
  maxGestureInterval: 20,    // Maximum 20s between gestures
  autoRandomGestures: true,  // Enable automatic triggering
});
```

## Download Animations

### Step 1: Go to Mixamo
Visit https://www.mixamo.com/ and sign in (free Adobe account)

### Step 2: Download Settings
For EACH animation:
- **Format**: FBX for Unity (.fbx)
- **Skin**: Without Skin ⚠️ IMPORTANT
- **Frame rate**: 30
- **Uniform**: ☑ (if available)

### Step 3: Required Files

Download and save to `mona-web/public/animations/`:

1. **wave.fbx** - Search "Wave"
2. **excited.fbx** - Search "Excited"
3. **thinking.fbx** - Search "Thinking"
4. **looking_around.fbx** - Search "Looking Around"
5. **shy.fbx** - Search "Shy"
6. **dismissing.fbx** - Search "Dismissing Gesture"
7. **sad_idle.fbx** - Search "Sad Idle"
8. **standing_idle.fbx** - Search "Standing Idle"

### Step 4: Verify

Start the app and check console:
```
🎭 Creating GestureManager
Loading gesture animations...
✓ Loaded gesture: wave
✓ Loaded gesture: excited
...
✓ Loaded 8/8 gestures
```

## Testing

### See Gestures in Action

1. Start frontend: `npm run dev`
2. Chat with Mona
3. Watch for automatic gestures every 10-20 seconds
4. Gestures match her emotion (happy = wave, curious = thinking, etc.)

### Debug Logs

Enable gesture logging in console:
```
🎭 Creating GestureManager
🎭 Updated gesture emotion: happy
▶ Playing gesture: wave
```

## Architecture

```
EmotionData (from backend)
     ↓
VRMAvatar.tsx (emotion updates)
     ↓
GestureManager.setEmotion()
     ↓
Auto/Manual trigger
     ↓
mixamoLoader.ts (FBX → Three.js)
     ↓
mixamoRigMap.ts (bone mapping)
     ↓
AnimationMixer (playback)
     ↓
VRM skeleton
```

## Troubleshooting

### Gestures Don't Load
**Check**:
- File names match exactly (case-sensitive)
- Files are in `public/animations/`
- Downloaded "Without Skin"
- Console shows loading errors

### Gestures Look Weird
**Fix**:
- Re-download with "Without Skin" selected
- Verify FBX format (not BVH or Collada)
- Check frame rate is 30fps

### No Gestures Play
**Check**:
- Console shows gesture manager initialization
- Current emotion matches trigger emotions
- `autoRandomGestures` is `true`
- Wait 10-20 seconds for automatic trigger

### Animations Are Too Frequent/Rare
**Adjust** in [VRMAvatar.tsx:206-208](components/VRMAvatar.tsx#L206-L208):
```typescript
gestureChance: 0.4,        // Lower = less frequent
minGestureInterval: 10,    // Increase for longer gaps
maxGestureInterval: 20,    // Increase for longer gaps
```

## Adding Custom Gestures

1. Download FBX from Mixamo
2. Save to `public/animations/your_gesture.fbx`
3. Add to [gestureManager.ts:18](lib/animation/gestureManager.ts#L18):

```typescript
{
  name: "your_gesture",
  path: "/animations/your_gesture.fbx",
  triggerEmotions: ["happy"],
  priority: 7,
}
```

4. Add type to [gestureManager.ts:12](lib/animation/gestureManager.ts#L12):

```typescript
export type GestureName =
  | "wave"
  | "your_gesture"  // Add here
  | ...
```

## Week 5 Complete! 🎉

All voice and animation features done:
- ✅ Voice input (ASR - Whisper)
- ✅ Voice output (TTS - OpenAI + GPT-SoVITS)
- ✅ Lip sync (real-time audio analysis)
- ✅ Gesture animations (Mixamo integration)

**Next**: Download the 8 animations from Mixamo and watch Mona come alive!
