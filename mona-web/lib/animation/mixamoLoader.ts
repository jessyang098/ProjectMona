import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { MIXAMO_TO_VRM_BONE_MAP } from "./mixamoRigMap";

/**
 * Loads a Mixamo animation file (FBX format) and retargets it for use with VRM avatars.
 *
 * @param url - URL or path to the Mixamo FBX animation file
 * @param vrm - Target VRM avatar instance
 * @returns Promise resolving to a VRM-compatible AnimationClip
 */
export async function loadMixamoAnimation(
  url: string,
  vrm: VRM
): Promise<THREE.AnimationClip> {
  const fbxLoader = new FBXLoader();

  console.log(`📦 Loading FBX: ${url}`);
  const animationAsset = await fbxLoader.loadAsync(url);
  console.log(`📦 FBX loaded: ${url}, animations count: ${animationAsset.animations.length}`);

  // Log all available animations for debugging
  if (animationAsset.animations.length > 0) {
    console.log(`📦 Available animations in ${url}:`, animationAsset.animations.map(a => `"${a.name}" (${a.duration.toFixed(2)}s)`).join(', '));
  }

  // Extract the animation clip from the loaded FBX
  // Try "mixamo.com" first (standard Mixamo export), then fall back to first animation
  let sourceClip = THREE.AnimationClip.findByName(
    animationAsset.animations,
    "mixamo.com"
  );

  if (!sourceClip && animationAsset.animations.length > 0) {
    // Use first animation if "mixamo.com" not found
    sourceClip = animationAsset.animations[0];
    console.log(`ℹ️ Using animation "${sourceClip.name}" from ${url} (no "mixamo.com" clip found)`);
  }

  if (!sourceClip) {
    console.error(`❌ No animation found in ${url}`);
    throw new Error(`No animation found in ${url}`);
  }

  // Calculate height scale factor between Mixamo rig and VRM avatar
  // Try both naming conventions: "mixamorigHips" and "mixamorig:Hips"
  let mixamoHipsNode = animationAsset.getObjectByName("mixamorigHips");
  if (!mixamoHipsNode) {
    mixamoHipsNode = animationAsset.getObjectByName("mixamorig:Hips");
  }
  if (!mixamoHipsNode) {
    // Log available bones for debugging
    const bones: string[] = [];
    animationAsset.traverse((obj) => {
      if (obj.type === 'Bone') bones.push(obj.name);
    });
    console.error(`❌ Mixamo rig not found in ${url}. Available bones:`, bones.slice(0, 20).join(', '));
    throw new Error("Mixamo rig not found - missing 'mixamorigHips' node");
  }
  console.log(`📦 Mixamo hips found at height: ${mixamoHipsNode.position.y}`)

  const mixamoHipsHeight = mixamoHipsNode.position.y;
  const vrmHipsPosition = vrm.humanoid.normalizedRestPose.hips?.position;
  if (!vrmHipsPosition) {
    throw new Error("VRM hips position not found in normalizedRestPose");
  }
  const vrmHipsHeight = vrmHipsPosition[1];
  const heightScale = vrmHipsHeight / mixamoHipsHeight;

  // Convert tracks to VRM bone space
  const vrmTracks: THREE.KeyframeTrack[] = [];

  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const workQuaternion = new THREE.Quaternion();

  for (const track of sourceClip.tracks) {
    const [mixamoBoneName, propertyName] = track.name.split(".");

    // Normalize bone name: convert "mixamorig:Hips" to "mixamorigHips"
    const normalizedBoneName = mixamoBoneName.replace("mixamorig:", "mixamorig");

    // Map Mixamo bone to VRM bone
    const vrmBoneName = MIXAMO_TO_VRM_BONE_MAP[normalizedBoneName] as VRMHumanBoneName | undefined;
    if (!vrmBoneName) continue;

    const vrmBoneNode = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName);
    if (!vrmBoneNode) continue;

    // Try both naming conventions for bone lookup
    let mixamoBoneNode = animationAsset.getObjectByName(mixamoBoneName);
    if (!mixamoBoneNode) {
      mixamoBoneNode = animationAsset.getObjectByName(normalizedBoneName);
    }
    if (!mixamoBoneNode) continue;

    // Store rest pose rotations for retargeting
    mixamoBoneNode.getWorldQuaternion(restRotationInverse).invert();
    mixamoBoneNode.parent?.getWorldQuaternion(parentRestWorldRotation);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // Retarget rotation keyframes
      const retargetedValues = new Float32Array(track.values.length);

      for (let i = 0; i < track.values.length; i += 4) {
        workQuaternion.fromArray(track.values, i);

        // Apply retargeting: parent rest rotation * track rotation * inverse rest rotation
        workQuaternion
          .premultiply(parentRestWorldRotation)
          .multiply(restRotationInverse);

        workQuaternion.toArray(retargetedValues, i);
      }

      // Note: VRM 0.x coordinate system flip was previously applied here,
      // but the retargeting math above already handles the coordinate transform correctly
      const finalValues = retargetedValues;

      vrmTracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmBoneNode.name}.${propertyName}`,
          track.times,
          finalValues
        )
      );
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      // Retarget position keyframes (primarily for hips)
      // Apply height scaling to match VRM avatar proportions
      const scaledValues = track.values.map((value) => value * heightScale);

      vrmTracks.push(
        new THREE.VectorKeyframeTrack(
          `${vrmBoneNode.name}.${propertyName}`,
          track.times,
          scaledValues
        )
      );
    }
  }

  return new THREE.AnimationClip("gesture", sourceClip.duration, vrmTracks);
}
