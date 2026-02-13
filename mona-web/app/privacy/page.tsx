import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="dark min-h-screen bg-[#0c0a14] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors mb-8 inline-block">&larr; Back to home</Link>

        <h1 className="text-4xl font-bold mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-slate-500 mb-10">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. What We Collect</h2>
            <p>When you use Mona, we collect:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Account info</strong> — email and name via Google or Discord OAuth</li>
              <li><strong className="text-white">Conversations</strong> — messages you send and Mona&apos;s responses</li>
              <li><strong className="text-white">Memories</strong> — facts, preferences, and events extracted from your conversations to personalize Mona</li>
              <li><strong className="text-white">Relationship data</strong> — affection level and relationship state</li>
              <li><strong className="text-white">Voice data</strong> — if you use voice chat, audio is processed for speech-to-text and discarded after transcription</li>
              <li><strong className="text-white">Usage data</strong> — analytics events, IP address, browser info</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Data</h2>
            <p>Your data is used to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Generate AI responses tailored to your conversation history</li>
              <li>Extract and store memories so Mona can remember you across sessions</li>
              <li>Track relationship progression (affection level)</li>
              <li>Improve the service and fix bugs</li>
            </ul>
            <p className="mt-3">
              Your conversations are <strong className="text-white">not</strong> used to train AI models.
              We use the OpenAI API for response generation, and per OpenAI&apos;s API data usage policy,
              API data is not used for model training.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Third Parties</h2>
            <p>Your data may be processed by these third-party services:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">OpenAI</strong> — processes your messages to generate Mona&apos;s responses</li>
              <li><strong className="text-white">Google / Discord</strong> — authentication only</li>
              <li><strong className="text-white">Fish Audio / SoVITS</strong> — text-to-speech voice generation</li>
              <li><strong className="text-white">Vercel / Railway</strong> — hosting infrastructure</li>
            </ul>
            <p className="mt-3">
              We do not sell your data to anyone. We do not share your conversations with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Voice Data</h2>
            <p>
              When you use voice chat, your audio is sent to our server for transcription using OpenAI Whisper.
              Audio recordings are <strong className="text-white">not stored</strong> — they are processed in real-time
              and discarded after transcription. Only the text transcript is retained as part of your conversation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Controls</h2>
            <p>You can:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>View and delete individual memories Mona has stored about you (in your profile)</li>
              <li>Clear your conversation history</li>
              <li>Request full account deletion by contacting us</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your account,
              we will delete your conversations, memories, and relationship data within 30 days.
              Some anonymized, aggregated data may be retained for analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Children</h2>
            <p>
              This service is not intended for users under 18 years of age. We do not knowingly collect
              data from minors. If we become aware that a user is under 18, we will terminate the account
              and delete all associated data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Security</h2>
            <p>
              We take reasonable measures to protect your data, including encrypted connections and secure
              authentication. However, no system is perfectly secure, and we cannot guarantee absolute
              security of your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes</h2>
            <p>
              We may update this policy from time to time. We&apos;ll notify you of significant changes
              through the service. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>
              Privacy questions? Reach out at <span className="text-gradient font-medium">privacy@aethris.com</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
