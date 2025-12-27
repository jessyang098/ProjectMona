import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { MIXAMO_TO_VRM_BONE_MAP } from "./mixamoRigMap";

// Bones that need X-axis flip correction for avatars with inverted arm orientations
const ARM_BONES: VRMHumanBoneName[] = [
  "leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand",
  "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand",
  "leftThumbMetacarpal", "leftThumbProximal", "leftThumbDistal",
  "leftIndexProximal", "leftIndexIntermediate", "leftIndexDistal",
  "leftMiddleProximal", "leftMiddleIntermediate", "leftMiddleDistal",
  "leftRingProximal", "leftRingIntermediate", "leftRingDistal",
  "leftLittleProximal", "leftLittleIntermediate", "leftLittleDistal",
  "rightThumbMetacarpal", "rightThumbProximal", "rightThumbDistal",
  "rightIndexProximal", "rightIndexIntermediate", "rightIndexDistal",
  "rightMiddleProximal", "rightMiddleIntermediate", "rightMiddleDistal",
  "rightRingProximal", "rightRingIntermediate", "rightRingDistal",
  "rightLittleProximal", "rightLittleIntermediate", "rightLittleDistal",
] as VRMHumanBoneName[];

/**
 * Detects if a VRM avatar has inverted arm orientations (pointing -X instead of +X)
 * This is common in some non-VRoid avatars exported with incorrect bone orientations
 */
function detectInvertedArms(vrm: VRM): boolean {
  const leftUpperArm = vrm.humanoid?.getRawBoneNode("leftUpperArm");
  if (!leftUpperArm) return false;

  // Check if the left arm points in -X direction (inverted)
  // Normal VRM: left arm should have positive X translation from shoulder
  const worldPos = new THREE.Vector3();
  leftUpperArm.getWorldPosition(worldPos);

  const shoulder = vrm.humanoid?.getRawBoneNode("leftShoulder");
  if (shoulder) {
    const shoulderPos = new THREE.Vector3();
    shoulder.getWorldPosition(shoulderPos);
    // If arm is to the right of shoulder (in world space), it's inverted
    // In VRM, left arm should be at negative X from center
    const armDirection = worldPos.x - shoulderPos.x;
    // Inverted if left arm is in positive X direction from shoulder
    return armDirection > 0;
  }

  return false;
}

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

  // Detect if this avatar has inverted arm orientations
  const hasInvertedArms = detectInvertedArms(vrm);
  if (hasInvertedArms) {
    console.log(`⚠️ Detected inverted arm orientations in VRM, applying corrections`);
  }

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

      // Check if this is an arm bone that needs correction
      const isArmBone = hasInvertedArms && ARM_BONES.includes(vrmBoneName);

      for (let i = 0; i < track.values.length; i += 4) {
        workQuaternion.fromArray(track.values, i);

        // Apply retargeting: parent rest rotation * track rotation * inverse rest rotation
        workQuaternion
          .premultiply(parentRestWorldRotation)
          .multiply(restRotationInverse);

        // Apply arm correction for inverted avatars
        // Flip the rotation around the X axis for arm bones
        if (isArmBone) {
          // Invert Y and Z components to mirror the rotation
          workQuaternion.y = -workQuaternion.y;
          workQuaternion.z = -workQuaternion.z;
        }

        workQuaternion.toArray(retargetedValues, i);
      }

      // Handle VRM 0.x coordinate system flip
      const finalValues = vrm.meta?.metaVersion === "0"
        ? retargetedValues.map((v, i) => (i % 4 === 0 ? -v : v))
        : retargetedValues;

      vrmTracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmBoneNode.name}.${propertyName}`,
          track.times,
          finalValues
        )
      );
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      // Retarget position keyframes (primarily for hips)
      const scaledValues = track.values.map((value, index) => {
        const shouldFlip = vrm.meta?.metaVersion === "0" && index % 3 !== 1;
        return (shouldFlip ? -value : value) * heightScale;
      });

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
