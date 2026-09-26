const os = require('os');

function getLanInterfaces(port = 3000) {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const isVirtual = /virtual|vbox|vmnet|docker|hyper-v|wsl|loopback/i.test(name);
        const isWifi = /wi-fi|wifi|wlan|wireless/i.test(name);
        const isEthernet = /ethernet|eth|lan/i.test(name) && !isVirtual;

        results.push({
          name,
          address: addr.address,
          netmask: addr.netmask,
          isWifi,
          isEthernet,
          isVirtual,
          url: `http://${addr.address}:${port}`,
          operatorUrl: `http://${addr.address}:${port}/operator.html`
        });
      }
    }
  }

  // Sort: Wi-Fi first, then physical Ethernet, then others, virtual last
  results.sort((a, b) => {
    if (a.isWifi && !b.isWifi) return -1;
    if (!a.isWifi && b.isWifi) return 1;
    if (a.isEthernet && !b.isEthernet) return -1;
    if (!a.isEthernet && b.isEthernet) return 1;
    if (!a.isVirtual && b.isVirtual) return -1;
    if (a.isVirtual && !b.isVirtual) return 1;
    return 0;
  });

  // Fallback for containers, cloud hosts, or environments without active LAN Wi-Fi
  if (results.length === 0) {
    results.push({
      name: 'Loopback / Cloud Container',
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      isWifi: false,
      isEthernet: false,
      isVirtual: false,
      url: `http://localhost:${port}`,
      operatorUrl: `http://localhost:${port}/operator.html`
    });
  }

  return results;
}

function printNetworkBanner(port, activeSessionPath) {
  const lanList = getLanInterfaces(port);
  const primary = lanList[0];

  console.log(`=================================================================`);
  console.log(`  [RTFTP Studio Photo Preview & Selection Server - LAN Ready]  `);
  console.log(`=================================================================`);
  console.log(`  [Akses PC Operator (Lokal)]`);
  console.log(`  - Dashboard Operator : http://localhost:${port}/operator.html`);
  console.log(`  - Layar Klien Lokal  : http://localhost:${port}`);
  console.log(``);
  console.log(`  [Akses Perangkat Klien (Tablet / HP / Laptop via Wi-Fi & LAN)]`);

  if (lanList.length > 0) {
    lanList.forEach(iface => {
      const tag = iface.isWifi ? '[Wi-Fi]' : iface.isVirtual ? '[Virtual]' : '[Ethernet]';
      console.log(`  - ${tag} ${iface.name.padEnd(16)} : ${iface.url}`);
    });
    if (primary) {
      console.log(``);
      console.log(`  >>> Buka di Tablet Klien: ${primary.url} <<<`);
    }
  } else {
    console.log(`  [Peringatan] Tidak ada antarmuka jaringan aktif terdeteksi selain localhost.`);
  }

  console.log(``);
  console.log(`  [Sesi Aktif]: ${activeSessionPath}`);
  console.log(`  [Penting]   : Jika tablet tidak bisa konek, pastikan Windows Firewall`);
  console.log(`                mengizinkan port ${port} dan network diset ke "Private".`);
  console.log(`=================================================================`);
}

module.exports = {
  getLanInterfaces,
  printNetworkBanner
};
