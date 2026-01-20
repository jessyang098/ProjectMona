/**
 * VRMA Animation Loader
 * Loads VRM-native animation files (.vrma) for use with VRM avatars
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRM } from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
  VRMAnimation,
} from "@pixiv/three-vrm-animation";

// Shared loader instance with VRMA plugin registered
let vrmaLoader: GLTFLoader | null = null;

function getVRMALoader(): GLTFLoader {
  if (!vrmaLoader) {
    vrmaLoader = new GLTFLoader();
    vrmaLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  }
  return vrmaLoader;
}

/**
 * Load a VRMA animation file and convert it to a THREE.AnimationClip
 * @param url Path to the .vrma file
 * @param vrm The VRM model to apply the animation to
 * @returns AnimationClip compatible with the VRM
 */
export async function loadVRMAAnimation(
  url: string,
  vrm: VRM
): Promise<THREE.AnimationClip | null> {
  try {
    const loader = getVRMALoader();
    const gltf = await loader.loadAsync(url);

    // VRMA files store animations in userData.vrmAnimations
    const vrmAnimations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;

    if (!vrmAnimations || vrmAnimations.length === 0) {
      // Warning removed(`No VRM animations found in ${url}`);
      return null;
    }

    // Use the first animation in the file
    const vrmAnimation = vrmAnimations[0];

    // Convert to THREE.AnimationClip compatible with the VRM
    const clip = createVRMAnimationClip(vrmAnimation, vrm);

    // Log removed(`✓ Loaded VRMA animation: ${url} (${clip.duration.toFixed(2)}s)`);
    return clip;
  } catch (error) {
    // Error removed(`Failed to load VRMA animation ${url}:`, error);
    return null;
  }
}

/**
 * Check if a file is a VRMA animation based on extension
 */
export function isVRMAFile(url: string): boolean {
  return url.toLowerCase().endsWith(".vrma");
}
