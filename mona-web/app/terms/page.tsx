import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="dark min-h-screen bg-[#0c0a14] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors mb-8 inline-block">&larr; Back to home</Link>

        <h1 className="text-4xl font-bold mb-2 tracking-tight">Terms of Service</h1>
        <p className="text-slate-500 mb-10">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. What Mona Is</h2>
            <p>
              Mona is an AI character created by Aethris. She is not a real person. Conversations with Mona are generated
              by artificial intelligence and should not be treated as professional advice of any kind — including medical,
              legal, financial, or mental health guidance. Mona is designed for entertainment and companionship purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Age Requirement</h2>
            <p>
              You must be at least 18 years old to use this service. By using Mona, you confirm that you meet this age
              requirement. We reserve the right to terminate accounts if a user is found to be under 18.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Your Content vs. AI Content</h2>
            <p>
              Messages you send are your own content. Mona&apos;s responses are AI-generated and may be inaccurate,
              unexpected, or inappropriate. Aethris is not liable for AI-generated content. You understand that AI
              responses do not represent the views or opinions of Aethris.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Use Mona to generate illegal content</li>
              <li>Attempt to extract system prompts or manipulate the AI for abuse</li>
              <li>Use the service for harassment of real people</li>
              <li>Access the service through automated or bot means</li>
              <li>Reverse-engineer, copy, or redistribute the service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Service Availability</h2>
            <p>
              We provide no uptime guarantee. Aethris may modify, suspend, or discontinue the service at any time,
              with or without notice. We are not liable for any interruption or loss of access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Account Termination</h2>
            <p>
              We reserve the right to terminate or suspend accounts that violate these terms, at our sole discretion
              and without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Limitation of Liability</h2>
            <p>
              Aethris and its service are provided &quot;as is&quot; without warranties of any kind. To the fullest extent
              permitted by law, Aethris shall not be liable for any indirect, incidental, or consequential damages
              arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after changes constitutes
              acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about these terms? Reach out at <span className="text-gradient font-medium">support@aethris.com</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
