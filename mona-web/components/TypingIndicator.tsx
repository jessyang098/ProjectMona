"use client";

export default function TypingIndicator() {
  return (
    <div className="flex mb-3 justify-start animate-fadeIn">
      <div className="flex max-w-[85%] flex-row gap-2.5">
        {/* Mona's Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-semibold bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-sm">
          M
        </div>

        {/* Typing bubble */}
        <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-white/90 border border-slate-100/80 shadow-sm">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
