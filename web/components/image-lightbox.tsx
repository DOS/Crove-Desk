"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  RotateCwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import {
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { translateCurrentMessage } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";

export type ImageLightboxItem = {
  src: string;
  alt?: string;
  svg?: string;
  backgroundColor?: string;
};

type ImageLightboxState = {
  items: ImageLightboxItem[];
  index: number;
};

export type ImageLightboxContextValue = {
  open: (src: string, alt?: string) => void;
  openGallery: (items: ImageLightboxItem[], initialIndex?: number) => void;
  close: () => void;
};

const ImageLightboxContext = createContext<ImageLightboxContextValue | null>(
  null,
);

export function useImageLightbox(): ImageLightboxContextValue {
  const ctx = useContext(ImageLightboxContext);
  if (!ctx) {
    throw new Error(translateCurrentMessage("lightbox.providerError"));
  }
  return ctx;
}

/** Returns null when no provider is mounted, which keeps adoption incremental. */
export function useImageLightboxOptional(): ImageLightboxContextValue | null {
  return useContext(ImageLightboxContext);
}

export type ImageLightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  alt?: string;
  svg?: string;
  backgroundColor?: string;
  currentIndex?: number;
  total?: number;
  onPrevious?: () => void;
  onNext?: () => void;
};

function canOpenInNewTab(url: string): boolean {
  if (!url) {
    return false;
  }
  if (url.startsWith("/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "blob:"
    );
  } catch {
    return false;
  }
}

function LightboxImageBody({
  src,
  alt,
  svg,
  backgroundColor,
  pinchRef,
  rotationDeg,
}: {
  src: string;
  alt?: string;
  svg?: string;
  backgroundColor?: string;
  pinchRef: React.RefObject<ReactZoomPanPinchContentRef | null>;
  rotationDeg: number;
}) {
  const t = useI18n();
  const [imageState, setImageState] = useState<{
    src: string;
    status: "loading" | "loaded" | "error";
  }>({ src, status: "loading" });
  const status = imageState.src === src ? imageState.status : "loading";
  const loading = status === "loading";
  const error = status === "error";
  const showOpenTab = canOpenInNewTab(src);

  useEffect(() => {
    requestAnimationFrame(() => {
      pinchRef.current?.centerView(1, 0);
    });
  }, [rotationDeg, pinchRef]);

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 flex-1">
      {!svg && loading && !error ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          aria-hidden
        >
          <div className="size-10 animate-pulse rounded-full bg-white/25" />
        </div>
      ) : null}
      {!svg && error ? (
        <div className="flex min-h-[min(50vh,320px)] flex-col items-center justify-center gap-4 px-6 py-12 text-center text-sm text-white/90">
          <p>{t("lightbox.loadFailed")}</p>
          {showOpenTab ? (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              {t("lightbox.openInNewTab")}
            </a>
          ) : null}
        </div>
      ) : (
        <TransformWrapper
          ref={pinchRef}
          initialScale={1}
          minScale={0.35}
          maxScale={8}
          centerOnInit
          centerZoomedOut
          limitToBounds
          wheel={{ step: 0.12 }}
          pinch={{ step: 5 }}
          panning={{ velocityDisabled: false }}
          doubleClick={{ mode: "reset", step: 0.7 }}
        >
          <TransformComponent
            wrapperClass="!h-full !w-full !max-h-full !max-w-full"
            contentClass="!flex !h-full !min-h-0 !w-full !min-w-0 !items-center !justify-center !p-4 sm:!p-6"
          >
            {svg ? (
              <div
                role="img"
                aria-label={alt || t("lightbox.previewImage")}
                style={{
                  backgroundColor,
                  transform: `rotate(${rotationDeg}deg)`,
                }}
                className="h-[min(78vh,900px)] w-[min(88vw,1600px)] max-h-[calc(100dvh-5rem)] max-w-[calc(100vw-2rem)] origin-center rounded-xl p-4 transition-transform duration-200 ease-out select-none sm:p-6 [&_svg]:!block [&_svg]:!h-full [&_svg]:!max-h-none [&_svg]:!max-w-none [&_svg]:!w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- External URLs and arbitrary image sizes need native preview. */
              <img
                src={src}
                alt={alt || t("lightbox.previewImage")}
                draggable={false}
                style={{ transform: `rotate(${rotationDeg}deg)` }}
                className="max-h-[min(85vh,calc(100dvh-3rem))] max-w-full origin-center object-contain transition-transform duration-200 ease-out select-none"
                onLoad={() => {
                  setImageState({ src, status: "loaded" });
                  requestAnimationFrame(() => {
                    pinchRef.current?.centerView(1, 0);
                  });
                }}
                onError={() => {
                  setImageState({ src, status: "error" });
                }}
              />
            )}
          </TransformComponent>
        </TransformWrapper>
      )}
    </div>
  );
}

/** Mounted by src key so rotation resets when switching images. */
function ImageLightboxDialogContent({
  src,
  alt,
  svg,
  backgroundColor,
  currentIndex = 0,
  total = 1,
  onPrevious,
  onNext,
}: {
  src: string;
  alt?: string;
  svg?: string;
  backgroundColor?: string;
  currentIndex?: number;
  total?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const t = useI18n();
  const pinchRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const [rotation, setRotation] = useState({ src, degrees: 0 });
  const rotationDeg = rotation.src === src ? rotation.degrees : 0;
  const showOpenTab = canOpenInNewTab(src);
  const titleText = alt?.trim() || t("lightbox.imagePreview");
  const hasGallery = total > 1;

  useEffect(() => {
    requestAnimationFrame(() => {
      pinchRef.current?.resetTransform(0);
    });
  }, [src]);

  useEffect(() => {
    if (!hasGallery) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && onPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && onNext) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [hasGallery, onNext, onPrevious]);

  const rotateLeft = useCallback(() => {
    setRotation({ src, degrees: (rotationDeg - 90 + 360) % 360 });
  }, [rotationDeg, src]);

  const rotateRight = useCallback(() => {
    setRotation({ src, degrees: (rotationDeg + 90) % 360 });
  }, [rotationDeg, src]);

  return (
    <DialogPortal>
      <DialogOverlay className="z-100 bg-black/85 supports-backdrop-filter:backdrop-blur-xs" />
      <DialogPrimitive.Popup
        data-slot="image-lightbox-popup"
        className={cn(
          "fixed inset-0 z-100 flex max-h-dvh min-h-0 flex-col outline-none",
          "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-100",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-black/55 px-2 py-2 text-white sm:gap-3 sm:px-4">
          <DialogTitle className="min-w-0 flex-1 truncate text-left text-sm font-medium leading-snug text-white">
            {titleText}
            {hasGallery ? (
              <span className="ml-2 text-white/60">
                {t("lightbox.position", { current: currentIndex + 1, total })}
              </span>
            ) : null}
          </DialogTitle>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10"
              aria-label={t("lightbox.zoomIn")}
              onClick={() => pinchRef.current?.zoomIn(0.25)}
            >
              <ZoomInIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10"
              aria-label={t("lightbox.zoomOut")}
              onClick={() => pinchRef.current?.zoomOut(0.25)}
            >
              <ZoomOutIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10"
              aria-label={t("lightbox.rotateLeft")}
              onClick={rotateLeft}
            >
              <RotateCcwIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10"
              aria-label={t("lightbox.rotateRight")}
              onClick={rotateRight}
            >
              <RotateCwIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10"
              aria-label={t("lightbox.reset")}
              onClick={() => {
                setRotation({ src, degrees: 0 });
                pinchRef.current?.resetTransform(200);
              }}
            >
              <RefreshCwIcon className="size-4" />
            </Button>
            {showOpenTab ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10"
                aria-label={t("lightbox.openInNewTab")}
                onClick={() => {
                  window.open(src, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLinkIcon className="size-4" />
              </Button>
            ) : null}
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/10"
                  aria-label={t("lightbox.close")}
                />
              }
            >
              <XIcon className="size-4" />
              <span className="sr-only">{t("lightbox.close")}</span>
            </DialogClose>
          </div>
        </div>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {hasGallery ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!onPrevious}
                className="absolute left-2 top-1/2 z-20 size-11 -translate-y-1/2 rounded-full bg-black/45 text-white shadow-lg hover:border-white/25 hover:bg-white/20 hover:text-white active:-translate-y-1/2 dark:hover:bg-white/20 disabled:opacity-25 sm:left-4"
                aria-label={t("lightbox.previous")}
                onClick={onPrevious}
              >
                <ChevronLeftIcon className="size-6" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!onNext}
                className="absolute right-2 top-1/2 z-20 size-11 -translate-y-1/2 rounded-full bg-black/45 text-white shadow-lg hover:border-white/25 hover:bg-white/20 hover:text-white active:-translate-y-1/2 dark:hover:bg-white/20 disabled:opacity-25 sm:right-4"
                aria-label={t("lightbox.next")}
                onClick={onNext}
              >
                <ChevronRightIcon className="size-6" />
              </Button>
            </>
          ) : null}
          <LightboxImageBody
            pinchRef={pinchRef}
            rotationDeg={rotationDeg}
            src={src}
            alt={alt}
            svg={svg}
            backgroundColor={backgroundColor}
          />
        </div>
        <p className="sr-only">
          {hasGallery ? t("lightbox.galleryHelp") : t("lightbox.help")}
        </p>
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

export function ImageLightboxView({
  open,
  onOpenChange,
  src,
  alt,
  svg,
  backgroundColor,
  currentIndex = 0,
  total = 1,
  onPrevious,
  onNext,
}: ImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {src ? (
        <ImageLightboxDialogContent
          src={src}
          alt={alt}
          svg={svg}
          backgroundColor={backgroundColor}
          currentIndex={currentIndex}
          total={total}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      ) : null}
    </Dialog>
  );
}

export function ImageLightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImageLightboxState | null>(null);

  const open = useCallback((src: string, alt?: string) => {
    const trimmed = src?.trim();
    if (!trimmed) {
      return;
    }
    setState({ items: [{ src: trimmed, alt }], index: 0 });
  }, []);

  const openGallery = useCallback(
    (items: ImageLightboxItem[], initialIndex = 0) => {
      const normalizedItems = items
        .map((item) => ({ ...item, src: item.src?.trim() }))
        .filter((item): item is ImageLightboxItem => Boolean(item.src));
      if (!normalizedItems.length) {
        return;
      }
      const index = Math.min(Math.max(initialIndex, 0), normalizedItems.length - 1);
      setState({ items: normalizedItems, index });
    },
    [],
  );

  const close = useCallback(() => {
    setState(null);
  }, []);

  const contextValue = useMemo(
    () => ({
      open,
      openGallery,
      close,
    }),
    [open, openGallery, close],
  );

  const currentItem = state?.items[state.index] ?? null;

  return (
    <ImageLightboxContext.Provider value={contextValue}>
      {children}
      <ImageLightboxView
        open={state !== null}
        onOpenChange={(next) => {
          if (!next) {
            setState(null);
          }
        }}
        src={currentItem?.src ?? null}
        alt={currentItem?.alt}
        svg={currentItem?.svg}
        backgroundColor={currentItem?.backgroundColor}
        currentIndex={state?.index ?? 0}
        total={state?.items.length ?? 0}
        onPrevious={state && state.index > 0 ? () => {
          setState((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current);
        } : undefined}
        onNext={state && state.index < state.items.length - 1 ? () => {
          setState((current) => current ? { ...current, index: Math.min(current.items.length - 1, current.index + 1) } : current);
        } : undefined}
      />
    </ImageLightboxContext.Provider>
  );
}
