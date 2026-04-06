// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "@ai-sdk/react";

vi.mock("next/image", () => ({
  default: (
    props: ImgHTMLAttributes<HTMLImageElement> & {
      onLoadingComplete?: () => void;
      fill?: boolean;
    },
  ) => {
    const { alt, onLoadingComplete, onLoad, fill, ...rest } = props;
    void fill;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- jsdom mock for next/image
      <img
        alt={alt ?? ""}
        {...rest}
        onLoad={(event) => {
          onLoadingComplete?.();
          onLoad?.(event);
        }}
      />
    );
  },
}));

let mockDropzoneState = {
  isDragActive: false,
  open: vi.fn(),
};

vi.mock("react-dropzone", () => ({
  useDropzone: () => ({
    accept: undefined,
    disabled: false,
    isDragActive: mockDropzoneState.isDragActive,
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    open: mockDropzoneState.open,
  }),
}));

const mockSendMessage = vi.fn();
const mockSetMessages = vi.fn();
type UseChatMockOptions = {
  onFinish?: (event: {
    message: UIMessage;
    messages: UIMessage[];
    isAbort: boolean;
    isDisconnect: boolean;
    isError: boolean;
    finishReason: string;
  }) => void | Promise<void>;
  onError?: () => void;
};

let latestUseChatOptions: UseChatMockOptions | undefined;
let mockChatState = {
  sendMessage: mockSendMessage,
  setMessages: mockSetMessages,
  messages: [],
  status: "ready",
  error: undefined,
  clearError: vi.fn(),
  regenerate: vi.fn(),
  stop: vi.fn(),
  resumeStream: vi.fn(),
  addToolResult: vi.fn(),
  addToolOutput: vi.fn(),
  addToolApprovalResponse: vi.fn(),
  id: "ask-test",
};

vi.mock("@ai-sdk/react", () => ({
  useChat: (options: UseChatMockOptions) => {
    latestUseChatOptions = options;
    return mockChatState;
  },
}));

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => "/ask",
  useSearchParams: () => mockSearchParams,
}));

import { suggestionPrompts } from "@/components/ask/ask-chat-helpers";
import { AskWorkspace } from "@/components/ask/ask-workspace";
import { useAskStore } from "@/components/ask/store";

const SAMPLE_PRESET_PROMPT = suggestionPrompts[0];

const mockFetch = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("AskWorkspace", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    latestUseChatOptions = undefined;
    mockSendMessage.mockReset();
    mockSetMessages.mockReset();
    mockChatState = {
      ...mockChatState,
      sendMessage: mockSendMessage,
      setMessages: mockSetMessages,
      messages: [],
      status: "ready",
      error: undefined,
    };
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams();
    mockDropzoneState = {
      isDragActive: false,
      open: vi.fn(),
    };
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/ask/sessions")) {
        return jsonResponse({ sessions: [], nextCursor: null });
      }
      if (url.includes("/api/ask/history")) {
        return jsonResponse({ messages: [], nextCursor: null });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);
    useAskStore.setState({
      draft: "",
      sessionId: null,
      attachment: null,
      messages: [],
      historyCursor: null,
      isLoadingHistory: false,
      isLoadingOlder: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the uploaded chart preview above the assistant result when available", () => {
    useAskStore.setState({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          createdAt: new Date().toISOString(),
          attachmentPreviewUrl: "data:image/png;base64,Zm9v",
          card: {
            type: "chart",
            pattern: "Ascending Triangle",
            bias: "Bullish",
            entry: "4490-4495",
            stop: "4478",
            target: "4525",
            rr: "2.5 : 1",
            confidence: "Medium",
            verdict: "Wait for clean breakout confirmation.",
          },
        },
      ],
    });

    render(<AskWorkspace />);

    expect(screen.getByAltText("Uploaded image context")).toBeInTheDocument();
    expect(screen.getByText("Ascending Triangle")).toBeInTheDocument();
  });

  it("opens a modal when a chat image is clicked", async () => {
    useAskStore.setState({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          createdAt: new Date().toISOString(),
          attachmentPreviewUrl: "data:image/png;base64,Zm9v",
          card: {
            type: "chart",
            pattern: "Ascending Triangle",
            bias: "Bullish",
            entry: "4490-4495",
            stop: "4478",
            target: "4525",
            rr: "2.5 : 1",
            confidence: "Medium",
            verdict: "Wait for clean breakout confirmation.",
          },
        },
      ],
    });

    render(<AskWorkspace />);

    fireEvent.click(screen.getAllByRole("button", { name: "Open Uploaded image context" })[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Image preview" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close image preview" })).toBeInTheDocument();
    });
  });

  it("opens a modal when the composer attachment preview is clicked", async () => {
    useAskStore.setState({
      attachment: {
        file: new File(["foo"], "chart.png", { type: "image/png" }),
        previewUrl: "data:image/png;base64,Zm9v",
      },
    });

    render(<AskWorkspace />);

    fireEvent.click(screen.getAllByRole("button", { name: "Open attached image preview" })[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Image preview" })).toBeInTheDocument();
    });
  });

  it("shows the restoring state immediately when opened with a session from the page", () => {
    render(
      <AskWorkspace initialUrlSessionId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(screen.getAllByText("Restoring session…").length).toBeGreaterThan(0);
  });

  it("shows a full chat-pane drop target while dragging an image", () => {
    mockDropzoneState.isDragActive = true;

    render(<AskWorkspace />);

    expect(screen.getByText("Drop chart image to attach")).toBeInTheDocument();
    expect(screen.getByText("PNG, JPEG, or WebP up to 5MB")).toBeInTheDocument();
  });

  it("shows saved sessions and opens them through the URL", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/ask/sessions")) {
        return jsonResponse({
          sessions: [
            {
              id: sessionId,
              title: "What is Gold doing today?",
              updatedAt: "2026-04-06T00:00:00.000Z",
            },
          ],
          nextCursor: null,
        });
      }
      if (url.includes("/api/ask/history")) {
        return jsonResponse({
          messages: [
            {
              id: "assistant-1",
              role: "assistant",
              content: "{\"type\":\"insight\"}",
              card: {
                type: "insight",
                headline: "Gold Holding Up",
                body: "Price is still above support.",
                verdict: "Watch the next breakout test.",
              },
              uiMeta: null,
              attachmentMeta: null,
              createdAt: "2026-04-06T00:00:00.000Z",
            },
          ],
          nextCursor: null,
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<AskWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("What is Gold doing today?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "What is Gold doing today?" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(`/ask?session=${sessionId}`, {
        scroll: false,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/ask/history?sessionId=${sessionId}`),
      );
    });
  });

  it("keeps the submitted suggestion visible after clicking a preset prompt", async () => {
    mockSendMessage.mockImplementationOnce(async () => {
      await latestUseChatOptions?.onFinish?.({
        message: {
          id: "assistant-1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: JSON.stringify({
                type: "insight",
                headline: "Stay Sharp",
                body: "Review execution before the next setup.",
                verdict: "Cut size until discipline returns.",
              }),
            },
          ],
        },
        messages: [],
        isAbort: false,
        isDisconnect: false,
        isError: false,
        finishReason: "stop",
      });
    });

    render(<AskWorkspace />);

    fireEvent.click(screen.getAllByRole("button", { name: SAMPLE_PRESET_PROMPT })[0]);

    await waitFor(() => {
      expect(screen.getAllByText(SAMPLE_PRESET_PROMPT).length).toBeGreaterThan(0);
      expect(screen.getAllByText("Stay Sharp").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("Cut size until discipline returns.").length).toBeGreaterThan(0);
  });

  it("shows an in-thread loading card while the response is pending", async () => {
    useAskStore.setState({
      messages: [
        {
          id: "user-1",
          role: "user",
          content: SAMPLE_PRESET_PROMPT,
          createdAt: new Date().toISOString(),
          attachmentName: null,
        },
      ],
    });
    mockChatState = {
      ...mockChatState,
      status: "submitted",
    };

    render(<AskWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Analyzing…").length).toBeGreaterThan(0);
    });
  });

  it("shows an error when the assistant response cannot be parsed into a card", async () => {
    mockSendMessage.mockImplementationOnce(async () => {
      await latestUseChatOptions?.onFinish?.({
        message: {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "not-json" }],
        },
        messages: [],
        isAbort: false,
        isDisconnect: false,
        isError: false,
        finishReason: "stop",
      });
    });

    render(<AskWorkspace />);

    fireEvent.click(screen.getAllByRole("button", { name: SAMPLE_PRESET_PROMPT })[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText("The response could not be displayed. Please try again.").length,
      ).toBeGreaterThan(0);
    });
  });

  it("shows an error when the chat request fails", async () => {
    mockSendMessage.mockImplementationOnce(async () => {
      latestUseChatOptions?.onError?.();
      throw new Error("send failed");
    });

    render(<AskWorkspace />);

    fireEvent.click(screen.getAllByRole("button", { name: SAMPLE_PRESET_PROMPT })[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText("Could not send that message. Please try again.").length,
      ).toBeGreaterThan(0);
    });
  });

  it("loads more sessions automatically when the sidebar reaches the bottom", async () => {
    const firstSessionId = "11111111-1111-4111-8111-111111111111";
    const secondSessionId = "22222222-2222-4222-8222-222222222222";

    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/ask/sessions?limit=40&cursor=cursor-1")) {
        return jsonResponse({
          sessions: [
            {
              id: secondSessionId,
              title: "Second session",
              updatedAt: "2026-04-05T00:00:00.000Z",
            },
          ],
          nextCursor: null,
        });
      }
      if (url.includes("/api/ask/sessions?limit=40")) {
        return jsonResponse({
          sessions: [
            {
              id: firstSessionId,
              title: "First session",
              updatedAt: "2026-04-06T00:00:00.000Z",
            },
          ],
          nextCursor: "cursor-1",
        });
      }
      if (url.includes("/api/ask/history")) {
        return jsonResponse({ messages: [], nextCursor: null });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    const { container } = render(<AskWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("First session")).toBeInTheDocument();
    });

    const scrollViewport = container.querySelector(".ask-scrollbar");
    if (!(scrollViewport instanceof HTMLDivElement)) {
      throw new Error("Expected the sidebar scroll viewport.");
    }

    Object.defineProperty(scrollViewport, "scrollHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollViewport, "clientHeight", {
      configurable: true,
      value: 160,
    });
    Object.defineProperty(scrollViewport, "scrollTop", {
      configurable: true,
      value: 24,
      writable: true,
    });

    fireEvent.scroll(scrollViewport);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/ask/sessions?limit=40&cursor=cursor-1");
      expect(screen.getByText("Second session")).toBeInTheDocument();
    });
  });

  it("does not force scroll to bottom when an attachment image loads while reading older content", async () => {
    useAskStore.setState({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          createdAt: new Date().toISOString(),
          attachmentPreviewUrl: "data:image/png;base64,Zm9v",
          card: {
            type: "chart",
            pattern: "Ascending Triangle",
            bias: "Bullish",
            entry: "4490-4495",
            stop: "4478",
            target: "4525",
            rr: "2.5 : 1",
            confidence: "Medium",
            verdict: "Wait for clean breakout confirmation.",
          },
        },
      ],
    });

    const { container } = render(<AskWorkspace />);

    const viewport = container.querySelector('[data-testid="ask-thread-viewport"]');
    if (!(viewport instanceof HTMLElement)) {
      throw new Error("Expected ask thread viewport.");
    }

    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 400 });
    viewport.scrollTop = 0;

    const scrollToFn = vi.fn();
    viewport.scrollTo = scrollToFn as typeof viewport.scrollTo;

    const img = within(viewport).getByAltText("Uploaded image context");
    fireEvent.load(img);

    await waitFor(() => {
      expect(scrollToFn).not.toHaveBeenCalled();
    });
  });

  it("nudges scroll to bottom when pinned and an attachment image finishes loading", async () => {
    useAskStore.setState({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          createdAt: new Date().toISOString(),
          attachmentPreviewUrl: "data:image/png;base64,Zm9v",
          card: {
            type: "chart",
            pattern: "Ascending Triangle",
            bias: "Bullish",
            entry: "4490-4495",
            stop: "4478",
            target: "4525",
            rr: "2.5 : 1",
            confidence: "Medium",
            verdict: "Wait for clean breakout confirmation.",
          },
        },
      ],
    });

    const { container } = render(<AskWorkspace />);

    const viewport = container.querySelector('[data-testid="ask-thread-viewport"]');
    if (!(viewport instanceof HTMLElement)) {
      throw new Error("Expected ask thread viewport.");
    }

    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 400 });
    viewport.scrollTop = 505;

    const scrollToFn = vi.fn();
    viewport.scrollTo = scrollToFn as typeof viewport.scrollTo;

    const img = within(viewport).getByAltText("Uploaded image context");
    fireEvent.load(img);

    await waitFor(() => {
      expect(scrollToFn).toHaveBeenCalledWith({
        top: 1000,
        behavior: "auto",
      });
    });
  });
});
