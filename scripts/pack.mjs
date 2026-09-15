/* Сборка для площадки: zip из dist с index.html в корне — именно в таком виде
   GamePush принимает билд. Архив пишется руками, чтобы не тащить зависимость. */
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { resolve, join, posix } from 'node:path';

const SOURCE = resolve('dist'), OUT_DIR = resolve('release'), OUT = join(OUT_DIR, 'nochnaya-zapravka-3d.zip');

const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

async function collect(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name), name = prefix ? posix.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...(await collect(path, name)));
    else files.push({ name, data: await readFile(path) });
  }
  return files;
}

/* Время в zip хранится в формате DOS: две упакованные 16-битные половинки. */
function dosStamp(date = new Date()) {
  return {
    time: ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff,
    date: (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff
  };
}

function zip(files) {
  const stamp = dosStamp(), locals = [], central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8'), body = deflateRawSync(file.data, { level: 9 });
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10); entry.writeUInt16LE(stamp.time, 12); entry.writeUInt16LE(stamp.date, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(body.length, 20); entry.writeUInt32LE(file.data.length, 24);
    entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(0, 30); entry.writeUInt32LE(0, 34);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const files = await collect(SOURCE).catch(() => { throw new Error('Нет папки dist — сначала npm run build') });
if (!files.some((file) => file.name === 'index.html')) throw new Error('index.html должен лежать в корне архива');

const page = files.find((file) => file.name === 'index.html').data.toString('utf8');
if (/projectId:\s*['"]\s*['"]/.test(page)) console.warn('⚠  projectId и publicToken пустые — игра соберётся, но облачный прогресс и реклама работать не будут.');
if (/<link[^>]+href="\//.test(page) || /<script[^>]+src="\//.test(page)) throw new Error('В index.html остались пути от корня сайта — на площадке они не найдутся');

await mkdir(OUT_DIR, { recursive: true });
await rm(OUT, { force: true });
const archive = zip(files);
await writeFile(OUT, archive);

const raw = files.reduce((sum, file) => sum + file.data.length, 0), mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`Архив для площадки: release/nochnaya-zapravka-3d.zip`);
console.log(`${files.length} файлов · ${mb(raw)} МБ распакованными · ${mb(archive.length)} МБ в архиве (лимит площадки — 100 МБ).`);
