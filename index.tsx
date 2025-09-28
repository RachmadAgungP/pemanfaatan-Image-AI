/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality } from '@google/genai';

// --- API Key Dialog Logic ---
declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

async function openApiKeyDialog() {
  if (window.aistudio?.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    alert(
      'API key selection is not available. Please configure the API_KEY environment variable.',
    );
  }
}

// --- App Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar') as HTMLDivElement;
  const openSidebarBtn = document.getElementById(
    'openSidebarBtn',
  ) as HTMLButtonElement;
  const closeSidebarBtn = document.getElementById(
    'closeSidebarBtn',
  ) as HTMLButtonElement;
  const generateBtn = document.getElementById(
    'generateBtn',
  ) as HTMLButtonElement;
  const regenerateBtn = document.getElementById(
    'regenerateBtn',
  ) as HTMLButtonElement;
  const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement;
  const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement;
  const resultsDiv = document.getElementById('results') as HTMLDivElement;
  const noImagesMessage = document.getElementById(
    'noImagesMessage',
  ) as HTMLDivElement;
  const loadingDiv = document.getElementById('loading') as HTMLDivElement;
  const studioColorOptions = document.getElementById(
    'studio-color-options',
  ) as HTMLDivElement;
  const colorButtons = document.querySelectorAll(
    '.color-btn',
  ) as NodeListOf<HTMLButtonElement>;
  const themeButtons = document.querySelectorAll(
    '.theme-btn',
  ) as NodeListOf<HTMLButtonElement>;
  const lightingButtons = document.querySelectorAll(
    '.lighting-btn',
  ) as NodeListOf<HTMLButtonElement>;
  const cameraLensSelect = document.getElementById(
    'cameraLens',
  ) as HTMLSelectElement;
  const tabButtons = document.querySelectorAll(
    '.tab-btn',
  ) as NodeListOf<HTMLButtonElement>;
  const tabContents = document.querySelectorAll(
    '.tab-content',
  ) as NodeListOf<HTMLDivElement>;
  const zoomModal = document.getElementById('zoomModal') as HTMLDivElement;
  const modalImage = document.getElementById('modalImage') as HTMLImageElement;
  const downloadModalBtn = document.getElementById(
    'downloadModalBtn',
  ) as HTMLButtonElement;
  const closeModalBtn = document.getElementById(
    'closeModalBtn',
  ) as HTMLButtonElement;
  const poseAngleButtons = document.querySelectorAll(
    '.pose-angle-btn',
  ) as NodeListOf<HTMLButtonElement>;

  // --- Mobile Sidebar Toggle Logic ---
  const toggleSidebar = () => {
    sidebar.classList.toggle('open');
  };

  openSidebarBtn.addEventListener('click', toggleSidebar);
  closeSidebarBtn.addEventListener('click', toggleSidebar);

  interface UploadedFile {
    file: File;
    base64: string;
    mimeType: string;
  }

  let uploadedFiles: { [key: string]: UploadedFile | null } = {
    productImage_spotlight: null,
    productImage_lifestyle: null,
    modelImage_lifestyle: null,
    otherProductImage_lifestyle: null,
    image_shot_lab: null,
    backgroundImage: null,
  };

  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', event => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        toBase64(file)
          .then(base64 => {
            uploadedFiles[target.id] = {
              file: file,
              base64: base64 as string,
              mimeType: file.type,
            };
          })
          .catch(error =>
            console.error('Error converting file to base64:', error),
          );
      } else {
        uploadedFiles[target.id] = null;
      }
    });
  });

  const imagesToGenerate = 6;
  let currentTab = 'spotlight';
  let imageHistory: string[][] = [];
  let historyIndex = -1;

  // --- PROMPT LISTS ---
  const getSpotlightPrompts = () => [
    `A professional, hyper-detailed photograph of the exact uploaded product. The product is the main subject and must remain consistent. Style: professional food styling, on a rustic wooden table, with minimalist ceramic plate. Lighting: soft, warm natural light. Do not change the product or core elements.`,
    `A clean and modern flat lay photograph of the uploaded product. The item must remain exactly as shown. Style it with curated, high-end accessories (stylish jewelry, leather goods) on a textured marble background. Composition: overhead view. Lighting: soft studio lighting.`,
    `An artistic close-up macro shot of the uploaded product, with a very shallow depth of field. The focus is strictly on the product, remaining perfectly consistent. Use bold, contrasting light to emphasize texture. Minimalist and elegant styling.`,
    `An elegant product photograph. The product must remain the main subject. Place it on a luxurious surface with dramatic shadows and minimal, aesthetically pleasing props. High-end, dramatic feel. Do not change the core product.`,
    `A dynamic product photograph with frozen motion, such as splashes, pouring liquid, or flying particles. The product must remain the same. The lighting is energetic and bold, high-contrast composition. Do not change the product or add new elements.`,
    `An overhead flat lay of a product collection. The uploaded product is the centerpiece. Arrange it perfectly with other stylish props (e.g., silk scarves, small leather goods) to create a professional and visually appealing lookbook shot.`,
  ];

  const getUrbanStreetPrompts = (modelExists: boolean) => [
    `A hyperrealistic cinematic photo captures a dramatic pause on a dimly lit underground subway platform. ${
      modelExists
        ? 'The model stands motionless in an elegant long black coat, his gaze locked directly with the camera.'
        : 'The product is the sole focus.'
    } A vibrant yellow train rushes past in the background, its movement captured with a slow shutter speed to create a brilliant streak of light. The focus is tack-sharp on the subject/product.`,
    `A candid photo of ${
      modelExists
        ? 'the model sitting on a stone staircase in a relaxed pose'
        : 'the product placed on a stone staircase.'
    } They wear a casual white sweatshirt and long wide-leg trousers. The neutral gray stone walls and steps create a minimal, urban backdrop.`,
    `Generate a cinematic side shot of the subject crossing a street in a rainy, red-light district. ${
      modelExists
        ? "The model's head is facing slightly down, holding an umbrella."
        : 'The product is held slightly blurred by rain.'
    } The scene should have moody lighting, reflections on the wet pavement, and a soft backlight halo for a film still look.`,
    `Create a cinematic overhead shot of the subject standing still on a brick city sidewalk, as a motion-blurred crowd rushes past. The image should have moody lighting with a 35mm film look, featuring a shallow depth of field and sharp focus strictly on the subject/product.`,
    `A hyperrealistic cinematic photograph shows a dramatic pause on a dimly lit underground subway platform. The station's warm, atmospheric lighting casts a moody glow on the scene and the arched tiled ceiling.`,
    `A photo of the subject walking outdoors on a crisp autumn day, framed by rustic stone walls and scattered leaves. ${
      modelExists
        ? 'The model has hands casually in pockets.'
        : 'The product is placed on a stone wall.'
    } The muted, nostalgic color palette evokes an old European film.`,
  ];

  const getShotLabPrompts = (basePrompt: string) => [
    `${basePrompt}. Change the angle to a **cinematic low-angle shot**, from a wide perspective, to create a powerful and heroic feel.`,
    `${basePrompt}. Change the angle to an **artistic high-angle shot**, looking down at the subject, to create a sense of scale and artistic composition.`,
    `${basePrompt}. Change the pose to a **dynamic, action pose**.`,
    `${basePrompt}. Change the pose to a **relaxed, casual pose** with a thoughtful expression.`,
    `${basePrompt}. Change the angle to an **eye-level shot**, taken from a side or three-quarter angle to add dynamism.`,
    `${basePrompt}. Change the angle to an **extreme close-up shot**, highlighting minute details like condensation, water droplets, or intricate patterns.`,
  ];

  let selectedColor: string | null = null;
  let selectedTheme: string | null = null;
  let selectedLighting: string | null = null;
  let selectedCameraLens: string | null = null;
  let selectedPoseAngle: string | null = null;

  const updateTab = (tabName: string) => {
    tabButtons.forEach(btn => {
      btn.classList.remove('bg-primary', 'text-white');
      btn.classList.add('bg-gray-200', 'text-gray-800');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('bg-primary', 'text-white');
        btn.classList.remove('bg-gray-200', 'text-gray-800');
      }
    });

    tabContents.forEach(content => {
      content.classList.add('hidden');
      if (content.id === `${tabName}-options`) {
        content.classList.remove('hidden');
      }
    });

    currentTab = tabName;
    resultsDiv.innerHTML = '';
    noImagesMessage.classList.remove('hidden');
    regenerateBtn.classList.add('hidden');
    undoBtn.classList.add('hidden');
    redoBtn.classList.add('hidden');
    imageHistory = [];
    historyIndex = -1;
  };

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => updateTab(btn.dataset.tab!));
  });

  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      themeButtons.forEach(b => b.classList.remove('bg-primary', 'text-white'));
      btn.classList.add('bg-primary', 'text-white');
      selectedTheme = btn.dataset.theme!;

      if (selectedTheme === 'Profesional Studio' || selectedTheme === 'Aura') {
        studioColorOptions.classList.remove('hidden');
      } else {
        studioColorOptions.classList.add('hidden');
        selectedColor = null;
        colorButtons.forEach(b =>
          b.classList.remove('border-primary', 'border-4'),
        );
      }
    });
  });

  colorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      colorButtons.forEach(b =>
        b.classList.remove('border-primary', 'border-4'),
      );
      btn.classList.add('border-primary', 'border-4');
      selectedColor = btn.dataset.color!;
    });
  });

  lightingButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      lightingButtons.forEach(b =>
        b.classList.remove('bg-primary', 'text-white'),
      );
      btn.classList.add('bg-primary', 'text-white');
      selectedLighting = btn.dataset.lighting!;
    });
  });

  cameraLensSelect.addEventListener('change', event => {
    selectedCameraLens = (event.target as HTMLSelectElement).value;
  });

  poseAngleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const isSelected = btn.classList.contains('bg-primary');
      poseAngleButtons.forEach(b =>
        b.classList.remove('bg-primary', 'text-white'),
      );

      if (!isSelected) {
        btn.classList.add('bg-primary', 'text-white');
        selectedPoseAngle = btn.dataset.prompt!;
      } else {
        selectedPoseAngle = null;
      }
    });
  });

  const showModal = (imageSrc: string) => {
    modalImage.src = imageSrc;
    zoomModal.classList.remove('hidden');
  };

  const hideModal = () => {
    zoomModal.classList.add('hidden');
    modalImage.src = '';
  };

  closeModalBtn.addEventListener('click', hideModal);

  downloadModalBtn.addEventListener('click', e => {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = modalImage.src;
    link.download = 'generated_photo.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  const renderImages = (images: string[]) => {
    resultsDiv.innerHTML = '';
    if (images.length === 0) {
      noImagesMessage.classList.remove('hidden');
    } else {
      noImagesMessage.classList.add('hidden');
    }

    images.forEach((imageUrl, index) => {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'group image-container aspect-[9/16]';
      imgContainer.innerHTML = `
                <img src="${imageUrl}" alt="Generated Product Photo" class="w-full h-full object-cover">
                <div class="fixed-buttons">
                    <button class="zoom-btn action-button">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                            <path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clip-rule="evenodd" />
                        </svg>
                        Zoom
                    </button>
                    <button class="download-btn action-button">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                            <path d="M12 2.25a.75.75 0 01.75.75v11.69l3.53-3.53a.75.75 0 111.06 1.06l-4.75 4.75a.75.75 0 01-1.06 0l-4.75-4.75a.75.75 0 111.06-1.06l3.53 3.53V3a.75.75 0 01.75-.75zM9 16.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-2.25a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3v-2.25a.75.75 0 01.75-.75z" />
                        </svg>
                        Download
                    </button>
                    <button class="generate-prompt-btn action-button">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M2.25 6A2.25 2.25 0 0 1 4.5 3.75h1.5a2.25 2.25 0 0 1 2.25 2.25v1.5a2.25 2.25 0 0 1-2.25 2.25h-1.5A2.25 2.25 0 0 1 2.25 7.5V6ZM10.5 6a2.25 2.25 0 0 1 2.25-2.25h1.5A2.25 2.25 0 0 1 16.5 6v1.5a2.25 2.25 0 0 1-2.25 2.25h-1.5A2.25 2.25 0 0 1 10.5 7.5V6ZM2.25 15A2.25 2.25 0 0 1 4.5 12.75h1.5a2.25 2.25 0 0 1 2.25 2.25v1.5a2.25 2.25 0 0 1-2.25 2.25h-1.5a2.25 2.25 0 0 1-2.25-2.25v-1.5ZM10.5 15a2.25 2.25 0 0 1 2.25-2.25h1.5a2.25 2.25 0 0 1 2.25 2.25v1.5a2.25 2.25 0 0 1-2.25 2.25h-1.5a2.25 2.25 0 0 1-2.25-2.25v-1.5ZM19.5 6a2.25 2.25 0 0 1 2.25-2.25h1.5a.75.75 0 0 0 0-1.5h-1.5A3.75 3.75 0 0 0 18 6v1.5a.75.75 0 0 0 1.5 0V6ZM18 15a2.25 2.25 0 0 1 2.25-2.25h1.5a.75.75 0 0 0 0-1.5h-1.5A3.75 3.75 0 0 0 18 15v1.5a.75.75 0 0 0 1.5 0V15Z" /></svg>
                        Generate Prompt
                    </button>
                </div>
            `;

      imgContainer
        .querySelector('.zoom-btn')!
        .addEventListener('click', () => showModal(imageUrl));
      imgContainer.querySelector('.download-btn')!.addEventListener('click', e => {
        e.preventDefault();
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `generated_photo_${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
      imgContainer
        .querySelector('.generate-prompt-btn')!
        .addEventListener('click', () => {
          alert('This feature is coming soon!');
        });

      resultsDiv.appendChild(imgContainer);
    });
    updateButtonStates();
  };

  const updateButtonStates = () => {
    undoBtn.classList.toggle('hidden', historyIndex <= 0);
    redoBtn.classList.toggle('hidden', historyIndex >= imageHistory.length - 1);
  };

  const resetButtons = () => {
    loadingDiv.classList.add('hidden');
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
  };

  const generateImages = async () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert('API key is not configured. Please add your API key.');
      await openApiKeyDialog();
      return;
    }

    noImagesMessage.classList.add('hidden');
    resultsDiv.innerHTML = '';
    loadingDiv.classList.remove('hidden');
    generateBtn.disabled = true;
    regenerateBtn.disabled = true;

    let prompts: string[] = [];
    let productToUse: UploadedFile | null = null;
    let modelToUse: UploadedFile | null = null;
    let error: string | null = null;

    const getFileByTab = (fileKey: string) => {
      return uploadedFiles[fileKey] || null;
    };

    if (currentTab === 'spotlight') {
      if (!getFileByTab('productImage_spotlight')) {
        error = 'Mohon unggah foto produk terlebih dahulu.';
      }
      prompts = getSpotlightPrompts();
      productToUse = getFileByTab('productImage_spotlight');
    } else if (currentTab === 'lifestyle') {
      if (
        !getFileByTab('productImage_lifestyle') ||
        !getFileByTab('modelImage_lifestyle')
      ) {
        error =
          'Mohon unggah foto produk dan foto model/talent terlebih dahulu.';
      }
      prompts = getUrbanStreetPrompts(true);
      productToUse = getFileByTab('productImage_lifestyle');
      modelToUse = getFileByTab('modelImage_lifestyle');
    } else if (currentTab === 'shot-lab') {
      if (!getFileByTab('image_shot_lab')) {
        error = 'Mohon unggah gambar referensi terlebih dahulu di Shot Lab.';
      }
      const basePrompt = `Generate a photo based on the uploaded image. The subject and product must maintain perfect consistency. Change the composition and viewpoint, and nothing else.`;
      if (selectedPoseAngle) {
        prompts = getShotLabPrompts(
          `${basePrompt}. Specific instruction: ${selectedPoseAngle}`,
        );
      } else {
        prompts = getShotLabPrompts(basePrompt);
      }
      productToUse = getFileByTab('image_shot_lab');
      modelToUse = getFileByTab('image_shot_lab');
    }

    if (error) {
      alert(error);
      resetButtons();
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const newImages: string[] = [];

    for (let i = 0; i < imagesToGenerate; i++) {
      let finalPrompt = prompts[i % prompts.length]; // Cycle through prompts

      if (selectedTheme) {
        if (selectedTheme === 'Aura') {
          finalPrompt = `Generate a high-quality, ultra-HD, sharp product photo in 9:16 vertical ratio, perfect portrait aspect. A dramatic, hyperrealistic product photo. The product appears to be levitating in the air, surrounded by frozen crumbs, splashes, or particles in motion. Use bold rim lighting and a macro focus. The background is vibrant to add energy and contrast. `;
          if (selectedColor) {
            finalPrompt += `The background color is ${selectedColor}. `;
          }
        } else if (selectedTheme === 'Dramatic & Dark') {
          finalPrompt = `A professional photograph of the exact uploaded product. The product must be the main subject and remain consistent. Arrange the plate with visually balanced fresh ingredients. Place a small glass bowl with sauce and a black fork/chopsticks. Surround the food with complementary elements. The overall aesthetic is minimalist, cinematic, and appetizing with soft, moody lighting. Use a dark, loose folded linen napkin underneath and around the plate to enhance texture and elegance. `;
        } else if (selectedTheme === 'Urban Street Style') {
          finalPrompt =
            getUrbanStreetPrompts(!!modelToUse)[i % prompts.length];
        } else {
          finalPrompt += `The style and theme is "${selectedTheme}". `;
          if (selectedTheme === 'Profesional Studio' && selectedColor) {
            finalPrompt += `Use a ${selectedColor} background. `;
          }
        }
      }

      if (selectedLighting)
        finalPrompt += `The lighting is "${selectedLighting}". `;
      if (selectedCameraLens)
        finalPrompt += `Shot with a ${selectedCameraLens}. `;
      const description = (
        document.getElementById('description') as HTMLTextAreaElement
      ).value;
      if (description) finalPrompt += `Concept: "${description}". `;
      finalPrompt += ` --ar 9:16 --q 2 --style raw`;

      const payloadParts: any[] = [{ text: finalPrompt }];
      if (productToUse?.base64) {
        payloadParts.push({
          inlineData: {
            mimeType: productToUse.mimeType,
            data: productToUse.base64.split(',')[1],
          },
        });
      }
      if (modelToUse?.base64) {
        payloadParts.push({
          inlineData: {
            mimeType: modelToUse.mimeType,
            data: modelToUse.base64.split(',')[1],
          },
        });
      }
      const otherProduct = getFileByTab('otherProductImage_lifestyle');
      if (otherProduct?.base64) {
        payloadParts.push({
          inlineData: {
            mimeType: otherProduct.mimeType,
            data: otherProduct.base64.split(',')[1],
          },
        });
      }
      const background = getFileByTab('backgroundImage');
      if (background?.base64) {
        payloadParts.push({
          inlineData: {
            mimeType: background.mimeType,
            data: background.base64.split(',')[1],
          },
        });
      }

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: { parts: payloadParts },
          config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
          },
        });

        let imageFound = false;
        for (const part of response.candidates![0].content.parts) {
          if (part.inlineData) {
            const base64Data = part.inlineData.data;
            const imageUrl = `data:${part.inlineData.mimeType};base64,${base64Data}`;
            newImages.push(imageUrl);
            imageFound = true;
            break;
          }
        }
        if (!imageFound) {
          console.warn(
            `No image generated for prompt index ${i}. The prompt may have been blocked.`,
          );
        }
      } catch (e) {
        console.error(`Image generation failed for prompt index ${i}:`, e);
        const errorMessage =
          e instanceof Error ? e.message : 'An unknown error occurred.';
        let userFriendlyMessage = `Error: ${errorMessage}`;
        let shouldOpenDialog = false;

        if (typeof errorMessage === 'string') {
          if (
            errorMessage.includes('API_KEY_INVALID') ||
            errorMessage.includes('API key not valid') ||
            errorMessage.toLowerCase().includes('permission denied')
          ) {
            userFriendlyMessage =
              'Your API key is invalid. Please add a valid API key.';
            shouldOpenDialog = true;
          }
        }
        alert(userFriendlyMessage);
        if (shouldOpenDialog) {
          await openApiKeyDialog();
        }
        break; // Stop after first error
      }
    }

    if (newImages.length > 0) {
      imageHistory = imageHistory.slice(0, historyIndex + 1); // Truncate history if we went back
      imageHistory.push(newImages);
      historyIndex = imageHistory.length - 1;
    }

    renderImages(imageHistory[historyIndex] || []);
    resetButtons();
    regenerateBtn.classList.remove('hidden');
  };

  const toBase64 = (file: File) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

  generateBtn.addEventListener('click', generateImages);
  regenerateBtn.addEventListener('click', generateImages);
  undoBtn.addEventListener('click', () => {
    if (historyIndex > 0) {
      historyIndex--;
      renderImages(imageHistory[historyIndex]);
    }
  });
  redoBtn.addEventListener('click', () => {
    if (historyIndex < imageHistory.length - 1) {
      historyIndex++;
      renderImages(imageHistory[historyIndex]);
    }
  });

  updateTab('spotlight'); // Initialize with the first tab
});
