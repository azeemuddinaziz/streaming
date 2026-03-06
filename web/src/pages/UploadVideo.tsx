import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Loader2, Upload, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useNavigate } from "react-router-dom";
import { uploadVideo } from "@/services/video.services";
import { toast } from "sonner";

export default function UploadVideo() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState([]);
  const [isUploaded, setIsUploaded] = useState(false);
  const [isLoading, SetIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    //@ts-ignore
    setFormData({ ...formData, video: event.target.files[0] });

    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setVideoFile(file);
      const objectUrl = URL.createObjectURL(file);
      setVideoPreview(objectUrl);
    }
  };

  const handleThumbnailUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    //@ts-ignore
    setFormData({ ...formData, thumbnail: event.target.files[0] });

    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setThumbnailFile(file);
      const objectUrl = URL.createObjectURL(file);
      setThumbnailPreview(objectUrl);
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      setIsUploaded(false);
      SetIsLoading(true);

      e.preventDefault();
      // @ts-ignore
      const { title, description, video, thumbnail } = formData;

      const data = await uploadVideo(title, description, video, thumbnail);
      if (!data) throw "Server did not respond.";

      setIsUploaded(true);
      SetIsLoading(false);
    } catch (error) {
      setIsUploaded(false);
      SetIsLoading(false);
      //@ts-ignore
      toast("Error: ", error);
    }
  };

  if (isUploaded) {
    const redirectToHome = () => {
      setTimeout(() => {
        navigate("/");
      }, 5000);
    };
    redirectToHome();

    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Successfully!</CardTitle>
            <CardDescription>
              You will now be redirected to home page.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/" className="w-full">
              <Button className="flex items-center gap-2 w-full">
                <span>Click Here</span>
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <ScrollArea>
      <div className="container mx-auto py-10">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Upload Video</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter video title"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    // @ts-ignore
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter video description"
                  className="min-h-[100px]"
                  onChange={(e) =>
                    // @ts-ignore
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{videoFile ? "Video Preview" : "Video File"}</Label>
                {!videoFile ? (
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="video"
                      className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span>{" "}
                          or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">
                          MP4, WebM or OGG (MAX. 800MB)
                        </p>
                      </div>
                      <Input
                        id="video"
                        type="file"
                        className="hidden"
                        onChange={handleVideoUpload}
                        accept="video/*"
                        required
                      />
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <video
                      src={videoPreview!}
                      controls
                      className="w-full rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={removeVideo}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  {thumbnailFile ? "Thumbnail Preview" : "Thumbnail"}
                </Label>
                {!thumbnailFile ? (
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="thumbnail"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-gray-500" />
                        <p className="text-xs text-gray-500">
                          PNG, JPG or GIF (MAX. 2MB)
                        </p>
                      </div>
                      <Input
                        id="thumbnail"
                        type="file"
                        className="hidden"
                        onChange={handleThumbnailUpload}
                        accept="image/*"
                        required
                      />
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={thumbnailPreview!}
                      alt="Thumbnail preview"
                      className="w-full rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={removeThumbnail}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link to={"/"}>
              <Button variant="outline">Cancel</Button>
            </Link>
            {!isLoading && (
              <Button onClick={handleSubmit}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </Button>
            )}

            {isLoading && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </Button>
            )}
          </CardFooter>
        </Card>
        <div className="mt-6 text-center text-sm text-gray-500 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span>Make sure you have the rights to upload this content</span>
        </div>
      </div>
    </ScrollArea>
  );
}
