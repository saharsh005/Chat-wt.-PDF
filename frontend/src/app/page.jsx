'use client';
import { UserButton, SignedIn, SignedOut, SignUp, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-8">
      <div className="max-w-4xl mx-auto text-center text-white">
        <h1 className="text-5xl font-bold mb-8">📚 PDF Chat & Quiz</h1>
        <p className="text-xl mb-12 opacity-90">Upload PDFs → Chat with content → Take quizzes → Track learning</p>
        
        <SignedOut>
          <div className="space-y-4">
            <SignInButton mode="modal" redirectUrl="/chat">
              <button className="px-8 py-4 bg-white text-blue-600 rounded-xl text-lg font-semibold shadow-2xl hover:shadow-3xl transition-all">
                🚀 Get Started - Login
              </button>
            </SignInButton>
          </div>
        </SignedOut>
        
        <SignedIn>
          <div className="flex gap-6 justify-center flex-wrap">
            <Link href="/chat">
              <button className="px-8 py-4 bg-white/20 backdrop-blur-xl text-white rounded-xl text-lg font-semibold hover:bg-white/30 transition-all">
                💬 Chat with PDFs
              </button>
            </Link>
            <Link href="/quiz">
              <button className="px-8 py-4 bg-white/20 backdrop-blur-xl text-white rounded-xl text-lg font-semibold hover:bg-white/30 transition-all">
                🧠 Take Quiz
              </button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </div>
    </main>
  );
}
