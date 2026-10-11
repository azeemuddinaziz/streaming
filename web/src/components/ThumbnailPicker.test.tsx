// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThumbnailPicker } from "./ThumbnailPicker";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({
  getApiBaseUrl: () => "http://api.test",
  replaceThumbnail: vi.fn(),
}));

import { toast } from "sonner";
import { replaceThumbnail } from "@/lib/api-client";

const image = () => new File(["x"], "cover.png", { type: "image/png" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ThumbnailPicker", () => {
  it("shows the new image after a replacement, with a toast", async () => {
    vi.mocked(replaceThumbnail).mockResolvedValue({ ok: true, thumbnailPath: "/api/v1/media/t/new.jpg" });
    render(<ThumbnailPicker videoId="v1" label="Holiday" thumbnailPath="/api/v1/media/t/old.jpg" />);
    expect(screen.getByRole("img").getAttribute("src")).toBe("http://api.test/api/v1/media/t/old.jpg");

    await userEvent.upload(screen.getByLabelText("Thumbnail image file"), image());

    await waitFor(() =>
      expect(screen.getByRole("img").getAttribute("src")).toBe("http://api.test/api/v1/media/t/new.jpg"),
    );
    expect(toast.success).toHaveBeenCalledWith("Thumbnail updated");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the old image and shows the refusal inline", async () => {
    vi.mocked(replaceThumbnail).mockResolvedValue({ ok: false, message: "That image is over 5 MB." });
    render(<ThumbnailPicker videoId="v1" label="Holiday" thumbnailPath="/api/v1/media/t/old.jpg" />);

    await userEvent.upload(screen.getByLabelText("Thumbnail image file"), image());

    expect((await screen.findByRole("alert")).textContent).toBe("That image is over 5 MB.");
    expect(screen.getByRole("img").getAttribute("src")).toBe("http://api.test/api/v1/media/t/old.jpg");
  });
});
