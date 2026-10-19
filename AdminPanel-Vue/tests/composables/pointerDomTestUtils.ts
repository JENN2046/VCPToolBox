import { vi } from "vitest";

// Only the DOM surface exercised by the existing pointer-drag tests.
class MockHTMLElement {
  dataset: Record<string, string>;
  style: Record<string, string> = {};
  private closestElements = new Map<string, MockHTMLElement | null>();
  private queryResults = new Map<string, MockHTMLElement[]>();
  private capturedPointers = new Set<number>();
  private rect: DOMRect;

  constructor(options: {
    dataset?: Record<string, string>;
    rect?: Partial<DOMRect>;
  } = {}) {
    this.dataset = options.dataset ?? {};
    const { top = 0, left = 0, width = 100, height = 10 } = options.rect ?? {};
    this.rect = { top, left, width, height, bottom: top + height,
      right: left + width, x: left, y: top, toJSON: () => ({}) };
  }

  setClosest(selector: string, element: MockHTMLElement | null) {
    this.closestElements.set(selector, element);
    return this;
  }

  closest(selector: string) { return this.closestElements.get(selector) ?? null; }
  setQuerySelectorAll(selector: string, elements: MockHTMLElement[]) {
    this.queryResults.set(selector, elements);
    return this;
  }
  querySelectorAll(selector: string) { return this.queryResults.get(selector) ?? []; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id: number) { this.capturedPointers.add(id); }
  hasPointerCapture(id: number) { return this.capturedPointers.has(id); }
  releasePointerCapture(id: number) { this.capturedPointers.delete(id); }
}

export function createMockHTMLElement(options?: ConstructorParameters<typeof MockHTMLElement>[0]) {
  return new MockHTMLElement(options);
}

export function installPointerDomTestGlobals(elementFromPoint: (x: number, y: number) => unknown) {
  const windowMock = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const documentMock = { elementFromPoint, visibilityState: "visible",
    addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("HTMLElement", MockHTMLElement);
  vi.stubGlobal("Element", MockHTMLElement);
  vi.stubGlobal("window", windowMock);
  vi.stubGlobal("document", documentMock);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return { windowMock, documentMock };
}
