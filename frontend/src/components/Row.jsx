import React, { useRef } from "react";

export default function Row({ title, children, testid }) {
  const scrollerRef = useRef(null);

  const onKeyDown = (e) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.key === "ArrowRight") {
      el.scrollBy({ left: el.clientWidth * 0.7, behavior: "smooth" });
    } else if (e.key === "ArrowLeft") {
      el.scrollBy({ left: -el.clientWidth * 0.7, behavior: "smooth" });
    }
  };

  return (
    <section className="space-y-4" data-testid={testid}>
      {title && (
        <h3 className="font-display text-3xl md:text-4xl font-bold tracking-tighter px-2">
          {title}
        </h3>
      )}
      <div
        ref={scrollerRef}
        onKeyDown={onKeyDown}
        className="flex gap-5 overflow-x-auto scroll-tv row-scroll pb-4 px-2"
      >
        {React.Children.map(children, (c, i) => (
          <div key={i} className="shrink-0 w-44 md:w-52 lg:w-56">
            {c}
          </div>
        ))}
      </div>
    </section>
  );
}
