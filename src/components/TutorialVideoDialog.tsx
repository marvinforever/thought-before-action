import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, ExternalLink } from "lucide-react";

interface TutorialVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  videoUrl?: string;
}

export function TutorialVideoDialog({
  open,
  onOpenChange,
  title,
  description,
  videoUrl,
}: TutorialVideoDialogProps) {
  // Check if it's a YouTube URL and extract embed URL
  const getEmbedUrl = (url: string) => {
    // Handle YouTube URLs
    const youtubeMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
    );
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&rel=0`;
    }
    // Handle Vimeo URLs
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
    // Return as-is for direct video URLs
    return url;
  };

  const isEmbedUrl = videoUrl && (
    videoUrl.includes("youtube") || 
    videoUrl.includes("youtu.be") || 
    videoUrl.includes("vimeo")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {videoUrl ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              {isEmbedUrl ? (
                <iframe
                  src={getEmbedUrl(videoUrl)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={title}
                />
              ) : (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted flex flex-col items-center justify-center text-muted-foreground">
              <Play className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">Tutorial video coming soon!</p>
              <p className="text-xs mt-1">We're creating a walkthrough for this feature.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          {videoUrl && isEmbedUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(videoUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Got it!</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
