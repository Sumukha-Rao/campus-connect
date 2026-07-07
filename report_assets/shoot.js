// One-off screenshot driver for the College Forum App report.
require('dotenv').config();
const path = require('path');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const puppeteer = require('puppeteer-core');

const JWT_SECRET = process.env.JWT_SECRET;
const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, 'shots');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function userCtx(username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.role, u.department_id, d.name AS department_name
     FROM users u LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.username = ? LIMIT 1`, [username]);
  if (!rows.length) throw new Error('no user ' + username);
  const u = rows[0];
  let managed_club_ids = [];
  if (u.role === 'publisher' || u.role === 'admin') {
    const [c] = await pool.query('SELECT id FROM clubs WHERE club_head_id = ?', [u.id]);
    managed_club_ids = c.map(r => r.id);
  }
  const payload = { id: u.id, username: u.username, role: u.role, department_id: u.department_id, managed_club_ids };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const user = { id: u.id, username: u.username, full_name: u.full_name, role: u.role,
    department_id: u.department_id, department_name: u.department_name, managed_club_ids };
  return { token, user };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  async function shot(name, { w = 1280, h = 860, ctx = null, goto = '/app.html', mobile = false, before = null, full = false } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    if (ctx) {
      await page.evaluate((t, u) => {
        localStorage.setItem('cc_token', t);
        localStorage.setItem('cc_user', JSON.stringify(u));
        localStorage.setItem('cc_theme', 'light');
      }, ctx.token, ctx.user);
    } else {
      await page.evaluate(() => localStorage.setItem('cc_theme', 'light'));
    }
    await page.goto(BASE + goto, { waitUntil: 'networkidle2' });
    await sleep(1200);
    if (before) { await before(page); await sleep(1300); }
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: full });
    console.log('saved', name);
    await page.close();
  }

  async function clickTab(page, tab) {
    await page.evaluate((t) => {
      const el = document.querySelector(`#mainTabs [data-tab="${t}"]`);
      if (el) {
        const li = el.closest('.nav-item');
        if (li) li.classList.remove('d-none');
        el.style.display = '';
        el.click();
      }
    }, tab);
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  const admin = await userCtx('admin');
  const pub = await userCtx('hod_cse');
  const view = await userCtx('bharath_student');

  await shot('01_login', { goto: '/index.html', ctx: null, h: 820 });

  await shot('02_register', { goto: '/index.html', ctx: null, h: 980, before: async (p) => {
    await p.evaluate(() => { const b = document.querySelector('#tab-register'); if (b) b.click(); });
  }});

  await shot('03_viewer_feed', { ctx: view, h: 1500 });
  await shot('04_viewer_communities', { ctx: view, h: 1500, before: (p) => clickTab(p, 'subs') });

  await shot('05_publisher_compose', { ctx: pub, w: 1280, h: 1320, before: (p) => clickTab(p, 'compose') });
  await shot('06_publisher_feed', { ctx: pub, h: 1500 });

  await shot('07_admin_dashboard', { ctx: admin, w: 1440, h: 1500, before: (p) => clickTab(p, 'admin') });

  await shot('09_offline', { goto: '/offline.html', ctx: null, h: 720 });

  await shot('10_mobile_feed', { ctx: view, w: 412, h: 880, mobile: true });
  await shot('11_mobile_communities', { ctx: view, w: 412, h: 880, mobile: true, before: (p) => clickTab(p, 'subs') });

  await browser.close();
  await pool.end();
  console.log('DONE');
})().catch(async e => { console.error('ERR', e); try { await pool.end(); } catch {} process.exit(1); });
