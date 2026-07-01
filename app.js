// app.js
require('./tracer.js'); // OTel her zaman en üstte!

const express = require('express');
const opentelemetry = require('@opentelemetry/api');

const winston = require('winston');
const LokiTransport = require('winston-loki');

// Grafana Loki için Logger (Loglayıcı) oluşturuyoruz
const logger = winston.createLogger({
  transports: [
   new LokiTransport({
  // localhost yerine bunu yazıyoruz:
  host: 'http://127.0.0.1:3100', 
  labels: { app: 'magaza-backend-servisi' }, 
  json: true
}),
    new winston.transports.Console({ // Logları aynı zamanda terminalde de görmek için
      format: winston.format.simple()
    })
  ]
});

// Artık kod içinde console.log yerine logger.info() veya logger.error() kullanacağız!

const app = express();
app.use(express.json());

const tracer = opentelemetry.trace.getTracer('eticaret-tracer');

// --- METRİK TANIMLAMALARI ---
const meter = opentelemetry.metrics.getMeter('eticaret-metrikler');
const basariliSiparisSayaci = meter.createCounter('magaza_basarili_siparis_toplam', {
  description: 'Toplam başarılı tamamlanan sipariş sayısı'
});
const hataSayaci = meter.createCounter('magaza_hata_toplam', {
  description: 'Sistemde oluşan toplam bakiye/limit hatası sayısı'
});

const bekle = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const URUNLER = [
  { id: 1, isim: "Kablosuz Kulaklık", fiyat: 1200, gorsel: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60" },
  { id: 2, isim: "Oyuncu Mouse", fiyat: 600, gorsel: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500&auto=format&fit=crop&q=60" },
  { id: 3, isim: "Mekanik Klavye", fiyat: 1800, gorsel: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60" },
  { id: 4, isim: "Akıllı Saat v2", fiyat: 2500, gorsel: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&auto=format&fit=crop&q=60" },
  { id: 5, isim: "UltraWide Monitör", fiyat: 5400, gorsel: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=60" },
  { id: 6, isim: "RGB Kulaklık Standı", fiyat: 350, gorsel: "https://images.unsplash.com/photo-1608156639585-b3a032ef9689?w=500&auto=format&fit=crop&q=60" },
  { id: 7, isim: "Ergonomik Dikey Mouse", fiyat: 950, gorsel: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60" },
  { id: 8, isim: "Keçe Masa Matı (Pad)", fiyat: 400, gorsel: "https://images.unsplash.com/photo-1632292224971-0d45778bd364?w=500&auto=format&fit=crop&q=60" }
];

let SEPET = [];

// -------------------------------------------------------------------------
// TERTEMİZ ARAYÜZ (Takip Paneli Tamamen Kaldırıldı)
// -------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TechStore - E-Ticaret Mağazası</title>
        <style>
            :root {
                --primary: #4f46e5; --primary-hover: #4338ca;
                --success: #10b981; --success-hover: #059669;
                --danger: #ef4444; --danger-hover: #dc2626;
                --background: #f1f5f9; --text-main: #0f172a;
            }
            body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--background); margin: 0; padding: 40px; display: flex; gap: 30px; justify-content: center; }
            .container { max-width: 800px; width: 100%; }
            .sidebar { max-width: 380px; width: 100%; display: flex; flex-direction: column; gap: 20px; }
            .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
            h2 { margin-top: 0; color: var(--text-main); font-size: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; margin-top: 15px; }
            .urun-kart { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
            .urun-kart:hover { transform: translateY(-4px); box-shadow: 0 12px 20px rgba(0,0,0,0.08); }
            .urun-img { width: 100%; height: 160px; object-fit: cover; background: #f8fafc; }
            .urun-detay { padding: 16px; display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between; }
            .urun-isim { font-weight: 600; color: var(--text-main); font-size: 16px; margin-bottom: 8px; }
            .urun-fiyat { color: var(--primary); font-weight: 700; font-size: 18px; margin-bottom: 12px; }
            .btn { background: var(--primary); color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; width: 100%; }
            .btn:hover { background: var(--primary-hover); }
            .btn-odeme { background: var(--success); padding: 14px; font-size: 16px; margin-top: 15px; }
            .btn-odeme:hover { background: var(--success-hover); }
            .btn-sil { background: none; color: var(--danger); border: none; padding: 4px 8px; font-size: 13px; cursor: pointer; font-weight: 600; }
            .btn-sil:hover { background: #fef2f2; border-radius: 4px; }
            .sepet-oge { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <h2>🛍️ Teknoloji Kataloğu</h2>
                <div id="katalog" class="grid"></div>
            </div>
        </div>

        <div class="sidebar">
            <div class="card">
                <h2>🛒 Sepetiniz <span id="sepet-badge" style="font-size:12px; background:var(--primary); color:white; padding:2px 8px; border-radius:10px; display:none;">0</span></h2>
                <div id="sepet-icerik">Sepetiniz şu an boş.</div>
                <div id="sepet-toplam" style="font-weight:700; font-size:18px; margin-top:20px; text-align:right; display:none;"></div>
                <button id="btn-satinal" class="btn btn-odeme" style="display:none;" onclick="satinal()">💳 Güvenli Ödeme Yap</button>
            </div>
        </div>

        <script>
            async function katalogGetir() {
                const res = await fetch('/urunler');
                const urunler = await res.json();
                let html = '';
                urunler.forEach(u => {
                    html += \`
                        <div class="urun-kart">
                            <img src="\${u.gorsel}" class="urun-img">
                            <div class="urun-detay">
                                <div>
                                    <div class="urun-isim">\${u.isim}</div>
                                    <div class="urun-fiyat">\${u.fiyat} TL</div>
                                </div>
                                <button class="btn" onclick="sepeteEkle(\${u.id})">Sepete Ekle</button>
                            </div>
                        </div>\`;
                });
                document.getElementById('katalog').innerHTML = html;
            }

            async function sepeteEkle(id) {
                const res = await fetch('/sepet/ekle', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ urunId: id })
                });
                const sepet = await res.json();
                sepetiGuncelle(sepet);
            }

            async function sepettenSil(index) {
                const res = await fetch('/sepet/sil', {
                    method: 'DELETE',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ index })
                });
                const sepet = await res.json();
                sepetiGuncelle(sepet);
            }

            async function satinal() {
                const res = await fetch('/siparis-ver', { method: 'POST' });
                const data = await res.json();
                
                if(data.success) {
                    alert("🎉 " + data.message);
                    sepetiGuncelle([]);
                } else {
                    alert("❌ Hata: " + data.message);
                }
            }

            function sepetiGuncelle(sepet) {
                const icerik = document.getElementById('sepet-icerik');
                const toplamDiv = document.getElementById('sepet-toplam');
                const btnSatinAl = document.getElementById('btn-satinal');
                const badge = document.getElementById('sepet-badge');
                
                badge.innerText = sepet.length;
                badge.style.display = sepet.length > 0 ? "inline" : "none";
                
                if(sepet.length === 0) {
                    icerik.innerHTML = "Sepetiniz şu an boş.";
                    toplamDiv.style.display = "none";
                    btnSatinAl.style.display = "none";
                    return;
                }
                
                let html = '';
                let toplam = 0;
                sepet.forEach((s, idx) => {
                    html += \`
                        <div class="sepet-oge">
                            <div><span>\${s.isim}</span> - <strong>\${s.fiyat} TL</strong></div>
                            <button class="btn-sil" onclick="sepettenSil(\${idx})">❌ Sil</button>
                        </div>\`;
                    toplam += s.fiyat;
                });
                
                icerik.innerHTML = html;
                toplamDiv.innerText = "Toplam: " + toplam + " TL";
                toplamDiv.style.display = "block";
                btnSatinAl.style.display = "block";
            }

            katalogGetir();
        </script>
    </body>
    </html>
  `);
});

// --- BACKEND ROUTER MANTIĞI ---
app.get('/urunler', async (req, res) => {
  const span = tracer.startSpan('Katalog_Veritabanindan_Urunleri_Cek');
  await bekle(150);
  span.end();
  res.json(URUNLER);
});
logger.info({ message: 'Mağaza backend servisi Loki loglama sistemi başarıyla tetiklendi!' });
app.post('/sepet/ekle', async (req, res) => {
  const { urunId } = req.body;
  const span = tracer.startSpan('Sepete_Urun_Ekleme_Islemi');
  const urun = URUNLER.find(u => u.id === urunId);
  if (urun) SEPET.push(urun);
  span.end();
  res.json(SEPET);
});

app.delete('/sepet/sil', async (req, res) => {
  const { index } = req.body;
  const span = tracer.startSpan('Sepetten_Urun_Silme_Islemi');
  if (index >= 0 && index < SEPET.length) {
    SEPET.splice(index, 1);
  }
  span.end();
  res.json(SEPET);
});

app.post('/siparis-ver', async (req, res) => {
  const anaSpan = tracer.startSpan('Eticaret_Siparis_Ana_Sureci');
  let toplamTutar = SEPET.reduce((toplam, urun) => toplam + urun.fiyat, 0);

  anaSpan.setAttribute('siparis.toplam_tutar', toplamTutar);
  anaSpan.setAttribute('siparis.urun_adedi', SEPET.length);

  try {
    const stokSpan = tracer.startSpan('Stok_Guncelleme_Servisi', { parent: anaSpan });
    await bekle(300);
    stokSpan.end();

    const odemeSpan = tracer.startSpan('Banka_Odeme_Ag_Gecidi', { parent: anaSpan });
    await bekle(500);

    // 🎯 Dinamik limit kontrolü ve string tip dönüşümü
    const KART_LIMITI = 6000;
    if (toplamTutar > KART_LIMITI) {
      hataSayaci.add(1, { 'hata.tipi': 'limit_asimi', 'sepet.tutar': String(toplamTutar) });
      throw new Error(`Banka Reddi: Yetersiz Limit! Sepet toplamınız (${toplamTutar} TL), kart limitinizi (${KART_LIMITI} TL) aşıyor.`);
    }
    
    // Eğer limit aşılmadıysa süreç başarılı devam eder
    odemeSpan.end();
    basariliSiparisSayaci.add(1, { 'islem.durumu': 'basarili' });

    SEPET = [];
    res.json({ success: true, message: `Ödemeniz alındı! Toplam ${toplamTutar} TL başarıyla tahsil edildi.` });

  } catch (error) {
    // 🎯 YENİ EKLEDİĞİMİZ SATIR: Log ile Trace'i birbirine bağlıyoruz
    const traceId = anaSpan.spanContext().traceId;
    console.error(`🚨 [HATA] [TraceID: ${traceId}] İşlem Başarısız: ${error.message}`);
    logger.error({ message: `Sistemde kritik bir hata oluştu: ${error.message}` });

    anaSpan.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: error.message });
    anaSpan.recordException(error);
    res.status(400).json({ success: false, message: error.message });
  } finally {
    anaSpan.end();
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🎯 Mağaza Yayında: http://localhost:${PORT}`);
});