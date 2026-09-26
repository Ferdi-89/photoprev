# 📸 PhotoPrev (RTFTP) - Real-Time Studio Photo Preview & Selection System

Sistem server preview foto real-time berbasis jaringan lokal (LAN) untuk studio foto. Didesain untuk menghubungkan **PC Operator** (fotografer/editor) dengan **Layar Preview Klien** (PC client, iPad/tablet, atau smart TV).

Foto yang di-export oleh operator dari Lightroom / Photoshop langsung meluncur masuk ke layar preview secara *real-time* tanpa perlu me-refresh browser. Klien dapat membandingkan pose, memperbesar detail fokus, dan memilih foto untuk langsung dikirim ke folder antrean cetak.

---

## 🌟 Fitur Utama

### 1. Layar Preview Klien (`http://localhost:3000`)
* **Real-time Live Feed:** Foto baru langsung tampil begitu selesai diekspor di PC operator.
* **Side-by-Side Comparison:** Membandingkan 2 hingga 4 foto secara berdampingan di satu layar untuk memilih pose atau senyum terbaik.
* **Deep Zoom & Pan Lightbox:** Memeriksa ketajaman mata dan fokus wajah dengan scroll mouse atau drag.
* **Sistem Keranjang Pilihan Cetak:** Klien memilih foto, menentukan ukuran (4R, 10R, 12R, Kanvas) dan jumlah lembar (*quantity*).
* **Performa Ringan & Cepat:** Generator thumbnail instan otomatis mengoptimalkan foto 24–50 Megapixel sehingga galeri tetap mulus di tablet/PC client.

### 2. Dashboard Operator (`http://localhost:3000/operator.html`)
* **Pengaturan Folder Sesi:** Memilih folder photoshoot aktif (misal `D:\Photos\Sesi_Keluarga_01`).
* **Live Selection Queue:** Operator dapat melihat foto-foto yang sedang dipilih oleh klien secara *live*.
* **1-Klik Salin ke Folder `_SIAP_CETAK`:** Sistem otomatis menyalin file foto resolusi tinggi asli ke folder `[Sesi]/_SIAP_CETAK/` dengan penamaan terstruktur dan rekap pesanan `REKAP_CETAK.txt`.
* **Generator Foto Demo:** Dilengkapi tombol untuk membuat 6 foto contoh siap uji jika belum ada photoshoot nyata.

---

## 🚀 Cara Menjalankan

### Cara 1: Menggunakan Script Windows (Paling Mudah)
Cukup klik dua kali file:
```
start-server.bat
```

### Cara 2: Menggunakan Terminal / CMD
```bash
node server.js
```

Server akan aktif di:
* **Layar Klien:** `http://localhost:3000`
* **Layar Operator:** `http://localhost:3000/operator.html`

---

## 📱 Akses dari Tablet / iPad / PC Lain di Studio (LAN / Wi-Fi)

Agar tablet atau PC preview klien di studio bisa membuka aplikasi:
1. Pastikan kedua perangkat terhubung ke Wi-Fi / Router studio yang sama.
2. Cek IP lokal PC Operator (jalankan `ipconfig` di CMD, misal: `192.168.1.15`).
3. Di browser tablet/klien, buka:
   ```
   http://192.168.1.15:3000
   ```

---

## 📂 Struktur Folder
```text
RTFTP/
├── server.js              # Server utama Express & WebSocket
├── lib/
│   ├── config.js          # Pengaturan sesi & folder
│   ├── watcher.js         # Pemantau folder otomatis (Chokidar)
│   ├── thumbnail.js       # Generator thumbnail cepat (Sharp)
│   ├── printManager.js    # Manajemen pilihan cetak & auto-copy
│   └── demoData.js        # Generator foto demo portrait
├── public/                # Antarmuka Web Klien & Operator
│   ├── index.html         # Layar Preview Klien
│   ├── operator.html      # Dashboard Operator
│   ├── css/               # Style Dark Mode, Grid, Lightbox, Compare
│   └── js/                # Logika WebSocket, Zoom, Seleksi, dll.
├── storage/
│   ├── demo_session/      # Folder sesi default
│   └── cache/             # Penyimpanan cache thumbnail
├── start-server.bat       # Launcher Windows 1-klik
└── package.json
```
