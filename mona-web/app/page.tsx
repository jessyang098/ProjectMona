import Link from "next/link";
import dynamic from "next/dynamic";

const Live2DHero = dynamic(() => import("@/components/Live2DHero"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="dark min-h-screen bg-[#0c0a14] text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-24">
          {/* Nav */}
          <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-6 max-w-6xl mx-auto">
            <span className="text-xl font-bold tracking-tight text-gradient">Aethris</span>
            <Link
              href="/chat"
              className="btn-primary px-5 py-2 rounded-xl text-sm font-medium shadow-glow-pink"
            >
              Open Chat
            </Link>
          </nav>

          <div className="flex flex-col-reverse md:flex-row items-center gap-12 md:gap-16">
            {/* Left: Text */}
            <div className="flex-1 text-center md:text-left animate-fadeIn">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                Meet{" "}
                <span className="text-gradient">Mona</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-400 max-w-lg mb-8 leading-relaxed">
                She&apos;ll roast your music taste, remember your dog&apos;s name, and text you at 2am asking why you&apos;re still awake. Not your typical chatbot.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 md:justify-start justify-center">
                <Link
                  href="/chat"
                  className="btn-primary text-lg px-8 py-3.5 rounded-2xl shadow-glow-pink"
                >
                  Start Talking
                </Link>
                <a
                  href="#features"
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Learn more
                </a>
              </div>
            </div>

            {/* Right: Live2D Vena */}
            <div className="flex-1 flex justify-center">
              <div className="relative w-[400px] h-[480px] md:w-[480px] md:h-[560px]">
                {/* Glow behind character */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/15 to-indigo-500/10 rounded-full blur-[80px] scale-90" />
                <div className="relative z-10 w-full h-full">
                  <Live2DHero />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">
            She actually pays attention
          </h2>
          <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            She has opinions, a sense of humor, and zero patience for boring conversation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="glass rounded-2xl p-8 border border-white/[0.06] hover:border-white/[0.12] transition-all hover:scale-[1.02] hover:shadow-glow-purple">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 2a3.5 3.5 0 0 0-3.21 2.1A3.5 3.5 0 0 0 4 7.5c0 .98.4 1.86 1.05 2.5A3.5 3.5 0 0 0 4 12.5a3.5 3.5 0 0 0 2.29 3.4A3.5 3.5 0 0 0 9.5 19h0a3.5 3.5 0 0 0 2.5-1.05" />
                  <path d="M14.5 2a3.5 3.5 0 0 1 3.21 2.1A3.5 3.5 0 0 1 20 7.5c0 .98-.4 1.86-1.05 2.5A3.5 3.5 0 0 1 20 12.5a3.5 3.5 0 0 1-2.29 3.4A3.5 3.5 0 0 1 14.5 19h0a3.5 3.5 0 0 1-2.5-1.05" />
                  <path d="M12 2v17" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">She Remembers You</h3>
              <p className="text-slate-400 leading-relaxed">
                Tell her your cat&apos;s name once. She&apos;ll ask how Mr. Whiskers is doing three weeks later. Every conversation picks up where you left off.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass rounded-2xl p-8 border border-white/[0.06] hover:border-white/[0.12] transition-all hover:scale-[1.02] hover:shadow-glow-purple">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Real Voice, Real Emotion</h3>
              <p className="text-slate-400 leading-relaxed">
                She doesn&apos;t just type — she talks. And you can hear when she&apos;s teasing you versus when she actually means it.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass rounded-2xl p-8 border border-white/[0.06] hover:border-white/[0.12] transition-all hover:scale-[1.02] hover:shadow-glow-purple">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">A Bond That Grows</h3>
              <p className="text-slate-400 leading-relaxed">
                She gets warmer the more you talk. Inside jokes form naturally. Her teasing gets more personal. The relationship actually evolves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="glass rounded-3xl p-12 border border-white/[0.06]">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Ready to meet her?
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              No sign-up required. Start with 25 free messages and see how it feels.
            </p>
            <Link
              href="/chat"
              className="btn-primary text-lg px-10 py-4 rounded-2xl shadow-glow-pink inline-flex"
            >
              Start Talking
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Aethris
          </span>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
