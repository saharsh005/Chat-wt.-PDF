// This route proxies message fetching from the backend.
// It's kept minimal — the main chat logic lives in the backend.
export async function GET(request, { params }) {
  const { chatId } = params;
  const authHeader = request.headers.get('Authorization');

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/chat/${chatId}/messages`,
    { headers: { Authorization: authHeader } }
  );

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
