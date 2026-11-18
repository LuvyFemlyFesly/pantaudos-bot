// server.js
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');

// 0. ANTI-CRASH HANDLERS
process.on('unhandledRejection', (reason) => {
    console.warn('⚠️ [ANTI-CRASH] Unhandled Rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ [ANTI-CRASH] Uncaught Exception:', err?.message || err);
});

// 1. KONFIGURASI SUPABASE & KONSTANTA
const SUPABASE_URL = 'https://nkkaqrbolzsvuecxwxql.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CkSko1s38RVWDD5-ZTtiwQ_Wt5XIQL3';
const TARGET_GROUP_ID = '120363412150102602@g.us';
const HARI_MAP = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const QUORUM_THRESHOLD = 18; // 50% + 1 dari 34 Mahasiswa

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
app.use(cors());
app.use(express.json());

let isClientReady = false;
let isCronInitialized = false;
const sentH30Tracker = new Set();
const sentLateGraceTracker = new Set();
const pollVoterChoices = new Map(); // Map<pollId, Map<voterJid, 'opt1' | 'opt2' | 'reject'>>

// 2. SETUP CLIENT WHATSAPP (OPTIMIZED FOR LOW MEMORY & MACOS/LINUX)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('⚡ Scan QR Code berikut dengan WhatsApp bot kamu:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isClientReady = true;
    console.log('🤖 Bot WA PantauDos siap menerima chat & instruksi!');

    if (!isCronInitialized) {
        setupMorningReminder();
        setupPjReminder();
        setupH30AndLateGraceReminder();
        setupWeeklyResetCron();
        isCronInitialized = true;
        console.log('⏰ Seluruh jadwal Cron (Pagi, PJ, H-30, Radar H+15, Reset Mingguan) aktif.');
    }
});

client.on('disconnected', (reason) => {
    isClientReady = false;
    console.warn('⚠️ Bot WA terputus:', reason, '- Mencoba menghubungkan ulang...');
    setTimeout(() => {
        client.initialize().catch(err => console.error('Gagal re-init WA:', err.message));
    }, 5000);
});

client.on('auth_failure', (msg) => {
    isClientReady = false;
    console.error('❌ Otentikasi WA Gagal:', msg);
});

function getJakartaDate() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

function buildDailyScheduleList(schedules, requests, targetDay) {
    const list = [];
    if (!schedules) return list;

    schedules.forEach((s) => {
        const req = requests ? requests.find((r) => r.schedule_id === s.id) : null;
        const isApproved = req && req.status === 'approved';
        const chosenOpt = isApproved ? (req.selected_option === 1 ? req.opt1 : req.opt2) : null;
        const isChosenOnline = chosenOpt && (chosenOpt.isOnline === 'true' || chosenOpt.isOnline === true);

        if (s.day === targetDay) {
            if (isApproved && chosenOpt && chosenOpt.day !== targetDay) return;
            list.push({
                course: s.course,
                time: isApproved && chosenOpt ? chosenOpt.time : s.time,
                room: isApproved && isChosenOnline ? 'Daring (Online)' : s.room,
                dosen: s.dosen,
                isHadir: s.is_hadir,
                isTask: req && req.status === 'async_task',
                linkGmeet: req ? req.gmeet_link : null
            });
        } else if (isApproved && chosenOpt && chosenOpt.day === targetDay) {
            list.push({
                course: `${s.course} (Pindahan)`,
                time: chosenOpt.time,
                room: isChosenOnline ? 'Daring (Online)' : s.room,
                dosen: s.dosen,
                isHadir: s.is_hadir,
                isTask: false,
                linkGmeet: req ? req.gmeet_link : null
            });
        }
    });

    return list;
}

// =================================================================
// 3A. PENGINGAT JADWAL PAGI (06.30 WIB)
// =================================================================
function setupMorningReminder() {
    cron.schedule('30 6 * * 1-5', async () => {
        if (!isClientReady) return;
        try {
            const today = HARI_MAP[getJakartaDate().getDay()];
            const [{ data: schedules }, { data: requests }] = await Promise.all([
                supabase.from('master_schedules').select('*'),
                supabase.from('requests').select('*')
            ]);

            const todaySchedule = buildDailyScheduleList(schedules, requests, today);
            if (todaySchedule.length === 0) return;

            let broadcastText = `*[PENGINGAT KULIAH HARI INI - 2025 C]*\nHari: *${today.toUpperCase()}*\n\n`;
            todaySchedule.forEach((item, index) => {
                const statusKet = item.isTask ? 'Tugas Mandiri' : (item.isHadir ? 'Dosen Hadir' : 'Belum Konfirmasi');
                broadcastText += `${index + 1}. *${item.course}*\n` +
                    `   • Jam: ${item.time}\n` +
                    `   • Ruang: ${item.room}\n` +
                    `   • Dosen: ${item.dosen}\n` +
                    `   • Status: ${statusKet}\n`;
                if (item.linkGmeet) broadcastText += `   • Tautan: ${item.linkGmeet}\n`;
                broadcastText += `\n`;
            });
            broadcastText += `_Selalu pantau informasi terbaru melalui website PantauDos._`;

            await client.sendMessage(TARGET_GROUP_ID, broadcastText);
            console.log('[CRON] Pengingat pagi berhasil dikirim.');
        } catch (error) {
            console.error('[CRON ERROR] Gagal mengirim pengingat pagi:', error.message);
        }
    }, { timezone: 'Asia/Jakarta' });
}

// =================================================================
// 3B. PENGINGAT LINK GMEET PJ KELAS (19.00 WIB)
// =================================================================
function setupPjReminder() {
    cron.schedule('0 19 * * *', async () => {
        if (!isClientReady) return;
        try {
            const [{ data: reqsNull }, { data: reqsEmpty }, { data: schedules }] = await Promise.all([
                supabase.from('requests').select('*').eq('status', 'approved').eq('ask_pj_for_gmeet', true).is('gmeet_link', null),
                supabase.from('requests').select('*').eq('status', 'approved').eq('ask_pj_for_gmeet', true).eq('gmeet_link', ''),
                supabase.from('master_schedules').select('*')
            ]);

            const allTargets = [...(reqsNull || []), ...(reqsEmpty || [])];
            if (allTargets.length === 0 || !schedules) return;

            for (const r of allTargets) {
                const course = schedules.find(s => s.id === r.schedule_id);
                if (!course) continue;
                const chosenOpt = r.selected_option === 1 ? r.opt1 : r.opt2;
                if (!chosenOpt) continue;

                const text = `*[PENGINGAT PJ: LINK GOOGLE MEET BELUM TERSEDIA]*\n\n` +
                    `Yth. Penanggung Jawab Mata Kuliah, tautan Google Meet untuk kelas *${course.course}* (${course.dosen}) belum diinput ke dalam sistem.\n\n` +
                    `Jadwal Pengganti: *${chosenOpt.day}, ${chosenOpt.time}*\n\n` +
                    `Mohon segera perbarui data melalui Dashboard PJ di website PantauDos.`;

                await client.sendMessage(TARGET_GROUP_ID, text);
            }
        } catch (error) {
            console.error('[CRON ERROR] Gagal pengingat PJ:', error.message);
        }
    }, { timezone: 'Asia/Jakarta' });
}

// =================================================================
// 3C. PENGINGAT KELAS H-30 MENIT & RADAR KETERLAMBATAN H+15 MENIT
// =================================================================
function setupH30AndLateGraceReminder() {
    cron.schedule('* * * * *', async () => {
        if (!isClientReady) return;
        try {
            const now = getJakartaDate();
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                sentH30Tracker.clear();
                sentLateGraceTracker.clear();
            }

            // Target H-30 Menit (30 menit ke depan)
            const h30Date = new Date(now.getTime() + 30 * 60000);
            const h30TimeStr = String(h30Date.getHours()).padStart(2, '0') + ':' + String(h30Date.getMinutes()).padStart(2, '0');
            const h30Day = HARI_MAP[h30Date.getDay()];
            const h30DateKey = `${h30Date.getFullYear()}-${h30Date.getMonth() + 1}-${h30Date.getDate()}`;

            // Target H+15 Menit Grace Period (15 menit yang lalu)
            const lateDate = new Date(now.getTime() - 15 * 60000);
            const lateTimeStr = String(lateDate.getHours()).padStart(2, '0') + ':' + String(lateDate.getMinutes()).padStart(2, '0');
            const lateDay = HARI_MAP[lateDate.getDay()];
            const lateDateKey = `${lateDate.getFullYear()}-${lateDate.getMonth() + 1}-${lateDate.getDate()}`;

            const [{ data: schedules }, { data: requests }] = await Promise.all([
                supabase.from('master_schedules').select('*'),
                supabase.from('requests').select('*')
            ]);

            if (!schedules) return;

            for (const s of schedules) {
                const req = requests ? requests.find(r => r.schedule_id === s.id) : null;
                if (req && (req.status === 'async_task' || req.status === 'pending')) continue;

                let classDay = s.day;
                let classTime = s.time;
                let isOnline = false;
                let gmeetLink = null;
                let isPindahan = false;

                if (req && req.status === 'approved') {
                    const chosenOpt = req.selected_option === 1 ? req.opt1 : req.opt2;
                    if (chosenOpt) {
                        classDay = chosenOpt.day;
                        classTime = chosenOpt.time;
                        isOnline = chosenOpt.isOnline === 'true' || chosenOpt.isOnline === true;
                        gmeetLink = req.gmeet_link;
                        isPindahan = true;
                    }
                }

                const startTimeMatch = classTime ? classTime.match(/(\d{2}:\d{2})/) : null;
                if (!startTimeMatch) continue;
                const startTime = startTimeMatch[1];

                // 1. Cek Peringatan H-30 Menit
                const h30Key = `${h30DateKey}-${s.id}-${startTime}`;
                if (classDay === h30Day && startTime === h30TimeStr && !sentH30Tracker.has(h30Key)) {
                    sentH30Tracker.add(h30Key);

                    let text = `*[PERHATIAN: PERKULIAHAN DIMULAI 30 MENIT LAGI]*\n\n`;
                    text += `Mata Kuliah: *${s.course}*\n`;
                    text += `Dosen: ${s.dosen}\n`;
                    text += `Waktu: ${classTime}\n`;
                    text += `Ruangan: ${isPindahan && isOnline ? 'Daring (Online)' : s.room}\n`;

                    if (isOnline) {
                        text += `Tautan GMeet: ${gmeetLink ? gmeetLink : 'Menunggu input dari PJ'}\n`;
                    }
                    if (isPindahan) {
                        text += `\n_Catatan: Ini merupakan jadwal pengganti yang telah disepakati._\n`;
                    }
                    text += `\nHarap mahasiswa segera bersiap-siap.`;

                    await client.sendMessage(TARGET_GROUP_ID, text);
                    console.log(`[CRON] Peringatan H-30 terkirim untuk ${s.course}`);
                }

                // 2. Cek Radar Keterlambatan Dosen H+15 Menit
                const lateKey = `${lateDateKey}-${s.id}-${startTime}`;
                if (classDay === lateDay && startTime === lateTimeStr && !s.is_hadir && !sentLateGraceTracker.has(lateKey)) {
                    sentLateGraceTracker.add(lateKey);

                    const lateText = `*[RADAR KELAS: BELUM ADA KONFIRMASI DOSEN (H+15 MENIT)]*\n\n` +
                        `Perkuliahan *${s.course}* (${s.dosen}) dijadwalkan mulai pukul *${startTime} WIB*, namun status kehadiran dosen di sistem PantauDos belum terkonfirmasi.\n\n` +
                        `Mohon PJ Mata Kuliah segera menghubungi dosen pengampu terkait kepastian kelas hari ini.`;

                    await client.sendMessage(TARGET_GROUP_ID, lateText);
                    console.log(`[CRON] Radar H+15 terkirim untuk ${s.course}`);
                }
            }
        } catch (err) {
            console.error('[CRON ERROR] Peringatan H-30 / H+15 gagal dieksekusi:', err.message);
        }
    }, { timezone: 'Asia/Jakarta' });
}

// =================================================================
// 3D. AUTO-RESET SIKLUS MINGGUAN (MINGGU 23:59 WIB)
// =================================================================
function setupWeeklyResetCron() {
    cron.schedule('59 23 * * 0', async () => {
        try {
            await Promise.all([
                supabase.from('requests').delete().neq('id', 0),
                supabase.from('master_schedules').update({ is_hadir: false, attendance_count: 0 }).neq('id', 0)
            ]);
            pollVoterChoices.clear();

            if (isClientReady) {
                const resetMsg = `*[RESET OTOMATIS SIKLUS MINGGUAN - PANTAUDOS]*\n\n` +
                    `Seluruh status jadwal pengganti, tugas mandiri, dan presensi pekan lalu telah direset secara otomatis.\n` +
                    `Jadwal perkuliahan S1 SI 2025 C untuk pekan baru kini kembali ke *Jadwal Patokan Reguler*.`;
                await client.sendMessage(TARGET_GROUP_ID, resetMsg);
            }
            console.log('[CRON] Auto-reset siklus mingguan berhasil dijalankan.');
        } catch (err) {
            console.error('[CRON ERROR] Gagal menjalankan auto-reset mingguan:', err.message);
        }
    }, { timezone: 'Asia/Jakarta' });
}

// =================================================================
// 4. LOGIKA INTERAKTIF BOT
// =================================================================
client.on('message', async (msg) => {
    try {
        const text = (msg.body || '').trim().toLowerCase();

        if (text === '!idgrup') return await msg.reply(`ID Obrolan Ini: ${msg.from}`);

        if (text === '!help' || text === '!menu') {
            return await msg.reply(
                `*[PANTAUDOS BOT COMMANDS]*\n` +
                `• *!jadwal* : Cek jadwal hari ini\n` +
                `• *!jadwal besok* : Cek jadwal besok\n` +
                `• *!jadwal <hari>* : Cek hari tertentu\n` +
                `• *!link <matkul>* : Ambil link GMeet mata kuliah\n` +
                `• *!tugas* : Cek tugas mandiri\n` +
                `• *!info* : Cek papan pengumuman kelas\n` +
                `• *!status dosen* : Cek kehadiran dosen\n\n` +
                `_PantauDos Sistem Informasi 2025 C_`
            );
        }

        if (text === '!info' || text === '!pengumuman') {
            const { data: anns } = await supabase.from('announcements').select('*').order('id', { ascending: false }).limit(5);
            if (!anns || anns.length === 0) {
                return await msg.reply('*[PAPAN PENGUMUMAN KELAS]*\nBelum ada pengumuman terbaru saat ini.');
            }

            let replyMsg = '*[PAPAN PENGUMUMAN KELAS - 2025 C]*\n\n';
            anns.forEach((a, idx) => {
                replyMsg += `${idx + 1}. *[${a.sender}]* (${a.timestamp})\n   ${a.message}\n\n`;
            });
            return await msg.reply(replyMsg.trim());
        }

        if (text.startsWith('!link')) {
            const keyword = text.replace('!link', '').trim().toLowerCase();
            if (!keyword) {
                return await msg.reply('Harap cantumkan nama mata kuliah.\nContoh: *!link pemweb* atau *!link pbd*');
            }

            const [{ data: schedules }, { data: requests }] = await Promise.all([
                supabase.from('master_schedules').select('*'),
                supabase.from('requests').select('*')
            ]);

            const course = (schedules || []).find(s => {
                const lowerCourse = s.course.toLowerCase();
                const initials = lowerCourse.split(' ').map(w => w[0]).join('');
                return lowerCourse.includes(keyword) || initials === keyword;
            });

            if (!course) return await msg.reply(`Data mata kuliah yang mengandung kata "${keyword}" tidak ditemukan.`);

            const req = requests ? requests.find(r => r.schedule_id === course.id) : null;
            if (req && req.status === 'approved') {
                const chosenOpt = req.selected_option === 1 ? req.opt1 : req.opt2;
                const isOnline = chosenOpt && (chosenOpt.isOnline === 'true' || chosenOpt.isOnline === true);

                if (isOnline) {
                    if (req.gmeet_link) {
                        return await msg.reply(`*[TAUTAN KELAS: ${course.course.toUpperCase()}]*\n\nJadwal: ${chosenOpt.day}, ${chosenOpt.time}\nDosen: ${course.dosen}\n\nLink: ${req.gmeet_link}`);
                    }
                    return await msg.reply(`Perkuliahan *${course.course}* disepakati melalui daring, namun PJ belum menginput tautan Google Meet.`);
                }
                return await msg.reply(`Jadwal pengganti kelas *${course.course}* (${chosenOpt.day}, ${chosenOpt.time}) diadakan secara *Tatap Muka* di ruang ${course.room}.`);
            } else if (req && req.status === 'async_task') {
                return await msg.reply(`Kelas *${course.course}* telah dialihkan menjadi Tugas Mandiri untuk pekan ini.`);
            }
            return await msg.reply(`Kelas reguler *${course.course}* diadakan secara *Tatap Muka* di ruang ${course.room}.`);
        }

        if (text.startsWith('!jadwal')) {
            const todayIndex = getJakartaDate().getDay();
            let targetDay = HARI_MAP[todayIndex];
            let labelKeterangan = 'HARI INI';

            const args = text.replace('!jadwal', '').trim();
            if (args === 'besok') {
                targetDay = HARI_MAP[(todayIndex + 1) % 7];
                labelKeterangan = 'BESOK';
            } else if (args) {
                const inputHari = args.charAt(0).toUpperCase() + args.slice(1).toLowerCase();
                if (HARI_MAP.includes(inputHari)) {
                    targetDay = inputHari;
                    labelKeterangan = targetDay.toUpperCase();
                } else {
                    return await msg.reply('Nama hari tidak terdaftar.');
                }
            }

            if (targetDay === 'Sabtu' || targetDay === 'Minggu') {
                return await msg.reply(`Perkuliahan pada hari ${targetDay} diliburkan.`);
            }

            const [{ data: schedules }, { data: requests }] = await Promise.all([
                supabase.from('master_schedules').select('*'),
                supabase.from('requests').select('*')
            ]);

            const targetSchedule = buildDailyScheduleList(schedules, requests, targetDay);
            if (targetSchedule.length === 0) {
                return await msg.reply(`*[JADWAL ${targetDay.toUpperCase()}]*\nTidak ada data perkuliahan aktif.`);
            }

            let replyMsg = `*[JADWAL KULIAH - ${targetDay.toUpperCase()} (${labelKeterangan})]*\n\n`;
            targetSchedule.forEach((item, index) => {
                const statusKet = item.isTask ? 'Tugas Mandiri' : (item.isHadir ? 'Dosen Hadir' : 'Belum Konfirmasi');
                replyMsg += `${index + 1}. *${item.course}*\n   • Jam: ${item.time}\n   • Ruang: ${item.room}\n   • Dosen: ${item.dosen}\n   • Status: ${statusKet}\n`;
                if (item.linkGmeet) replyMsg += `   • Tautan: ${item.linkGmeet}\n`;
                replyMsg += `\n`;
            });
            return await msg.reply(replyMsg.trim());
        }

        if (text === '!tugas') {
            const [{ data: reqs }, { data: schedules }] = await Promise.all([
                supabase.from('requests').select('*').eq('status', 'async_task'),
                supabase.from('master_schedules').select('*')
            ]);

            if (!reqs || reqs.length === 0) {
                return await msg.reply('*[PAPAN TUGAS MANDIRI]*\nTidak ada modul atau penugasan mandiri baru.');
            }

            let replyMsg = '*[DAFTAR TUGAS MANDIRI]*\n\n';
            reqs.forEach((r, idx) => {
                const course = schedules ? schedules.find((s) => s.id === r.schedule_id) : null;
                replyMsg += `${idx + 1}. *${course ? course.course : 'Mata Kuliah'}*\n   Instruksi: "${r.task_note}"\n\n`;
            });
            return await msg.reply(replyMsg.trim());
        }

        if (text === '!status dosen' || text === '!status') {
            const { data: schedules } = await supabase.from('master_schedules').select('*').order('id');
            let replyMsg = '*[STATUS KEHADIRAN DOSEN]*\n\n';
            (schedules || []).forEach((s, idx) => {
                const status = s.is_hadir ? `Hadir (${s.attendance_count || 0}/34 Mhs)` : 'Belum Konfirmasi';
                replyMsg += `${idx + 1}. *${s.course}*\n   Status: ${status}\n\n`;
            });
            return await msg.reply(replyMsg.trim());
        }
    } catch (err) {
        console.error('Error saat memproses pesan masuk:', err.message);
    }
});

// =================================================================
// 5. AUTO-TALLY POLLING DARI WHATSAPP KE DATABASE (PRESISI & KUORUM)
// =================================================================
client.on('vote_update', async (vote) => {
    try {
        const targetPollId = vote?.parentMessage?.id?._serialized;
        const voterId = vote?.voter;
        if (!targetPollId || !voterId) return;

        const { data: reqData } = await supabase
            .from('requests')
            .select('*')
            .eq('poll_message_id', targetPollId)
            .single();

        if (!reqData || !reqData.opt1) return;

        if (!pollVoterChoices.has(targetPollId)) {
            pollVoterChoices.set(targetPollId, new Map());
        }
        const voterMap = pollVoterChoices.get(targetPollId);
        const prevChoice = voterMap.get(voterId) || null;

        let newChoice = null;
        if (vote.selectedOptions && vote.selectedOptions.length > 0) {
            const chosenText = vote.selectedOptions[0].name.toLowerCase().trim();
            const opt1Prefix = `${(reqData.opt1.day || '').toLowerCase()}, ${(reqData.opt1.time || '').toLowerCase()}`;
            const opt2Prefix = (reqData.has_opt2 && reqData.opt2)
                ? `${(reqData.opt2.day || '').toLowerCase()}, ${(reqData.opt2.time || '').toLowerCase()}`
                : null;

            if (opt1Prefix && chosenText.startsWith(opt1Prefix)) {
                newChoice = 'opt1';
            } else if (opt2Prefix && chosenText.startsWith(opt2Prefix)) {
                newChoice = 'opt2';
            } else if (chosenText.includes('kendala') || chosenText.includes('bentrok')) {
                newChoice = 'reject';
            }
        }

        if (prevChoice === newChoice) return;

        const newVotes = { ...(reqData.votes || { opt1: 0, opt2: 0, reject: 0 }) };

        if (prevChoice && newVotes[prevChoice] > 0) {
            newVotes[prevChoice] = Math.max(0, newVotes[prevChoice] - 1);
        }

        let justReachedQuorum = false;
        if (newChoice) {
            const beforeCount = newVotes[newChoice] || 0;
            newVotes[newChoice] = beforeCount + 1;
            voterMap.set(voterId, newChoice);
            if (beforeCount < QUORUM_THRESHOLD && newVotes[newChoice] === QUORUM_THRESHOLD) {
                justReachedQuorum = true;
            }
        } else {
            voterMap.delete(voterId);
        }

        await supabase.from('requests').update({ votes: newVotes }).eq('id', reqData.id);

        if (justReachedQuorum && isClientReady) {
            const { data: schedules } = await supabase.from('master_schedules').select('*');
            const course = (schedules || []).find(s => s.id === reqData.schedule_id);
            const label = newChoice === 'opt1'
                ? `Opsi 1 (${reqData.opt1.day}, ${reqData.opt1.time})`
                : (newChoice === 'opt2' ? `Opsi 2 (${reqData.opt2?.day}, ${reqData.opt2?.time})` : 'Kendala / Bentrok');

            const quorumText = `*[KUORUM VOTING TERCAPAI 50%+1]*\n\n` +
                `Mata Kuliah: *${course ? course.course : 'Kelas 2025C'}*\n` +
                `Pilihan *${label}* telah mencapai *${QUORUM_THRESHOLD}/34 suara*.\n\n` +
                `PJ Mata Kuliah sudah dapat mengunci keputusan jadwal melalui Dashboard PJ PantauDos.`;

            await client.sendMessage(TARGET_GROUP_ID, quorumText);
        }
    } catch (err) {
        console.error('Error auto-tally vote:', err.message);
    }
});

// =================================================================
// 6. ENDPOINT API PENGIRIMAN & STATUS DARI WEB UI
// =================================================================
app.get('/status', (req, res) => {
    res.json({ success: true, ready: isClientReady });
});

app.post('/send-message', async (req, res) => {
    try {
        const { target_id, message } = req.body;
        if (!target_id || !message) {
            return res.status(400).json({ success: false, error: 'Data tidak lengkap' });
        }
        if (!isClientReady) {
            return res.status(503).json({ success: false, error: 'Bot WhatsApp sedang belum siap / terputus' });
        }

        await client.sendMessage(target_id, message);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ [WA ERROR] Gagal mengirim pesan:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/send-poll', async (req, res) => {
    try {
        const { target_id, title, options, id_matkul } = req.body;
        if (!target_id || !title || !options || options.length < 2 || !id_matkul) {
            return res.status(400).json({ success: false, error: 'Data polling tidak lengkap!' });
        }
        if (!isClientReady) {
            return res.status(503).json({ success: false, error: 'Bot WhatsApp sedang belum siap / terputus' });
        }

        const pollMessage = new Poll(title, options, { allowMultipleAnswers: false });
        const sentPoll = await client.sendMessage(target_id, pollMessage);
        const pollId = sentPoll?.id?._serialized;

        if (pollId) {
            await supabase
                .from('requests')
                .update({ poll_message_id: pollId })
                .eq('schedule_id', id_matkul);
            return res.json({ success: true, message: 'Polling WA berhasil dikirim', poll_id: pollId });
        }

        res.json({ success: true, message: 'Polling terkirim tanpa tracking ID' });
    } catch (error) {
        console.error('❌ [GAGAL POLLING] Error mengirim polling:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================================================================
// 7. INISIALISASI PORT DINAMIS (RENDER/CLOUD)
// =================================================================
const PORT = process.env.PORT || 3000; // UDAH DIUBAH DINAMIS
app.listen(PORT, () => {
    console.log(`🚀 Server API WA berjalan di port ${PORT}`);
});

client.initialize();