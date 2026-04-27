import React, { useState } from "react";
import { Star } from "lucide-react";
import { playableUrl } from "../lib/api";

export default function PosterCard({ title, image, meta, onActivate, testid, aspect = "2/3" }) {
  const [err, setErr] = useState(false);
  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate && onActivate();
    }
  };
  return (
    <button
      type="button"
      onClick={onActivate}
      onKeyDown={handleKey}
      data-testid={testid}
      className="poster-focus group relative rounded-xl overflow-hidden bg-neutral-900 w-full text-left outline-none transition-transform duration-200 border-0"
      style={{ aspectRatio: aspect.replace("/", " / ") }}
    >
      {image && !err ? (
        <img
          src={playableUrl(image)}
          alt={title}
          onError={() => setErr(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black p-4">
          <span className="font-display text-xl text-neutral-400 text-center line-clamp-4">
            {title}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3">
        <div className="font-display font-bold text-white text-base md:text-lg line-clamp-2 leading-tight">
          {title}
        </div>
        {meta && <div className="text-xs text-neutral-400 mt-1 line-clamp-1">{meta}</div>}
      </div>
    </button>
  );
}

export function LiveCard({ title, image, onActivate, testid }) {
  const [err, setErr] = useState(false);
  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate && onActivate();
    }
  };
  return (
    <button
      type="button"
      onClick={onActivate}
      onKeyDown={handleKey}
      data-testid={testid}
      className="poster-focus group relative rounded-xl overflow-hidden bg-neutral-900 w-full text-left outline-none aspect-video flex flex-col items-center justify-center p-4 border-0"
    >
      {image && !err ? (
        <img
          src={playableUrl(image)}
          alt={title}
          onError={() => setErr(true)}
          className="max-h-[60%] max-w-[70%] object-contain"
        />
      ) : (
        <Star className="w-10 h-10 text-[#FFB800]" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-3 py-2">
        <div className="font-display font-semibold text-sm md:text-base line-clamp-1">
          {title}
        </div>
      </div>
    </button>
  );
}
