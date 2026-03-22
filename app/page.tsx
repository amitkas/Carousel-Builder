"use client";

import { useState, useEffect, useRef } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Nunito, Fredoka, Playfair_Display, JetBrains_Mono, Roboto, Open_Sans } from "next/font/google";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  GripVertical,
  Image as ImageIcon,
  Sparkles,
  Wand2,
  Download,
  CheckCircle2,
  AlertCircle,
  Edit2,
  RefreshCw,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type as TypeIcon,
  RotateCcw,
} from "lucide-react";
import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const playfair = Playfair_Display({ subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"] });
const roboto = Roboto({ weight: ["400", "700"], subsets: ["latin"] });
const openSans = Open_Sans({ subsets: ["latin"] });

const FONTS = [
  { name: "Nunito", className: nunito.className },
  { name: "Fredoka", className: fredoka.className },
  { name: "Playfair Display", className: playfair.className },
  { name: "JetBrains Mono", className: jetbrains.className },
  { name: "Roboto", className: roboto.className },
  { name: "Open Sans", className: openSans.className },
];

type Slide = {
  id: string;
  text: string;
  imagePrompt: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
  imageError?: string;
  fontFamily?: string;
  color?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isRTL?: boolean;
  textAlign?: "left" | "center" | "right";
  positionX?: number;
  positionY?: number;
  fontSize?: number;
  bgColor?: string;
  bgOpacity?: number;
};

type Step = "idea" | "mock" | "generating" | "editor";

const STYLES = [
  "3D Render",
  "Minimalist Vector",
  "Photorealistic",
  "Cyberpunk",
  "Watercolor",
  "Corporate Memphis",
  "Line Art",
  "Pop Art",
  "Comics",
  "Infographics",
  "3D Clay",
  "Anime",
];

function SortableSlide({ slide, index, updateSlide, removeSlide }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl shadow-blue-100/50 border-4 border-white flex gap-6 relative group transition-all"
    >
      <div 
        {...attributes} 
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-blue-500 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={20} />
      </div>
      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-100 to-green-100 rounded-2xl flex items-center justify-center font-bold text-blue-600 ml-4 shadow-inner">
        {index + 1}
      </div>
      <div className="flex-grow grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Slide Text
          </label>
          <textarea
            value={slide.text}
            onChange={(e) => updateSlide(slide.id, "text", e.target.value)}
            className="w-full h-24 p-4 bg-white border-2 border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none text-sm shadow-inner transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Image Prompt
          </label>
          <textarea
            value={slide.imagePrompt}
            onChange={(e) => updateSlide(slide.id, "imagePrompt", e.target.value)}
            className="w-full h-24 p-4 bg-white border-2 border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none text-sm shadow-inner transition-all"
          />
        </div>
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={() => removeSlide(slide.id)}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          title="Delete Slide"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

export default function CarouselBuilder() {
  const [step, setStep] = useState<Step>("idea");
  const [idea, setIdea] = useState("");
  const [style, setStyle] = useState(STYLES[0]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isGeneratingMock, setIsGeneratingMock] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestartDialogOpen, setIsRestartDialogOpen] = useState(false);

  const handleRestart = () => {
    setStep("idea");
    setIdea("");
    setSlides([]);
    setCurrentSlideIndex(0);
    setError(null);
    setIsRestartDialogOpen(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSlides((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const generateMock = async () => {
    if (!idea.trim()) {
      setError("Please enter an idea first.");
      return;
    }
    setError(null);
    setIsGeneratingMock(true);
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a LinkedIn carousel outline based on this idea: "${idea}".
The visual style for the images should be: "${style}".
Rules:
- Keep text concise. Max 20 words per slide.
- Hook the reader on the first slide.
- Provide actionable value in the middle slides.
- STRICT RULE: If the idea contains a list (e.g., "6 ways", "5 tips"), you MUST use exactly ONE slide per point/idea. Never combine multiple points onto a single slide.
- End with a strong Call to Action (CTA) on the last slide.
- Total slides: Flexible, but ensure every point gets its own dedicated slide.

For each slide, provide:
1. The text to display on the slide.
2. A detailed image generation prompt that matches the requested visual style and the slide's content. Make sure the prompt explicitly includes the style "${style}".`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: "The text for the slide (max 20 words)",
                },
                imagePrompt: {
                  type: Type.STRING,
                  description: "The detailed image generation prompt",
                },
              },
              required: ["text", "imagePrompt"],
            },
          },
        },
      });

      const jsonStr = response.text?.trim() || "[]";
      const data = JSON.parse(jsonStr);
      const newSlides = data.map((item: any) => ({
        id: Math.random().toString(36).substring(7),
        text: item.text,
        imagePrompt: item.imagePrompt,
      }));
      setSlides(newSlides);
      setStep("mock");
    } catch (e: any) {
      console.error("Failed to generate mock", e);
      setError(e.message || "Failed to generate mock. Please try again.");
    } finally {
      setIsGeneratingMock(false);
    }
  };

  const generateImageForSlide = async (slide: Slide): Promise<Slide> => {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: slide.imagePrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return {
            ...slide,
            imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            isGeneratingImage: false,
            imageError: undefined,
          };
        }
      }
      throw new Error("No image generated");
    } catch (e: any) {
      console.error("Failed to generate image", e);
      return {
        ...slide,
        isGeneratingImage: false,
        imageError: e.message || "Failed to generate image",
      };
    }
  };

  const generateAllImages = async () => {
    setStep("generating");

    // Set all to generating
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        isGeneratingImage: true,
        imageError: undefined,
      })),
    );

    // Generate sequentially to avoid rate limits and show progress
    let currentSlides = [...slides];
    for (let i = 0; i < currentSlides.length; i++) {
      const updatedSlide = await generateImageForSlide(currentSlides[i]);
      currentSlides[i] = updatedSlide;
      setSlides([...currentSlides]);
    }

    setStep("editor");
    setCurrentSlideIndex(0);
  };

  const regenerateSingleImage = async (index: number) => {
    const slideToUpdate = slides[index];
    setSlides((prev) => {
      const newSlides = [...prev];
      newSlides[index] = {
        ...slideToUpdate,
        isGeneratingImage: true,
        imageError: undefined,
      };
      return newSlides;
    });

    const updatedSlide = await generateImageForSlide(slideToUpdate);

    setSlides((prev) => {
      const newSlides = [...prev];
      newSlides[index] = updatedSlide;
      return newSlides;
    });
  };

  const updateSlide = (id: string, field: keyof Slide, value: any) => {
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === id ? { ...slide, [field]: value } : slide
      )
    );
  };

  const addSlide = () => {
    setSlides((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        text: "",
        imagePrompt: `A ${style} style image of...`,
      },
    ]);
  };

  const removeSlide = (id: string) => {
    setSlides((prev) => prev.filter((slide) => slide.id !== id));
  };

  const exportCarousel = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [1080, 1080],
      });

      for (let i = 0; i < slides.length; i++) {
        const slideElement = document.getElementById(`export-slide-${i}`);
        if (!slideElement) continue;

        const imgData = await htmlToImage.toJpeg(slideElement, {
          quality: 0.9,
          pixelRatio: 1,
        });

        if (i > 0) {
          pdf.addPage([1080, 1080], "portrait");
        }

        pdf.addImage(imgData, "JPEG", 0, 0, 1080, 1080);
      }

      pdf.save("linkedin-carousel.pdf");
    } catch (err: any) {
      console.error("Export failed:", err);
      setError("Failed to export carousel. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 selection:bg-blue-200 selection:text-blue-900 ${nunito.className}`}>
      <header className="bg-white/80 backdrop-blur-xl border-b-4 border-white/50 px-6 py-4 grid grid-cols-3 items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 justify-self-start">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 rotate-3 hover:rotate-12 transition-transform">
            <Sparkles size={20} />
          </div>
          <h1 className={`font-bold text-2xl tracking-tight text-blue-600 ${fredoka.className}`}>
            Carousel Builder
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold text-slate-400 justify-self-center hidden sm:flex bg-white/50 px-6 py-2 rounded-full shadow-inner border border-white">
          <span className={step === "idea" ? "text-blue-500" : ""}>
            1. Idea
          </span>
          <ArrowRight size={14} className="opacity-50" />
          <span className={step === "mock" ? "text-blue-500" : ""}>
            2. Outline
          </span>
          <ArrowRight size={14} className="opacity-50" />
          <span
            className={
              step === "generating" || step === "editor" ? "text-blue-500" : ""
            }
          >
            3. Editor
          </span>
        </div>
        <div className="flex items-center gap-2 justify-self-end">
          {step !== "idea" && (
            <button
              onClick={() => setIsRestartDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-95"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Restart</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 py-12">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl flex items-start gap-3 shadow-sm font-bold"
            >
              <AlertCircle className="shrink-0 mt-0.5" size={20} />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}

          {step === "idea" && (
            <motion.div
              key="step-idea"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="space-y-2 text-center">
                <h2 className={`text-4xl font-bold tracking-tight text-slate-800 ${fredoka.className}`}>
                  What&apos;s your carousel about?
                </h2>
                <p className="text-slate-500 text-lg">
                  Share your idea, and we&apos;ll generate a professional
                  LinkedIn carousel outline.
                </p>
              </div>

              <div className="space-y-6 bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-xl shadow-blue-100/50 border-4 border-white">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">
                    Your Idea
                  </label>
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="e.g., 5 tips for writing better React components..."
                    className="w-full h-32 p-4 bg-white border-2 border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all resize-none shadow-inner"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">
                    Visual Style
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 auto-rows-fr">
                    {STYLES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStyle(s)}
                        className={`px-3 py-2 text-sm rounded-2xl border-2 transition-all h-full flex items-center justify-center text-center active:scale-95 ${
                          style === s
                            ? "bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm"
                            : "bg-white border-blue-50 text-slate-600 hover:bg-blue-50/50 hover:border-blue-100"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateMock}
                  disabled={isGeneratingMock || !idea.trim()}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-1 active:scale-95"
                >
                  {isGeneratingMock ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Generating Outline...
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} />
                      Generate Outline
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === "mock" && (
            <motion.div
              key="step-mock"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className={`text-3xl font-bold tracking-tight text-slate-800 ${fredoka.className}`}>
                    Review Outline
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Edit the text and image prompts before generating the final
                    slides.
                  </p>
                </div>
                <button
                  onClick={generateAllImages}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-1 active:scale-95"
                >
                  <ImageIcon size={18} />
                  Generate Images
                </button>
              </div>

              <div className="grid gap-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={slides.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {slides.map((slide, index) => (
                      <SortableSlide
                        key={slide.id}
                        slide={slide}
                        index={index}
                        updateSlide={updateSlide}
                        removeSlide={removeSlide}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>

              <button
                onClick={addSlide}
                className="w-full py-4 border-4 border-dashed border-blue-200 text-blue-500 rounded-3xl hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 font-bold text-lg active:scale-95"
              >
                <Plus size={20} />
                Add Slide
              </button>
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div
              key="step-generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto text-center py-20 space-y-8"
            >
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 border-8 border-blue-100 rounded-full"></div>
                <div className="absolute inset-0 border-8 border-blue-400 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-blue-400 animate-pulse">
                  <ImageIcon size={40} />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className={`text-3xl font-bold tracking-tight text-slate-800 ${fredoka.className}`}>
                  Generating Your Carousel...
                </h2>
                <p className="text-slate-500 text-lg">
                  Creating high-quality images using {style} style.
                </p>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 justify-center max-w-md mx-auto">
                {slides.map((slide, i) => (
                  <div
                    key={slide.id}
                    className={`h-3 rounded-full transition-all duration-500 ${slide.imageUrl ? "bg-green-400 shadow-lg shadow-green-200" : slide.imageError ? "bg-red-400" : slide.isGeneratingImage ? "bg-blue-400 animate-pulse shadow-lg shadow-blue-200" : "bg-blue-100"}`}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {step === "editor" && (
            <motion.div
              key="step-editor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className={`text-3xl font-bold tracking-tight text-slate-800 ${fredoka.className}`}>
                  Final Polish
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("mock")}
                    className="px-4 py-2 bg-white border-2 border-blue-100 text-blue-700 hover:bg-blue-50 rounded-2xl font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                  >
                    Back to Outline
                  </button>
                  <button 
                    onClick={exportCarousel}
                    disabled={isExporting}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-1 active:scale-95"
                  >
                    {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                    {isExporting ? 'Exporting...' : 'Export Carousel'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-8">
                {/* Carousel Preview */}
                <div className="flex-grow flex flex-col items-center space-y-6">
                  <div className="relative w-full max-w-md aspect-square bg-white rounded-[2rem] shadow-2xl shadow-blue-200/50 overflow-hidden border-4 border-white @container">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentSlideIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex flex-col"
                      >
                        {slides[currentSlideIndex].isGeneratingImage ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50 gap-4">
                            <Loader2
                              className="animate-spin text-blue-500"
                              size={40}
                            />
                            <span className="text-sm font-bold text-blue-600">
                              Regenerating image...
                            </span>
                          </div>
                        ) : slides[currentSlideIndex].imageError ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 gap-4 p-6 text-center">
                            <AlertCircle className="text-red-500" size={40} />
                            <span className="text-sm font-bold text-red-600">
                              {slides[currentSlideIndex].imageError}
                            </span>
                          </div>
                        ) : slides[currentSlideIndex].imageUrl ? (
                          <div className="absolute inset-0">
                            <img
                              src={slides[currentSlideIndex].imageUrl}
                              alt="Slide background"
                              className="w-full h-full object-cover"
                            />
                            {/* Gradient overlay for text readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="text-gray-300" size={48} />
                          </div>
                        )}

                        {/* Text Overlay */}
                        <div 
                          className="absolute w-max max-w-[90%] flex flex-col"
                          style={{
                            top: `${slides[currentSlideIndex].positionY ?? 80}%`,
                            left: `${slides[currentSlideIndex].positionX ?? 50}%`,
                            transform: `translate(-50%, -50%)`,
                            textAlign: slides[currentSlideIndex].textAlign || 'left',
                            direction: slides[currentSlideIndex].isRTL ? 'rtl' : 'ltr',
                          }}
                        >
                          <p 
                            className={`leading-tight drop-shadow-md ${slides[currentSlideIndex].fontFamily || FONTS[0].className} ${slides[currentSlideIndex].isBold === false ? 'font-normal' : 'font-bold'} ${slides[currentSlideIndex].isItalic ? 'italic' : ''}`}
                            style={{ 
                              color: slides[currentSlideIndex].color || '#ffffff',
                              fontSize: `${slides[currentSlideIndex].fontSize ?? 6}cqw`,
                              backgroundColor: slides[currentSlideIndex].bgColor ? `${slides[currentSlideIndex].bgColor}${Math.round((slides[currentSlideIndex].bgOpacity ?? 100) * 2.55).toString(16).padStart(2, '0')}` : 'transparent',
                              padding: slides[currentSlideIndex].bgColor ? '2cqw 4cqw' : '0',
                              borderRadius: slides[currentSlideIndex].bgColor ? '2cqw' : '0',
                            }}
                          >
                            {slides[currentSlideIndex].text}
                          </p>
                        </div>
                        {/* Navigation Overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-8 flex items-end justify-between text-white/80 text-sm font-medium pointer-events-none">
                          <span>
                            {currentSlideIndex + 1} / {slides.length}
                          </span>
                          {currentSlideIndex !== slides.length - 1 && (
                            <span className="flex items-center gap-1">
                              Swipe <ArrowRight size={16} />
                            </span>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() =>
                        setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))
                      }
                      disabled={currentSlideIndex === 0}
                      className="p-3 rounded-full bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div className="flex gap-2">
                      {slides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlideIndex(i)}
                          className={`w-3 h-3 rounded-full transition-all ${i === currentSlideIndex ? "bg-blue-600 w-8 shadow-md shadow-blue-200" : "bg-blue-100 hover:bg-blue-200"}`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        setCurrentSlideIndex(
                          Math.min(slides.length - 1, currentSlideIndex + 1),
                        )
                      }
                      disabled={currentSlideIndex === slides.length - 1}
                      className="p-3 rounded-full bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                    >
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>

                {/* Editor Panel */}
                <div className="w-full lg:w-96 bg-white/90 backdrop-blur-md rounded-3xl shadow-xl shadow-blue-100/50 border-4 border-white p-6 space-y-6 h-fit transition-all">
                  <div className="space-y-4">
                    <h3 className={`text-xl font-bold flex items-center gap-2 text-slate-800 ${fredoka.className}`}>
                      <Edit2 size={20} className="text-blue-500" />
                      Edit Slide {currentSlideIndex + 1}
                    </h3>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                        Slide Text
                      </label>
                      <textarea
                        value={slides[currentSlideIndex].text}
                        onChange={(e) =>
                          updateSlide(slides[currentSlideIndex].id, "text", e.target.value)
                        }
                        className="w-full h-24 p-4 bg-blue-50/50 border-2 border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-200 focus:border-blue-300 outline-none resize-none text-sm font-medium text-slate-700 shadow-inner transition-all"
                      />
                    </div>

                    {/* Text Styling Controls */}
                    <div className="space-y-4 pt-4 border-t-2 border-blue-50">
                      <h4 className={`text-lg font-bold text-slate-700 ${fredoka.className}`}>Text Styling</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Font</label>
                          <select 
                            value={slides[currentSlideIndex].fontFamily || FONTS[0].className}
                            onChange={(e) => updateSlide(slides[currentSlideIndex].id, "fontFamily", e.target.value)}
                            className="w-full p-2.5 bg-white border-2 border-blue-100 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-blue-200 focus:border-blue-300 outline-none transition-all"
                          >
                            {FONTS.map(f => <option key={f.name} value={f.className}>{f.name}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Text Color</label>
                          <div className="flex items-center gap-2 bg-white border-2 border-blue-100 rounded-xl p-1">
                            <input 
                              type="color" 
                              value={slides[currentSlideIndex].color || "#ffffff"}
                              onChange={(e) => updateSlide(slides[currentSlideIndex].id, "color", e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                            />
                            <span className="text-xs font-bold text-slate-600 uppercase">{slides[currentSlideIndex].color || "#ffffff"}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Background</label>
                          <div className="flex items-center gap-2 bg-white border-2 border-blue-100 rounded-xl p-1">
                            <input 
                              type="color" 
                              value={slides[currentSlideIndex].bgColor || "#000000"}
                              onChange={(e) => updateSlide(slides[currentSlideIndex].id, "bgColor", e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                            />
                            <button 
                              onClick={() => updateSlide(slides[currentSlideIndex].id, "bgColor", slides[currentSlideIndex].bgColor ? undefined : "#ffffff")}
                              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline px-1"
                            >
                              {slides[currentSlideIndex].bgColor ? 'Remove' : 'Add'}
                            </button>
                          </div>
                        </div>

                        {slides[currentSlideIndex].bgColor && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                              <label>Bg Opacity</label>
                              <span>{slides[currentSlideIndex].bgOpacity ?? 100}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" max="100" 
                              value={slides[currentSlideIndex].bgOpacity ?? 100}
                              onChange={(e) => updateSlide(slides[currentSlideIndex].id, "bgOpacity", parseInt(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={() => updateSlide(slides[currentSlideIndex].id, "isBold", !slides[currentSlideIndex].isBold)}
                          className={`p-2.5 rounded-xl border-2 transition-all ${slides[currentSlideIndex].isBold ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-inner' : 'bg-white border-blue-100 text-slate-600 hover:bg-blue-50 hover:border-blue-200'}`}
                          title="Bold"
                        >
                          <Bold size={18} />
                        </button>
                        
                        <button 
                          onClick={() => updateSlide(slides[currentSlideIndex].id, "isItalic", !slides[currentSlideIndex].isItalic)}
                          className={`p-2.5 rounded-xl border-2 transition-all ${slides[currentSlideIndex].isItalic ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-inner' : 'bg-white border-blue-100 text-slate-600 hover:bg-blue-50 hover:border-blue-200'}`}
                          title="Italic"
                        >
                          <Italic size={18} />
                        </button>

                        <div className="w-1 h-8 bg-blue-100 rounded-full mx-1" />

                        <button 
                          onClick={() => updateSlide(slides[currentSlideIndex].id, "textAlign", "left")}
                          className={`p-2.5 rounded-xl border-2 transition-all ${(!slides[currentSlideIndex].textAlign || slides[currentSlideIndex].textAlign === 'left') ? 'bg-green-100 border-green-300 text-green-700 shadow-inner' : 'bg-white border-blue-100 text-slate-600 hover:bg-green-50 hover:border-green-200'}`}
                        >
                          <AlignLeft size={18} />
                        </button>
                        <button 
                          onClick={() => updateSlide(slides[currentSlideIndex].id, "textAlign", "center")}
                          className={`p-2.5 rounded-xl border-2 transition-all ${slides[currentSlideIndex].textAlign === 'center' ? 'bg-green-100 border-green-300 text-green-700 shadow-inner' : 'bg-white border-blue-100 text-slate-600 hover:bg-green-50 hover:border-green-200'}`}
                        >
                          <AlignCenter size={18} />
                        </button>
                        <button 
                          onClick={() => updateSlide(slides[currentSlideIndex].id, "textAlign", "right")}
                          className={`p-2.5 rounded-xl border-2 transition-all ${slides[currentSlideIndex].textAlign === 'right' ? 'bg-green-100 border-green-300 text-green-700 shadow-inner' : 'bg-white border-blue-100 text-slate-600 hover:bg-green-50 hover:border-green-200'}`}
                        >
                          <AlignRight size={18} />
                        </button>

                        <div className="w-1 h-8 bg-blue-100 rounded-full mx-1" />

                        <button 
                          onClick={() => updateSlide(slides[currentSlideIndex].id, "isRTL", !slides[currentSlideIndex].isRTL)}
                          className={`p-2.5 rounded-xl border-2 transition-all ${slides[currentSlideIndex].isRTL ? 'bg-yellow-100 border-yellow-300 text-yellow-700 shadow-inner' : 'bg-white border-blue-100 text-slate-600 hover:bg-yellow-50 hover:border-yellow-200'}`}
                          title="Right-to-Left (Hebrew/Arabic)"
                        >
                          <TypeIcon size={18} />
                        </button>
                      </div>

                      <div className="space-y-4 pt-4 border-t-2 border-blue-50">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-500">
                            <label>Text Size</label>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{slides[currentSlideIndex].fontSize ?? 6}</span>
                          </div>
                          <input 
                            type="range" 
                            min="2" max="20" step="0.5"
                            value={slides[currentSlideIndex].fontSize ?? 6}
                            onChange={(e) => updateSlide(slides[currentSlideIndex].id, "fontSize", parseFloat(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-500">
                            <label>Horizontal Position</label>
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{slides[currentSlideIndex].positionX ?? 50}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" max="100" 
                            value={slides[currentSlideIndex].positionX ?? 50}
                            onChange={(e) => updateSlide(slides[currentSlideIndex].id, "positionX", parseInt(e.target.value))}
                            className="w-full accent-green-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-500">
                            <label>Vertical Position</label>
                            <span>{slides[currentSlideIndex].positionY ?? 80}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" max="100" 
                            value={slides[currentSlideIndex].positionY ?? 80}
                            onChange={(e) => updateSlide(slides[currentSlideIndex].id, "positionY", parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t-2 border-blue-50">
                      <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                        Image Prompt
                      </label>
                      <textarea
                        value={slides[currentSlideIndex].imagePrompt}
                        onChange={(e) =>
                          updateSlide(
                            slides[currentSlideIndex].id,
                            "imagePrompt",
                            e.target.value,
                          )
                        }
                        className="w-full h-32 p-4 bg-blue-50/50 border-2 border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-200 focus:border-blue-300 outline-none resize-none text-sm font-medium text-slate-700 shadow-inner transition-all"
                      />
                    </div>

                    <button
                      onClick={() => regenerateSingleImage(currentSlideIndex)}
                      disabled={slides[currentSlideIndex].isGeneratingImage}
                      className="w-full py-3 bg-white border-2 border-blue-100 hover:bg-blue-50 text-blue-600 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                    >
                      <RefreshCw
                        size={18}
                        className={
                          slides[currentSlideIndex].isGeneratingImage
                            ? "animate-spin"
                            : ""
                        }
                      />
                      Regenerate Image
                    </button>
                  </div>
                </div>
              </div>

              {/* Hidden Export Container */}
              <div className="fixed top-[-20000px] left-[-20000px] flex flex-col pointer-events-none">
                {slides.map((slide, i) => (
                  <div 
                    key={`export-${slide.id}`} 
                    id={`export-slide-${i}`} 
                    className="relative w-[1080px] h-[1080px] overflow-hidden flex-shrink-0 @container"
                    style={{ backgroundColor: "#ffffff", color: "#1a1a1a" }}
                  >
                    {slide.imageUrl ? (
                      <img 
                        src={slide.imageUrl} 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#f3f4f6" }}>
                        <ImageIcon className="w-32 h-32" style={{ color: "#d1d5db" }} />
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2), transparent)" }} />
                    <div 
                      className="absolute w-max max-w-[90%] flex flex-col"
                      style={{
                        top: `${slide.positionY ?? 80}%`,
                        left: `${slide.positionX ?? 50}%`,
                        transform: `translate(-50%, -50%)`,
                        textAlign: slide.textAlign || 'left',
                        direction: slide.isRTL ? 'rtl' : 'ltr',
                      }}
                    >
                      <p 
                        className={`leading-tight drop-shadow-md ${slide.fontFamily || FONTS[0].className} ${slide.isBold === false ? 'font-normal' : 'font-bold'} ${slide.isItalic ? 'italic' : ''}`}
                        style={{ 
                          color: slide.color || '#ffffff',
                          fontSize: `${slide.fontSize ?? 6}cqw`,
                          backgroundColor: slide.bgColor ? `${slide.bgColor}${Math.round((slide.bgOpacity ?? 100) * 2.55).toString(16).padStart(2, '0')}` : 'transparent',
                          padding: slide.bgColor ? '2cqw 4cqw' : '0',
                          borderRadius: slide.bgColor ? '2cqw' : '0',
                        }}
                      >
                        {slide.text}
                      </p>
                    </div>
                    {/* Navigation Overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-16 flex items-end justify-between text-2xl font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                      <span>{i + 1} / {slides.length}</span>
                      {i !== slides.length - 1 && (
                        <span className="flex items-center gap-2">Swipe <ArrowRight size={28} /></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Restart Confirmation Modal */}
      <AnimatePresence>
        {isRestartDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white/90 backdrop-blur-md rounded-[2rem] shadow-2xl shadow-blue-900/20 w-full max-w-md overflow-hidden border-4 border-white"
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <RotateCcw size={32} />
                </div>
                <h3 className={`text-2xl font-bold text-slate-800 ${fredoka.className}`}>Start Over?</h3>
                <p className="text-slate-600 font-medium">
                  This will discard all your current slides and progress. This action cannot be undone.
                </p>
              </div>
              <div className="p-6 bg-slate-50 border-t-2 border-slate-100 flex justify-center gap-4">
                <button
                  onClick={() => setIsRestartDialogOpen(false)}
                  className="px-6 py-3 text-sm font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-2xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestart}
                  className="px-6 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-all shadow-md shadow-red-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                >
                  Yes, Restart
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
