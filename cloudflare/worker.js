/**
 * Cloudflare Worker (مجاني): بيستقبل رسايل وضغطات تيليجرام لحظيًا، ويوصّلها لـ Apps Script (doPost في Web.gs).
 * بيرد على تيليجرام فورًا، والشغل نفسه بيكمل في الخلفية.
 * المتغيرات (Settings ← Variables and Secrets، كـ Secret):
 *   APPS_SCRIPT_URL = رابط الـ Web App + ?key=... (بيطلع لك من "تفعيل Webhook" في قايمة الشيت)
 *   TG_SECRET       = الكلمة السرية (بتطلع لك من نفس الخطوة)
 */
export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return new Response('ok');
    // نتأكد إن الطلب جاي من تيليجرام فعلًا
    if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TG_SECRET) {
      return new Response('forbidden', { status: 403 });
    }
    const body = await request.text();
    ctx.waitUntil(
      fetch(env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        redirect: 'follow',
      }).catch(() => {})
    );
    return new Response('ok');
  },
};
