/** Recharts `ResponsiveContainer` measures the container; fire a fake resize so charts render in jsdom. */
globalThis.ResizeObserver = class ResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    queueMicrotask(() => {
      this.callback(
        [
          {
            target,
            contentRect: {
              x: 0,
              y: 0,
              width: 320,
              height: 180,
              top: 0,
              left: 0,
              bottom: 180,
              right: 320,
              toJSON: () => "",
            },
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          } as unknown as ResizeObserverEntry,
        ],
        this,
      );
    });
  }

  unobserve(): void {}

  disconnect(): void {}
};

/** jsdom often reports 0×0 for chart containers; Recharts needs non-zero layout. */
if (typeof Element !== "undefined") {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element) {
    return {
      width: 320,
      height: 180,
      top: 0,
      left: 0,
      bottom: 180,
      right: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}
