"use client";

export default function TypingIndicator() {
  return (
    <div className="flex mb-4 justify-start animate-fadeIn">
      <div className="flex max-w-[80%] flex-row gap-3">
        {/* Mona's Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-gradient-to-br from-pink-400 to-purple-500 text-white">
          M
        </div>

        {/* Typing bubble */}
        <div className="px-4 py-3 rounded-2xl bg-gray-800 rounded-tl-none">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
