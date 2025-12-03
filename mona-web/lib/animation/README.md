# Animation Utilities

This directory contains animation systems for VRM avatars in Project Mona.

## Components

### 1. Mixamo Animation Loader (`mixamoLoader.ts`)

Loads and retargets Mixamo FBX animations for use with VRM avatars.

**Usage:**
```typescript
import { loadMixamoAnimation } from "@/lib/animation";

const animationClip = await loadMixamoAnimation("/animations/wave.fbx", vrm);
const mixer = new THREE.AnimationMixer(vrm.scene);
const action = mixer.clipAction(animationClip);
action.play();
```

**Features:**
- Automatic bone name mapping from Mixamo to VRM humanoid
- Height scaling for proper avatar proportions
- VRM 0.x and 1.0 coordinate system handling

### 2. Lip Sync Manager (`lipSyncManager.ts`)

Real-time lip sync animation driven by audio analysis.

**Usage:**
```typescript
import { LipSyncManager } from "@/lib/animation";

const lipSync = new LipSyncManager(vrm, {
  smoothingFactor: 0.2,
  amplitudeScale: 1.0,
});

await lipSync.setupAudio("/audio/speech.wav");
await lipSync.play();

// In your animation loop:
function animate() {
  lipSync.update();
  requestAnimationFrame(animate);
}
```

**How it works:**
- Analyzes audio using Web Audio API (FFT analysis)
- Calculates RMS amplitude for mouth opening intensity
- Uses spectral centroid to classify vowel shapes (aa, ee, ih, oh, ou)
- Applies exponential smoothing for natural transitions

**Configuration:**
```typescript
lipSync.updateConfig({
  smoothingFactor: 0.3,      // 0-1, higher = smoother but slower response
  amplitudeThreshold: 0.005, // Minimum volume to trigger mouth movement
  amplitudeScale: 1.5,       // Multiplier for mouth opening size
  centroidThresholds: {
    wide: 0.75,  // Threshold for "ee" sounds (bright)
    ih: 0.5,     // Threshold for "ih" sounds (mid)
    oh: 0.25,    // Threshold for "oh" sounds (dark)
  },
});
```

### 3. Mixamo Rig Map (`mixamoRigMap.ts`)

Bone name mapping table between Mixamo and VRM humanoid specifications.

## Integration with VRMAvatar Component

To use these utilities with the existing `VRMAvatar` component:

```typescript
// Add to VRMAvatar props
interface VRMAvatarProps {
  url: string;
  emotion: EmotionData | null;
  gestureAnimation?: THREE.AnimationClip;
  lipSyncAudio?: string;
}

// In the component:
const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
const lipSyncRef = useRef<LipSyncManager | null>(null);

useEffect(() => {
  if (vrm && gestureAnimation) {
    const animMixer = new THREE.AnimationMixer(vrm.scene);
    const action = animMixer.clipAction(gestureAnimation);
    action.play();
    setMixer(animMixer);
  }
}, [vrm, gestureAnimation]);

useEffect(() => {
  if (vrm && lipSyncAudio) {
    lipSyncRef.current = new LipSyncManager(vrm);
    lipSyncRef.current.setupAudio(lipSyncAudio).then(() => {
      lipSyncRef.current?.play();
    });
  }
}, [vrm, lipSyncAudio]);

useFrame((_, delta) => {
  mixer?.update(delta);
  lipSyncRef.current?.update();
  // ... existing idle animation code
});
```

## Future Enhancements

- **Gesture Queue System**: Chain multiple gesture animations
- **Emotion-to-Gesture Mapping**: Auto-trigger gestures based on emotion state
- **Custom Animation Blending**: Smooth transitions between idle and gestures
- **Phoneme Viseme Mapping**: More accurate mouth shapes per language
