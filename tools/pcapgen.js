// Write every lab scenario as a real .pcap (test/pcaps/NAME.pcap) using the same engine the page uses.
// usage: node tools/pcapgen.js [outdir]
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console };
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/ws-5-pcap.js'), 'utf8'), ctx);
const P = ctx.__pcap, out = process.argv[2] || path.join(root, 'test/pcaps');
fs.mkdirSync(out, { recursive: true });
for (const id of Object.keys(P.SCEN)) {
  const bytes = P.pcap(id);
  fs.writeFileSync(path.join(out, id + '.pcap'), Buffer.from(bytes));
  console.log(id, P.build(id).length, 'packets', bytes.length, 'bytes');
}
