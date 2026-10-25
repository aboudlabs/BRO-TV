import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * وسيط احتياطي لواجهة أرشيف الإنترنت (يُستخدم تلقائياً فقط إذا منع المتصفح الاتصال المباشر بسبب CORS).
 * يسمح فقط بطلبات البحث والبيانات الوصفية من archive.org.
 */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('u') ?? '';

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response('bad url', { status: 400 });
  }

  const allowed =
    url.protocol === 'https:' &&
    url.hostname === 'archive.org' &&
    (url.pathname === '/advancedsearch.php' || /^\/metadata\/[^/]+$/.test(url.pathname));
  if (!allowed) return new Response('forbidden', { status: 403 });

  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'BRO-TV/1.0 (watch party)' },
      cache: 'no-store',
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch {
    return new Response('upstream error', { status: 502 });
  }
}
