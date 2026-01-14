'use client';
import { useUser } from '@clerk/nextjs';
import { useState } from 'react';
import { useEffect } from 'react';

export default function QuizPage() {
  const { user } = useUser();
  const [pdfId, setPdfId] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(0);

  const startQuiz = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/quiz/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getToken()}`
      },
      body: JSON.stringify({ pdfId, numQuestions: 5, difficulty: 'medium' })
    });
    const data = await res.json();
    setQuiz(data);
    setAnswers(new Array(data.totalQuestions).fill(null));
  };

  const submitAnswer = async (qIndex, answer) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/quiz/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
      body: JSON.stringify({ sessionId: quiz.sessionId, questionIndex: qIndex, answer })
    });
    const result = await res.json();
    
    const newAnswers = [...answers];
    newAnswers[qIndex] = result;
    setAnswers(newAnswers);
    setScore(result.score);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">🧠 PDF Quiz</h1>
      
      {!quiz ? (
        <div className="p-12 border-2 border-dashed border-gray-300 rounded-2xl text-center">
          <input
            placeholder="Enter PDF ID"
            className="w-full max-w-md p-4 border border-gray-300 rounded-xl mb-4 text-center"
            onChange={(e) => setPdfId(e.target.value)}
          />
          <button onClick={startQuiz} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold">
            Start Quiz
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Quiz ({score}/{quiz.totalQuestions})</h2>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-600 text-white rounded-lg">
              New Quiz
            </button>
          </div>

          <div className="grid gap-6">
            {quiz.questions.map((q, index) => (
              <div key={q.id} className="p-6 border rounded-2xl hover:shadow-lg transition-all">
                <h3 className="font-semibold text-lg mb-4">Q{q.id}: {q.question}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(q.options).map(([letter, option]) => (
                    <button
                      key={letter}
                      onClick={() => submitAnswer(index, letter)}
                      disabled={answers[index]}
                      className={`p-4 border-2 rounded-xl text-left transition-all ${
                        answers[index]?.answered === letter
                          ? answers[index].correct === letter ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      } ${answers[index] ? 'cursor-not-allowed' : ''}`}
                    >
                      <span className="font-semibold">{letter}</span> {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
