import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "godown-photos";

export async function getSignedGodownUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export function GodownPhotoThumb({ path, className }: { path: string | null | undefined; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(null); return; }
    getSignedGodownUrl(path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);
  if (!path) return null;
  if (!url) return <div className={className ?? "h-24 w-24 rounded bg-muted animate-pulse"} />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Godown storage" className={className ?? "h-24 w-24 rounded object-cover border"} />
    </a>
  );
}

type Props = {
  value: string | null;
  onChange: (path: string | null) => void;
  label?: string;
  /** subfolder inside the bucket */
  folder?: string;
};

export function GodownPhotoInput({ value, onChange, label = "Godown Photo (optional)", folder = "intake" }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) { setPreviewUrl(null); return; }
    getSignedGodownUrl(value).then((u) => { if (active) setPreviewUrl(u); });
    return () => { active = false; };
  }, [value]);

  async function handleFile(f: File | undefined | null) {
    if (!f) return;
    setUploading(true);
    try {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
        contentType: f.type || "image/jpeg",
        upsert: false,
      });
      if (error) throw error;
      onChange(path);
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={uploadRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => cameraRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
          Take Photo
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => uploadRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> Upload
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="h-4 w-4 mr-1" /> Remove
          </Button>
        )}
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="ml-auto">
            <img src={previewUrl} alt="Preview" className="h-16 w-16 rounded object-cover border" />
          </a>
        )}
      </div>
    </div>
  );
}
