"use client";

import { useState, useRef, useCallback } from "react";

interface SelectedImage {
  file: File;
  preview: string;
  base64: string;
}

export function useImageUpload(showToast?: (msg: string, type?: string) => void) {
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast?.('Please select an image file', 'warning');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast?.('Image must be less than 10MB', 'warning');
      return;
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage({ file, preview, base64 });
    };
    reader.readAsDataURL(file);
  }, []);

  const clearSelectedImage = useCallback(() => {
    if (selectedImage?.preview) {
      URL.revokeObjectURL(selectedImage.preview);
    }
    setSelectedImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, [selectedImage]);

  return {
    selectedImage,
    imageInputRef,
    handleImageSelect,
    clearSelectedImage,
  };
}
