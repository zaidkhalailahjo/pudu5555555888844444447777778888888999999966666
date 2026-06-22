const CACHE_NAME = 'quill-system-cache-v5'; // تم رفع الإصدار لتحديث الكاش
const OFFLINE_URL = 'offline.html'; // يجب أن يكون الملف في نفس مسار sw.js و index.html

// 1. عند التثبيت: حفظ صفحة الأوفلاين في الذاكرة فوراً وإجبار المتصفح على جلب أحدث نسخة
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // استخدام { cache: 'reload' } يضمن عدم جلب نسخة معطوبة من كاش المتصفح القديم
            return cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        })
    );
    self.skipWaiting(); // تفعيل النسخة الجديدة فوراً
});

// 2. تنظيف نسخ الكاش القديمة
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    event.waitUntil(clients.claim()); // جعل الـ SW يسيطر على كل الصفحات فوراً
});

// 3. اعتراض الطلبات وتوجيهها
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // أ. استثناء طلبات السيرفر وقواعد البيانات لمنع التداخل
    if (event.request.method !== 'GET' || 
        url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebaseio.com') || 
        url.hostname.includes('cloudfunctions.net') || 
        url.hostname.includes('run.app') || 
        url.hostname.includes('script.google.com')) {
        return; 
    }

    // ب. معالجة طلبات فتح أو تحديث الصفحة (هنا نظهر صفحة الأوفلاين)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // إذا فشل الاتصال، نبحث عن صفحة الأوفلاين في الكاش
                return caches.match(OFFLINE_URL).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // شبكة أمان أخيرة: لو تم مسح الكاش لسبب ما، نرجع صفحة نصية بسيطة بدلاً من الديناصور!
                    return new Response(
                        '<html dir="rtl"><body style="text-align:center; padding:50px; font-family:sans-serif; color:#002d74;"><h2>عذراً، انقطع الاتصال بالإنترنت</h2><p>يرجى التحقق من الشبكة وإعادة تحديث الصفحة.</p></body></html>',
                        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                    );
                });
            })
        );
        return; // إنهاء المعالجة لطلبات الـ navigate
    }

    // ج. معالجة باقي الملفات (صور، CSS، خطوط...)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).catch(() => {
                // إرجاع استجابة فارغة بدلاً من خطأ صريح لمنع انهيار الواجهة
                return new Response('', { status: 408, statusText: 'Offline' });
            });
        })
    );
});
