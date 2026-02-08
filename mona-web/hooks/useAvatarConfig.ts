"use client";

import { useState } from "react";
import { OutfitVisibility, AvatarId } from "@/components/AvatarStage";

const DEFAULT_OUTFIT: OutfitVisibility = {
  shirt: true,
  skirt: true,
  socks: true,
  shoes: true,
  colorVariant: false,
  lingerie: false,
};

export function useAvatarConfig() {
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>("moe");
  const [outfitVisibility, setOutfitVisibility] = useState<OutfitVisibility>(DEFAULT_OUTFIT);
  const [showOutfitMenu, setShowOutfitMenu] = useState(false);

  return {
    selectedAvatar,
    setSelectedAvatar,
    outfitVisibility,
    setOutfitVisibility,
    showOutfitMenu,
    setShowOutfitMenu,
  };
}
