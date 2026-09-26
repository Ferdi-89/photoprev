# 🚀 Panduan Deployment RTFTP (PhotoPrev) untuk Beta Tester

Dokumen ini adalah panduan deployment resmi untuk **RTFTP (PhotoPrev)** agar dapat dicobakan oleh klien dan beta tester, baik secara online (cloud / tunnel) maupun di jaringan lokal studio (LAN/Wi-Fi).

---

## 📌 Ringkasan Arsitektur & Kesiapan Sistem

- **Runtime:** Node.js (v18 / v20 LTS)
- **Engine Gambar:** Sharp (`libvips`) dengan pre-caching 1200px (HD) & 2560px (2K/4K)
- **Komunikasi Real-time:** WebSocket (`ws`) dengan fallback HTTPS/WSS auto-detect
- **Protokol Jaringan:** HTTP/REST API + WebSocket pada port `3000` (atau variabel lingkungan `PORT`)
- **Health Check Endpoint:** `GET /health` dan `GET /api/health`

---

## 🌐 Opsi 1: Share Instan ke Beta Tester Online (Paling Cepat / Zero-Config)

Gunakan cara ini jika Anda ingin beta tester di luar studio langsung mencoba sistem dari HP/Tablet/Laptop mereka tanpa perlu menyewa server cloud.

### Langkah di Windows PC Operator:
1. Pastikan server aktif (bisa dengan double-click `start-server.bat` atau `run.vbs`).
2. Double-click file:
   ```cmd
   share-beta-online.bat
   ```
   *Atau jalankan perintah terminal:*
   ```bash
   npm run tunnel
   ```
3. Anda akan mendapatkan URL HTTPS publik, misalnya:
   ```text
   your url is: https://bright-photo-test.loca.lt
   ```
4. **Kirim link tersebut ke Beta Tester:**
   - **Layar Klien:** `https://bright-photo-test.loca.lt`
   - **Layar Operator:** `https://bright-photo-test.loca.lt/operator.html`

> 💡 **Catatan untuk Beta Tester:** Saat pertama kali membuka link localtunnel, klik tombol **"Click to Continue"** (atau masukkan IP publik host) untuk masuk ke aplikasi.

---

## ☁️ Opsi 2: Deploy Cloud Menggunakan Docker (Rekomendasi Staging/Production)

Proyek ini sudah dilengkapi `Dockerfile` dan `docker-compose.yml` berbasis `node:20-bookworm-slim` yang sudah teruji untuk modul native `sharp`.

### Menjalankan dengan Docker Compose:
```bash
# 1. Build dan jalankan container
docker compose up -d --build

# 2. Periksa status dan log container
docker compose ps
docker compose logs -f

# 3. Hentikan container
docker compose down
```

### Menjalankan dengan Docker Standalone:
```bash
# Build image
docker build -t photoprev:beta .

# Run container dengan volume penyimpanan foto
docker run -d \
  --name photoprev-app \
  -p 3000:3000 \
  -v photoprev_data:/app/storage \
  --restart unless-stopped \
  photoprev:beta
```

Aplikasi dapat langsung diakses di `http://<IP-SERVER>:3000`.

---

## 🚀 Opsi 3: Deploy 1-Klik ke Cloud PaaS (Render.com / Railway)

Proyek ini sudah memiliki manifest `render.yaml` untuk deployment otomatis.

### Langkah Deploy di Render:
1. Push repository ke GitHub / GitLab.
2. Buka dashboard [Render.com](https://render.com/) -> **New** -> **Blueprint**.
3. Hubungkan repository `photoprev`. Render akan otomatis mendeteksi file `render.yaml`.
4. Klik **Apply**.
5. Server akan otomatis melakukan build `npm ci --omit=dev` dan menjalankan `node server.js`.
6. Anda akan mendapatkan URL HTTPS permanen (contoh: `https://photoprev-preview.onrender.com`).

---

## 🖥️ Opsi 4: Deploy di Linux VPS (Ubuntu/Debian dengan PM2 & Nginx)

Untuk deployment VPS mandiri (DigitalOcean, Linode, AWS EC2, Biznet Gio, IDCloudHost):

### 1. Install Node.js 20 & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/Ferdi-89/photoprev.git /var/www/photoprev
cd /var/www/photoprev
npm ci --omit=dev
```

### 3. Jalankan Aplikasi dengan PM2
```bash
pm2 start server.js --name "photoprev"
pm2 save
pm2 startup
```

### 4. Konfigurasi Reverse Proxy Nginx dengan WebSocket
Buat file `/etc/nginx/sites-available/photoprev`:
```nginx
server {
    listen 80;
    server_name studio.namadomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Aktifkan dan restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/photoprev /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🏢 Opsi 5: Deploy di Jaringan Studio Lokal (LAN / Wi-Fi)

Jika beta testing dilakukan langsung di studio menggunakan tablet/iPad klien dan PC operator:

1. Sambungkan PC Operator dan Tablet Klien ke **Wi-Fi studio yang sama**.
2. Jalankan server:
   ```cmd
   start-server.bat
   ```
3. Terminal akan menampilkan IP lokal yang terdeteksi secara otomatis:
   ```text
   >>> Buka di Tablet Klien: http://192.168.1.15:3000 <<<
   ```
4. Buka alamat tersebut di browser Chrome/Safari pada tablet.
5. Untuk kiosk/touchscreen mode di tablet, gunakan fitur browser *"Add to Home Screen"* (PWA-ready).

---

## 🩺 Monitoring & Health Probes

Endpoint berikut dapat digunakan untuk memantau status aplikasi secara berkala:

```http
GET /health
GET /api/health
```

**Respon JSON:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 1240,
  "timestamp": 1727339120000,
  "environment": "production"
}
```

---

## 📋 Skenario Uji untuk Beta Tester (User Acceptance Test)

Minta beta tester untuk menguji alur kerja berikut:

| No | Modul | Skenario Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | **Galeri Klien** | Buka halaman utama (`/`) di HP / Tablet | Muncul grid foto demo dengan layout estetik dark mode. |
| 2 | **Tap & Seleksi** | Tap salah satu foto | Foto terpilih membesar secara halus (*hero expansion*) dan counter di keranjang bertambah. |
| 3 | **Lightbox & Zoom** | Double-tap pada foto | Lightbox fullscreen terbuka, dapat di-zoom/pan dengan sentuhan jari. |
| 4 | **Compare Mode** | Pilih 2 sampai 4 foto lalu klik "Bandingkan" | Foto tampil berdampingan (*side-by-side*) untuk perbandingan pose/senyum. |
| 5 | **Keranjang Cetak** | Klik ikon Keranjang di pojok kanan bawah | Muncul modal pemilihan ukuran cetak (4R, 10R, Kanvas) dan jumlah lembar. |
| 6 | **Dashboard Operator** | Buka `/operator.html` di browser lain | Status stasiun klien terlihat Online, antrean foto terpilih masuk secara *live*. |
| 7 | **Export Cetak** | Klik tombol "Salin ke _SIAP_CETAK" di operator | File foto resolusi asli disalin beserta laporan `REKAP_CETAK.txt`. |
