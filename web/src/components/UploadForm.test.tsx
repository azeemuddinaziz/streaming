// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Options = {
  onProgress: (sent: number, total: number) => void;
  onSuccess: () => void;
  onError: (error: unknown) => void;
};

const { created, FakeUpload } = vi.hoisted(() => {
  const created: FakeUpload[] = [];
  class FakeUpload {
    options: Options;
    start = vi.fn();
    abort = vi.fn(() => Promise.resolve());
    findPreviousUploads = vi.fn(() => Promise.resolve([]));
    resumeFromPreviousUpload = vi.fn();
    constructor(
      public file: File,
      options: Options,
    ) {
      this.options = options;
      created.push(this);
    }
  }
  return { created, FakeUpload };
});

vi.mock("tus-js-client", () => ({ Upload: FakeUpload }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

import { UploadForm } from "./UploadForm";

beforeEach(() => {
  created.length = 0;
});

const video = () => new File(["x".repeat(2000)], "holiday.mp4", { type: "video/mp4" });

async function startUpload(user: ReturnType<typeof userEvent.setup>, file: File = video()) {
  await user.upload(screen.getByLabelText("Video file"), file);
  await user.click(screen.getByRole("button", { name: "Start upload" }));
  return created[0]!;
}

describe("UploadForm", () => {
  it("explains a file that is not a video before any upload begins", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<UploadForm />);
    await user.upload(screen.getByLabelText("Video file"), new File(["hi"], "notes.pdf", { type: "application/pdf" }));

    expect(screen.getByRole("alert")).toHaveTextContent("not a video");
    expect(created).toHaveLength(0);
  });

  it("shows progress as a progressbar, pauses and resumes", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);
    const upload = await startUpload(user);
    expect(upload.start).toHaveBeenCalledTimes(1);

    act(() => upload.options.onProgress(1000, 2000));
    expect(screen.getByRole("progressbar", { name: "Upload progress" })).toHaveAttribute("aria-valuenow", "50");

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(upload.abort).toHaveBeenCalledWith();
    expect(screen.getByText("Paused")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(upload.start).toHaveBeenCalledTimes(2);
  });

  it("asks before cancelling, then terminates the upload", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);
    const upload = await startUpload(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel upload" }));

    expect(upload.abort).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Choose a video" })).toBeInTheDocument();
  });

  it("links to the Studio when it finishes", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);
    const upload = await startUpload(user);
    act(() => upload.options.onSuccess());

    // Once visible, once in the screen-reader live region.
    expect(screen.getAllByText(/Processing started, you can leave this page/)).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Go to Studio" })).toHaveAttribute("href", "/studio");
  });

  it("shows a failure inline with Retry, which starts a new attempt", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);
    const upload = await startUpload(user);
    act(() => upload.options.onError(new Error("network")));

    expect(screen.getByRole("alert")).toHaveTextContent("connection dropped");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(created).toHaveLength(2);
    expect(created[1]!.start).toHaveBeenCalled();
  });

  it("offers sign in when the server says signed out", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);
    const upload = await startUpload(user);
    act(() => upload.options.onError({ originalResponse: { getStatus: () => 401 } }));

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Fupload");
  });
});
