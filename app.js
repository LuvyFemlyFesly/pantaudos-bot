// app.js
tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
            colors: {
                brand: {
                    navy: '#111622',
                    royal: '#2563EB',
                    royalHover: '#1D4ED8',
                    amber: '#F59E0B',
                    green: '#10B981',
                    neon: '#86EFAC',
                    red: '#EF4444'
                }
            }
        }
    }
};

const SUPABASE_URL = 'https://nkkaqrbolzsvuecxwxql.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CkSko1s38RVWDD5-ZTtiwQ_Wt5XIQL3';
const WA_BOT_BASE_URL = 'https://bot.pantaudos.app';
const TARGET_WA_GROUP_ID = '120363412150102602@g.us';
const QUORUM_THRESHOLD = 18; // 50% + 1 dari 34 Mahasiswa

const DEFAULT_HOLIDAYS_2026 = {
    '2026-01-01': 'Tahun Baru 2026 Masehi',
    '2026-01-16': 'Isra Mikraj Nabi Muhammad SAW',
    '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
    '2026-03-19': 'Hari Suci Nyepi Tahun Baru Saka 1948',
    '2026-03-20': 'Hari Raya Idul Fitri 1447 H',
    '2026-03-21': 'Hari Raya Idul Fitri 1447 H',
    '2026-04-03': 'Wafat Yesus Kristus',
    '2026-04-05': 'Kebangkitan Yesus Kristus (Paskah)',
    '2026-05-01': 'Hari Buruh Internasional',
    '2026-05-14': 'Kenaikan Yesus Kristus',
    '2026-05-27': 'Hari Raya Idul Adha 1447 H',
    '2026-05-31': 'Hari Raya Waisak 2570 BE',
    '2026-06-01': 'Hari Lahir Pancasila',
    '2026-06-16': 'Tahun Baru Islam 1448 H',
    '2026-08-17': 'Hari Kemerdekaan Republik Indonesia',
    '2026-08-25': 'Maulid Nabi Muhammad SAW',
    '2026-12-25': 'Hari Raya Natal'
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.pantaudos = function () {
    return {
        role: null,
        currentUserEmail: null,
        currentUserTargetDosen: null,
        currentUserTargetMatkul: null,
        userAvatarUrl: null,
        loginData: { email: '', password: '' },
        isLoggingIn: false,
        authError: '',

        activeMenu: 'dashboard',
        scheduleView: 'master',
        searchQuery: '',
        isSidebarOpen: false,
        isBotOnline: false,
        currentTimeTick: Date.now(),

        masterSchedules: [
            { id: 1, day: 'Senin', time: '07:00 - 09:30', course: 'Pemrograman Basis Data', sks: 3, dosen: 'Cendra Devayana Putra', room: 'A10.01.13', is_hadir: false, attendance_count: 0 },
            { id: 2, day: 'Senin', time: '13:00 - 15:30', course: 'Perencanaan Sumber Daya Perusahaan', sks: 3, dosen: 'Ghea Sekar Palupi', room: 'A10.01.13', is_hadir: false, attendance_count: 0 },
            { id: 3, day: 'Selasa', time: '07:00 - 09:30', course: 'Manajemen Proses Bisnis', sks: 3, dosen: 'Berlian Maulidya Izzati', room: 'A10.01.14', is_hadir: false, attendance_count: 0 },
            { id: 4, day: 'Selasa', time: '09:30 - 12:00', course: 'Transformasi Digital', sks: 3, dosen: 'Anggraeni Widya Purwita', room: 'A10.01.13', is_hadir: false, attendance_count: 0 },
            { id: 5, day: 'Selasa', time: '13:00 - 15:30', course: 'Analisis dan Perancangan Sistem Informasi', sks: 3, dosen: 'Ardhini Warih Utami', room: 'A10.01.13', is_hadir: false, attendance_count: 0 },
            { id: 6, day: 'Rabu', time: '07:00 - 09:30', course: 'Pemrograman Web', sks: 3, dosen: 'Monica Cinthya', room: 'A10.03.01 LAB JARINGAN', is_hadir: false, attendance_count: 0 },
            { id: 7, day: 'Rabu', time: '15:30 - 18:00', course: 'Keamanan Jaringan dan Sistem Informasi', sks: 3, dosen: 'Khoirul Islam', room: 'A10.03.01 LAB', is_hadir: false, attendance_count: 0 }
        ],
        agendas: [],
        requests: [],
        waLogs: [],
        completedTasks: [],
        hasUserVoted: {},
        attendedClasses: {},
        announcements: [],
        newAnnouncementText: '',
        holidaysMap: { ...DEFAULT_HOLIDAYS_2026 },

        newAgenda: { title: '', time: '' },
        pjInputGmeet: {},
        waToasts: [],

        isModalAjukanOpen: false,
        isModalRejectOpen: false,
        isLogoutModalOpen: false,
        isProfileOpen: false,
        isUploadingAvatar: false,
        newPassword: '',
        isChangingPassword: false,
        isLoadingData: false,
        pendingReload: false,
        realtimeChannel: null,

        selectedClass: null,
        selectedReqId: null,
        rejectReason: '',
        formReq: {
            type: 'reschedule',
            opt1: { date: '', day: '', time: '', isOnline: 'false' },
            opt2: { date: '', day: '', time: '', isOnline: 'false' },
            askPjForGmeet: false,
            gmeetLink: '',
            taskNote: ''
        },

        async init() {
            this.loadLocalStorageStates();
            await Promise.all([
                this.loadAllData(),
                this.checkCurrentSession(),
                this.checkBotStatus(),
                this.fetchNationalHolidays()
            ]);
            this.listenToRealtimeChanges();
            setInterval(() => {
                this.checkBotStatus();
                this.currentTimeTick = Date.now();
            }, 15000);
        },

        loadLocalStorageStates() {
            try {
                this.completedTasks = JSON.parse(localStorage.getItem('pd_done_tasks')) || [];
                this.hasUserVoted = JSON.parse(localStorage.getItem('pd_has_voted')) || {};
                this.attendedClasses = JSON.parse(localStorage.getItem('pd_attended_classes')) || {};
            } catch (e) {
                this.completedTasks = [];
                this.hasUserVoted = {};
                this.attendedClasses = {};
            }
        },

        async checkBotStatus() {
            try {
                const res = await fetch(`${WA_BOT_BASE_URL}/status`);
                const data = await res.json();
                this.isBotOnline = Boolean(res.ok && data.ready);
            } catch (e) {
                this.isBotOnline = false;
            }
        },

        async fetchNationalHolidays() {
            try {
                const year = new Date().getFullYear();
                const res = await fetch(`https://api-harilibur.vercel.app/api?year=${year}`);
                if (!res.ok) return;
                const data = await res.json();
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        if (item.is_national_holiday && item.holiday_date) {
                            const formattedDate = item.holiday_date.split('-').map(p => p.padStart(2, '0')).join('-');
                            this.holidaysMap[formattedDate] = item.holiday_name;
                        }
                    });
                }
            } catch (e) {
                // Fallback menggunakan DEFAULT_HOLIDAYS_2026
            }
        },

        async checkCurrentSession() {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session?.user?.email) {
                    const { data: roleData } = await supabaseClient
                        .from('user_roles')
                        .select('role, target_dosen, target_matkul, avatar_url')
                        .eq('email', session.user.email)
                        .single();

                    if (roleData) {
                        this.role = roleData.role;
                        this.currentUserEmail = session.user.email;
                        this.currentUserTargetDosen = roleData.target_dosen || '';
                        this.currentUserTargetMatkul = roleData.target_matkul || '';
                        this.userAvatarUrl = roleData.avatar_url || null;
                    }
                }
            } catch (err) {
                console.error('Gagal verifikasi sesi login:', err);
            }
        },

        async loadAllData() {
            if (this.isLoadingData) {
                this.pendingReload = true;
                return;
            }
            this.isLoadingData = true;

            try {
                const [schedulesRes, reqsRes, agndsRes, logsRes, annsRes] = await Promise.all([
                    supabaseClient.from('master_schedules').select('*').order('id'),
                    supabaseClient.from('requests').select('*').order('id', { ascending: false }),
                    supabaseClient.from('agendas').select('*').order('id'),
                    supabaseClient.from('wa_logs').select('*').order('id', { ascending: false }),
                    supabaseClient.from('announcements').select('*').order('id', { ascending: false })
                ]);

                if (schedulesRes.data?.length > 0) {
                    this.masterSchedules = schedulesRes.data.map(s => ({
                        ...s,
                        isHadir: Boolean(s.is_hadir),
                        attendanceCount: s.attendance_count || 0
                    }));

                    let updatedAttended = false;
                    this.masterSchedules.forEach(s => {
                        if ((!s.isHadir || s.attendanceCount === 0) && this.attendedClasses[s.id]) {
                            delete this.attendedClasses[s.id];
                            updatedAttended = true;
                        }
                    });
                    if (updatedAttended) {
                        localStorage.setItem('pd_attended_classes', JSON.stringify(this.attendedClasses));
                    }
                }

                if (reqsRes.data) {
                    this.requests = reqsRes.data.map(r => ({
                        ...r,
                        scheduleId: r.schedule_id,
                        datePosted: r.date_posted,
                        hasOpt2: Boolean(r.has_opt2),
                        autoFallback: Boolean(r.auto_fallback),
                        taskNote: r.task_note,
                        selectedOption: r.selected_option,
                        askPjForGmeet: Boolean(r.ask_pj_for_gmeet),
                        gmeetLink: r.gmeet_link,
                        rejectReason: r.reject_reason
                    }));
                }

                if (agndsRes.data) this.agendas = agndsRes.data;
                if (logsRes.data) this.waLogs = logsRes.data;
                if (annsRes.data) this.announcements = annsRes.data;
            } catch (err) {
                console.error('Gagal memuat data dari Supabase:', err);
            } finally {
                this.isLoadingData = false;
                if (this.pendingReload) {
                    this.pendingReload = false;
                    this.loadAllData();
                }
            }
        },

        listenToRealtimeChanges() {
            if (this.realtimeChannel) {
                supabaseClient.removeChannel(this.realtimeChannel);
            }

            this.realtimeChannel = supabaseClient
                .channel('custom-all-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => this.loadAllData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'master_schedules' }, () => this.loadAllData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'agendas' }, () => this.loadAllData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_logs' }, () => this.loadAllData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => this.loadAllData())
                .subscribe();
        },

        async loginWithEmail() {
            this.isLoggingIn = true;
            this.authError = '';
            const cleanEmail = this.loginData.email.trim();

            try {
                const { error: authErr } = await supabaseClient.auth.signInWithPassword({
                    email: cleanEmail,
                    password: this.loginData.password
                });
                if (authErr) throw authErr;

                const { data: roleData, error: roleErr } = await supabaseClient
                    .from('user_roles')
                    .select('role, target_dosen, target_matkul, avatar_url')
                    .eq('email', cleanEmail)
                    .single();

                if (roleErr || !roleData) {
                    await supabaseClient.auth.signOut();
                    throw new Error('Akses ditolak. Email tidak terdaftar dalam database kelas 2025C.');
                }

                this.role = roleData.role;
                this.currentUserEmail = cleanEmail;
                this.currentUserTargetDosen = roleData.target_dosen || '';
                this.currentUserTargetMatkul = roleData.target_matkul || '';
                this.userAvatarUrl = roleData.avatar_url || null;
                this.activeMenu = 'dashboard';
                this.loginData.email = '';
                this.loginData.password = '';
            } catch (err) {
                this.authError = err.message || 'Email atau password salah!';
            } finally {
                this.isLoggingIn = false;
            }
        },

        triggerLogout() {
            this.isLogoutModalOpen = true;
            this.isProfileOpen = false;
            this.isSidebarOpen = false;
        },

        async confirmLogout() {
            try {
                await supabaseClient.auth.signOut();
            } catch (e) {
                console.error('Logout error:', e);
            }
            this.isLogoutModalOpen = false;
            this.role = null;
            this.currentUserEmail = null;
            this.currentUserTargetDosen = null;
            this.currentUserTargetMatkul = null;
            this.userAvatarUrl = null;
        },

        getAvatar() {
            if (this.userAvatarUrl) return this.userAvatarUrl;
            const name = encodeURIComponent(this.getUserName());
            return `https://ui-avatars.com/api/?name=${name}&background=1e293b&color=fff&bold=true`;
        },

        async uploadAvatar(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                alert('Ukuran gambar maksimal 2MB!');
                return;
            }

            this.isUploadingAvatar = true;
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${this.currentUserEmail.split('@')[0]}-${Date.now()}.${fileExt}`;

                const { error: uploadErr } = await supabaseClient.storage
                    .from('avatars')
                    .upload(fileName, file, { cacheControl: '3600', upsert: true });
                if (uploadErr) throw uploadErr;

                const { data: { publicUrl } } = supabaseClient.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                const { error: updateErr } = await supabaseClient
                    .from('user_roles')
                    .update({ avatar_url: publicUrl })
                    .eq('email', this.currentUserEmail);
                if (updateErr) throw updateErr;

                this.userAvatarUrl = publicUrl;
                this.triggerWaNotification('Sistem Internal', 'Foto profil berhasil diperbarui secara permanen.');
            } catch (err) {
                alert('Gagal mengunggah foto: ' + err.message);
            } finally {
                this.isUploadingAvatar = false;
            }
        },

        async updatePassword() {
            if (this.newPassword.length < 6) {
                alert('Kata sandi minimal 6 karakter.');
                return;
            }

            this.isChangingPassword = true;
            try {
                const { error } = await supabaseClient.auth.updateUser({ password: this.newPassword });
                if (error) throw error;
                alert('Kata sandi berhasil diubah! Anda akan menggunakan sandi ini pada login berikutnya.');
                this.newPassword = '';
            } catch (err) {
                alert('Gagal mengubah kata sandi: ' + err.message);
            } finally {
                this.isChangingPassword = false;
            }
        },

        get remainingTasksCount() {
            return this.getAsyncCourses().filter(t => !this.isTaskDone(t.taskKey)).length;
        },

        get completedTasksCount() {
            return this.getAsyncCourses().filter(t => this.isTaskDone(t.taskKey)).length;
        },

        getUserName() {
            if (this.role === 'dosen') return this.currentUserTargetDosen || 'Dosen Pengampu';
            if (this.role === 'pj') return `PJ: ${this.currentUserTargetMatkul || 'Kelas'}`;
            if (this.role === 'mhs') return this.currentUserEmail ? `Mahasiswa (${this.currentUserEmail.split('@')[0]})` : 'Anggota Kelas';
            return 'Pengguna PantauDos';
        },

        isMyCourse(dosenName) {
            if (!dosenName) return false;
            if (this.role === 'dosen') {
                if (!this.currentUserTargetDosen) return false;
                const d1 = dosenName.toLowerCase().trim();
                const d2 = this.currentUserTargetDosen.toLowerCase().trim();
                return d1 === d2 || d1.includes(d2) || d2.includes(d1);
            }
            return true;
        },

        getCourse(id) {
            return this.masterSchedules.find(s => s.id == id) || {
                id: id,
                course: 'Mata Kuliah',
                dosen: 'Dosen',
                sks: 3,
                room: '-'
            };
        },

        matchesSearch(item) {
            if (!this.searchQuery || !this.searchQuery.trim()) return true;
            const q = this.searchQuery.toLowerCase().trim();
            return (
                item.course?.toLowerCase().includes(q) ||
                item.dosen?.toLowerCase().includes(q) ||
                item.room?.toLowerCase().includes(q) ||
                item.day?.toLowerCase().includes(q)
            );
        },

        get liveSearchResults() {
            if (!this.searchQuery || this.searchQuery.trim().length < 2) return [];
            return this.mergedSchedules.filter(item => this.matchesSearch(item));
        },

        async triggerWaNotification(targetName, message) {
            const now = new Date();
            const timeStr = now.toTimeString().slice(0, 5) + ' WIB';
            const isLocal = targetName === 'Sistem Internal' || targetName === 'Clipboard Sistem';

            if (!isLocal) {
                await supabaseClient.from('wa_logs').insert([{
                    id: Date.now(),
                    target: targetName,
                    time: timeStr,
                    message: message
                }]);
                this.loadAllData();
            }

            const logItem = { id: Date.now() + Math.random(), target: targetName, time: timeStr, message };
            this.waToasts.push(logItem);
            setTimeout(() => this.dismissToast(logItem.id), 5500);

            if (TARGET_WA_GROUP_ID && !isLocal) {
                try {
                    await fetch(`${WA_BOT_BASE_URL}/send-message`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ target_id: TARGET_WA_GROUP_ID, message: message })
                    });
                } catch (e) {
                    console.error('Gagal integrasi WA:', e);
                }
            }
        },

        dismissToast(id) {
            this.waToasts = this.waToasts.filter(t => t.id !== id);
        },

        copyText(text, alertMsg) {
            navigator.clipboard.writeText(text);
            this.triggerWaNotification('Clipboard Sistem', alertMsg || 'Teks berhasil disalin.');
        },

        async postAnnouncement() {
            if (!this.newAnnouncementText.trim()) {
                alert('Isi pengumuman terlebih dahulu.');
                return;
            }

            let sender = 'Sistem';
            if (this.role === 'pj') {
                sender = `PJ ${this.currentUserTargetMatkul || 'Kelas'}`;
            } else if (this.role === 'dosen') {
                const foundCourse = this.masterSchedules.find(s => this.isMyCourse(s.dosen));
                sender = `Dosen ${foundCourse ? foundCourse.course : 'Pengampu'}`;
            }

            await supabaseClient.from('announcements').insert([{
                id: Date.now(),
                message: this.newAnnouncementText.trim(),
                sender: sender,
                timestamp: new Date().toLocaleDateString('id-ID')
            }]);

            this.triggerWaNotification(
                'Grup WA Kelas S1 SI 2025 C',
                `[PENGUMUMAN PENTING]\nDari: ${sender}\n\n${this.newAnnouncementText.trim()}`
            );

            this.newAnnouncementText = '';
            await this.loadAllData();
        },

        async deleteAnnouncement(id) {
            await supabaseClient.from('announcements').delete().eq('id', id);
            await this.loadAllData();
        },

        openAjukanModal(item) {
            this.selectedClass = item;
            this.formReq = {
                type: 'reschedule',
                opt1: { date: '', day: '', time: '', isOnline: 'false' },
                opt2: { date: '', day: '', time: '', isOnline: 'false' },
                askPjForGmeet: false,
                gmeetLink: '',
                taskNote: ''
            };
            this.isModalAjukanOpen = true;
        },

        // ==========================================
        // FITUR BARU: SMART FREE-SLOT RECOMMENDER & SKS GUARD
        // ==========================================
        getDailySksLoad(targetDay, excludeClassId = null) {
            if (!targetDay) return 0;
            let totalSks = 0;
            this.mergedSchedules.forEach(item => {
                if (excludeClassId && item.id === excludeClassId) return;
                if (item.isAsyncTask) return;
                const activeDay = item.isRescheduled ? item.actualDay : item.day;
                if (activeDay === targetDay) {
                    totalSks += (item.sks || 3);
                }
            });
            return totalSks;
        },

        getSksOverloadWarning(targetDay) {
            if (!targetDay || !this.selectedClass) return null;
            const existingSks = this.getDailySksLoad(targetDay, this.selectedClass.id);
            const projectedSks = existingSks + (this.selectedClass.sks || 3);
            if (projectedSks >= 12) {
                return `Peringatan Beban SKS: Hari ${targetDay} sudah memiliki ${existingSks} SKS aktif. Menambah kelas ini membuat beban mahasiswa menjadi ${projectedSks} SKS dalam sehari.`;
            }
            return null;
        },

        get recommendedFreeSlots() {
            if (!this.selectedClass) return [];
            const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
            const candidateStarts = ['07:00', '09:30', '13:00', '15:30'];
            const sks = this.selectedClass.sks || 3;
            const recommendations = [];

            days.forEach(day => {
                const currentDaySks = this.getDailySksLoad(day, this.selectedClass.id);
                if (currentDaySks + sks > 9) return; // Prioritaskan hari yang tidak overload (< 12 SKS)

                candidateStarts.forEach(startTime => {
                    if (day === this.selectedClass.day && this.selectedClass.time.startsWith(startTime)) return;
                    const conflict = this.checkConflict(day, startTime, this.selectedClass.id);
                    if (!conflict) {
                        recommendations.push({
                            day,
                            startTime,
                            label: `${day}, ${this.formatTimeWithSks(startTime, sks)}`,
                            currentDaySks
                        });
                    }
                });
            });

            // Urutkan dari hari dengan beban SKS paling ringan
            return recommendations.sort((a, b) => a.currentDaySks - b.currentDaySks).slice(0, 6);
        },

        applyRecommendedSlot(slot) {
            if (!slot) return;
            if (!this.formReq.opt1.day || !this.formReq.opt1.time) {
                this.formReq.opt1.day = slot.day;
                this.formReq.opt1.time = slot.startTime;
            } else {
                this.formReq.opt2.day = slot.day;
                this.formReq.opt2.time = slot.startTime;
            }
        },

        // ==========================================
        // FITUR BARU: INDIKATOR LIVE & GOOGLE CALENDAR
        // ==========================================
        isClassOngoing(item, dayName) {
            if (!item || item.isMovedAway || item.isAsyncTask) return false;
            const _tick = this.currentTimeTick; // Reactive dependency
            const now = new Date();
            const hariMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const todayName = hariMap[now.getDay()];
            if (todayName !== dayName) return false;

            const timeRange = this.parseTimeRangeToMinutes(item.displayTime || item.time, (item.sks || 3) * 50);
            if (!timeRange) return false;

            const nowMins = now.getHours() * 60 + now.getMinutes();
            return nowMins >= timeRange.start && nowMins <= timeRange.end;
        },

        getGoogleCalendarUrl(item) {
            if (!item) return '#';
            const dayMap = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 0 };
            const targetDayName = item.isRescheduled ? item.actualDay : item.day;
            const targetTimeStr = item.isRescheduled ? item.actualTime : item.time;
            const targetDow = dayMap[targetDayName] ?? 1;

            const now = new Date();
            const resultDate = new Date(now);
            const diff = (targetDow + 7 - now.getDay()) % 7;
            resultDate.setDate(now.getDate() + diff);

            const range = this.parseTimeRangeToMinutes(targetTimeStr, (item.sks || 3) * 50) || { start: 420, end: 570 };
            const pad = (n) => String(n).padStart(2, '0');
            const yyyy = resultDate.getFullYear();
            const mm = pad(resultDate.getMonth() + 1);
            const dd = pad(resultDate.getDate());

            const startH = pad(Math.floor(range.start / 60));
            const startM = pad(range.start % 60);
            const endH = pad(Math.floor(range.end / 60));
            const endM = pad(range.end % 60);

            const dates = `${yyyy}${mm}${dd}T${startH}${startM}00/${yyyy}${mm}${dd}T${endH}${endM}00`;
            const title = encodeURIComponent(`[Kuliah 2025C] ${item.course}`);
            const location = encodeURIComponent(item.actualOnline ? (item.gmeetLink || 'Google Meet (Online)') : `Ruang ${item.room} UNESA`);
            const details = encodeURIComponent(`Dosen Pengampu: ${item.dosen}\nStatus: ${item.isRescheduled ? 'Jadwal Pengganti' : 'Jadwal Reguler'}`);

            return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
        },

        // ==========================================
        // DETEKTOR TANGGAL MERAH & KALKULATOR SKS
        // ==========================================
        onDatePick(optKey) {
            const dateStr = this.formReq[optKey]?.date;
            if (!dateStr) return;

            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const pickedDay = dayNames[dateObj.getDay()];

            if (pickedDay === 'Sabtu' || pickedDay === 'Minggu') {
                this.formReq[optKey].day = '';
            } else {
                this.formReq[optKey].day = pickedDay;
            }
        },

        getHolidayWarning(dateStr) {
            if (!dateStr) return null;
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayIndex = dateObj.getDay();

            if (dayIndex === 0 || dayIndex === 6) {
                return 'Tanggal yang dipilih jatuh pada Akhir Pekan (Sabtu/Minggu). Perkuliahan reguler diliburkan.';
            }
            if (this.holidaysMap[dateStr]) {
                return `Tanggal Merah / Libur Nasional: ${this.holidaysMap[dateStr]}.`;
            }
            return null;
        },

        formatTimeWithSks(startTimeStr, sks = 3) {
            if (!startTimeStr) return '';
            if (startTimeStr.includes('-')) return startTimeStr;
            const match = startTimeStr.match(/(\d{2}):(\d{2})/);
            if (!match) return startTimeStr;

            const startMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
            const endMins = startMins + (sks * 50);
            const endH = String(Math.floor(endMins / 60) % 24).padStart(2, '0');
            const endM = String(endMins % 60).padStart(2, '0');
            return `${match[1]}:${match[2]} - ${endH}:${endM} WIB`;
        },

        getFormattedEndTimePreview(timeStr) {
            if (!timeStr) return '';
            const sks = this.selectedClass?.sks || 3;
            return `Estimasi (${sks} SKS): ${this.formatTimeWithSks(timeStr, sks)}`;
        },

        parseTimeRangeToMinutes(timeStr, defaultDurationMins = 150) {
            if (!timeStr) return null;
            const rangeMatch = timeStr.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1], 10) * 60 + parseInt(rangeMatch[2], 10);
                const end = parseInt(rangeMatch[3], 10) * 60 + parseInt(rangeMatch[4], 10);
                return { start, end };
            }
            const singleMatch = timeStr.match(/(\d{2}):(\d{2})/);
            if (singleMatch) {
                const start = parseInt(singleMatch[1], 10) * 60 + parseInt(singleMatch[2], 10);
                return { start, end: start + defaultDurationMins };
            }
            return null;
        },

        checkConflict(reqDay, reqTime, currentClassId) {
            if (!reqDay || !reqTime) return null;

            const currentCourse = this.getCourse(currentClassId);
            const durationMins = (currentCourse?.sks || 3) * 50;
            const proposedRange = this.parseTimeRangeToMinutes(reqTime, durationMins);
            if (!proposedRange) return null;

            for (const item of this.mergedSchedules) {
                if (item.id === currentClassId) continue;
                if (item.isAsyncTask || item.isMovedAway) continue;

                const itemDay = item.isRescheduled ? item.actualDay : item.day;
                const itemTimeStr = item.isRescheduled ? item.actualTime : item.time;

                if (itemDay === reqDay) {
                    const existingDuration = (item.sks || 3) * 50;
                    const existingRange = this.parseTimeRangeToMinutes(itemTimeStr, existingDuration);
                    if (existingRange) {
                        if (proposedRange.start < existingRange.end && proposedRange.end > existingRange.start) {
                            return {
                                ...item,
                                conflictDay: itemDay,
                                conflictTime: itemTimeStr
                            };
                        }
                    }
                }
            }
            return null;
        },

        async submitRequest() {
            if (!this.selectedClass) return;

            const isTask = this.formReq.type === 'task';
            if (!isTask && (!this.formReq.opt1.day || !this.formReq.opt1.time)) {
                alert('Harap tentukan Hari dan Jam Mulai pada Opsi Jadwal Pertama.');
                return;
            }
            if (isTask && !this.formReq.taskNote.trim()) {
                alert('Silakan cantumkan instruksi pengerjaan tugas mandiri.');
                return;
            }

            const hasOpt2 = !isTask && Boolean(this.formReq.opt2.day && this.formReq.opt2.time);

            if (!isTask) {
                const warn1 = this.getHolidayWarning(this.formReq.opt1.date);
                if (warn1) {
                    const proceed1 = confirm(`PERINGATAN KALENDER AKADEMIK (OPSI 1):\n${warn1}\n\nApakah Anda yakin tetap ingin mengajukan jadwal ini?`);
                    if (!proceed1) return;
                }

                if (hasOpt2) {
                    const warn2 = this.getHolidayWarning(this.formReq.opt2.date);
                    if (warn2) {
                        const proceed2 = confirm(`PERINGATAN KALENDER AKADEMIK (OPSI 2):\n${warn2}\n\nApakah Anda yakin tetap ingin mengajukan jadwal ini?`);
                        if (!proceed2) return;
                    }
                }

                const conflict1 = this.checkConflict(this.formReq.opt1.day, this.formReq.opt1.time, this.selectedClass.id);
                if (conflict1) {
                    alert(`BENTROK JADWAL!\nOpsi 1 bertabrakan dengan mata kuliah:\n${conflict1.course} (${conflict1.dosen})\nHari ${conflict1.conflictDay} pukul ${conflict1.conflictTime}`);
                    return;
                }
                if (hasOpt2) {
                    const conflict2 = this.checkConflict(this.formReq.opt2.day, this.formReq.opt2.time, this.selectedClass.id);
                    if (conflict2) {
                        alert(`BENTROK JADWAL!\nOpsi 2 bertabrakan dengan mata kuliah:\n${conflict2.course} (${conflict2.dosen})\nHari ${conflict2.conflictDay} pukul ${conflict2.conflictTime}`);
                        return;
                    }
                }
            }

            const sks = this.selectedClass.sks || 3;
            const formattedTime1 = !isTask ? this.formatTimeWithSks(this.formReq.opt1.time, sks) : '';
            const formattedTime2 = (!isTask && hasOpt2) ? this.formatTimeWithSks(this.formReq.opt2.time, sks) : '';

            const newReqId = Date.now();
            const payload = {
                id: newReqId,
                schedule_id: this.selectedClass.id,
                status: isTask ? 'async_task' : 'pending',
                date_posted: 'Baru saja',
                has_opt2: hasOpt2,
                auto_fallback: false,
                selected_option: null,
                reject_reason: null,
                votes: { opt1: 0, opt2: 0, reject: 0 },
                task_note: isTask ? this.formReq.taskNote.trim() : null,
                opt1: !isTask ? {
                    day: this.formReq.opt1.day,
                    time: formattedTime1,
                    date: this.formReq.opt1.date || null,
                    isOnline: this.formReq.opt1.isOnline === 'true' || this.formReq.opt1.isOnline === true
                } : null,
                opt2: (!isTask && hasOpt2) ? {
                    day: this.formReq.opt2.day,
                    time: formattedTime2,
                    date: this.formReq.opt2.date || null,
                    isOnline: this.formReq.opt2.isOnline === 'true' || this.formReq.opt2.isOnline === true
                } : null,
                ask_pj_for_gmeet: !isTask ? Boolean(this.formReq.askPjForGmeet) : false,
                gmeet_link: !isTask ? (this.formReq.askPjForGmeet ? '' : this.formReq.gmeetLink.trim()) : null
            };

            const existing = this.requests.find(r => (r.schedule_id || r.scheduleId) == this.selectedClass.id);
            if (existing) {
                await supabaseClient.from('requests').delete().eq('id', existing.id);
            }

            const { error: insertErr } = await supabaseClient.from('requests').insert([payload]);
            if (insertErr) {
                alert('Gagal menyimpan pengajuan: ' + insertErr.message);
                return;
            }

            await supabaseClient.from('master_schedules').update({ is_hadir: false, attendance_count: 0 }).eq('id', this.selectedClass.id);

            if (isTask) {
                this.triggerWaNotification(
                    'Grup WA Kelas S1 SI 2025 C',
                    `[PENGALIHAN TUGAS]\nMata Kuliah: ${this.selectedClass.course}\nInstruksi: ${this.formReq.taskNote.trim()}`
                );
            } else {
                const titlePoll = `[POLLING JADWAL PENGGANTI] - ${this.selectedClass.course}`;
                const optionsPoll = [`${payload.opt1.day}, ${payload.opt1.time} (${payload.opt1.isOnline ? 'Online' : 'Offline'})`];
                if (hasOpt2) {
                    optionsPoll.push(`${payload.opt2.day}, ${payload.opt2.time} (${payload.opt2.isOnline ? 'Online' : 'Offline'})`);
                }
                optionsPoll.push('Kendala / Bentrok');

                try {
                    const response = await fetch(`${WA_BOT_BASE_URL}/send-poll`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            target_id: TARGET_WA_GROUP_ID,
                            title: titlePoll,
                            options: optionsPoll,
                            id_matkul: this.selectedClass.id
                        })
                    });
                    const result = await response.json();
                    if (!response.ok || !result.success) throw new Error(result.error || 'Server error');

                    const optText = `${payload.opt1.day}, ${payload.opt1.time}` + (hasOpt2 ? ` / Opsi 2: ${payload.opt2.day}, ${payload.opt2.time}` : '');
                    this.triggerWaNotification(
                        'Grup WA Kelas S1 SI 2025 C',
                        `[PENGUMPULAN JADWAL BARU]\n${this.selectedClass.dosen} mengajukan perubahan jadwal ${this.selectedClass.course}.\nPilihan: ${optText}\n\nMohon lakukan pemilihan melalui antarmuka web atau panel polling.`
                    );
                } catch (e) {
                    console.warn('Bot WA sedang offline, pengajuan tetap tersimpan di web:', e);
                    this.triggerWaNotification(
                        'Sistem Internal',
                        'Pengajuan jadwal berhasil disimpan di web (Bot WA sedang offline).'
                    );
                }
            }

            this.isModalAjukanOpen = false;
            await this.loadAllData();
        },

        // ==========================================
        // FITUR BARU: KEMBALIKAN KE JADWAL REGULER PER MATKUL
        // ==========================================
        async revertToRegularSchedule(scheduleId) {
            const course = this.getCourse(scheduleId);
            if (!confirm(`Kembalikan mata kuliah "${course.course}" ke jadwal patokan reguler (${course.day}, ${course.time})?`)) {
                return;
            }

            await Promise.all([
                supabaseClient.from('requests').delete().eq('schedule_id', scheduleId),
                supabaseClient.from('master_schedules').update({ is_hadir: false, attendance_count: 0 }).eq('id', scheduleId)
            ]);

            this.triggerWaNotification(
                'Grup WA Kelas S1 SI 2025 C',
                `[KEMBALI KE JADWAL REGULER]\nMata kuliah ${course.course} (${course.dosen}) telah dikembalikan ke jadwal patokan reguler: ${course.day}, ${course.time} di ruang ${course.room}.`
            );
            await this.loadAllData();
        },

        async markHadir(id) {
            const mergedItem = this.mergedSchedules.find(s => s.id == id);
            const cls = this.masterSchedules.find(s => s.id == id);
            if (!cls || !mergedItem) return;

            cls.is_hadir = true;
            cls.isHadir = true;
            await supabaseClient.from('master_schedules').update({ is_hadir: true }).eq('id', id);

            const effectiveDay = mergedItem.isRescheduled ? mergedItem.actualDay : mergedItem.day;
            const effectiveTime = mergedItem.isRescheduled ? mergedItem.actualTime : mergedItem.time;
            const effectiveLoc = (mergedItem.isRescheduled && mergedItem.actualOnline) ? 'Daring (Online)' : `ruang ${mergedItem.room}`;

            this.triggerWaNotification(
                'Grup WA Kelas S1 SI 2025 C',
                `[KONFIRMASI KEHADIRAN DOSEN]\n${cls.dosen} telah mengonfirmasi kehadiran untuk kelas ${cls.course} (${effectiveDay}, ${effectiveTime}) di ${effectiveLoc}. Mahasiswa dipersilakan mengisi presensi kehadiran.`
            );
            await this.loadAllData();
        },

        async resetHadir(id) {
            const mergedItem = this.mergedSchedules.find(s => s.id == id);
            const cls = this.masterSchedules.find(s => s.id == id);
            if (!cls || !mergedItem) return;

            cls.is_hadir = false;
            cls.isHadir = false;
            cls.attendance_count = 0;
            cls.attendanceCount = 0;
            await supabaseClient.from('master_schedules').update({ is_hadir: false, attendance_count: 0 }).eq('id', id);

            const effectiveDay = mergedItem.isRescheduled ? mergedItem.actualDay : mergedItem.day;
            const effectiveTime = mergedItem.isRescheduled ? mergedItem.actualTime : mergedItem.time;

            this.triggerWaNotification(
                'Grup WA Kelas S1 SI 2025 C',
                `[PEMBATALAN STATUS KEHADIRAN]\n${cls.dosen} membatalkan konfirmasi kehadiran untuk kelas ${cls.course} (${effectiveDay}, ${effectiveTime}).`
            );
            await this.loadAllData();
        },

        hasStudentAttended(item) {
            if (!item || !item.isHadir || item.attendanceCount === 0) return false;
            return Boolean(this.attendedClasses[item.id]);
        },

        async markStudentPresent(item) {
            if (!item || !item.isHadir) return;
            if (this.hasStudentAttended(item)) {
                alert('Anda sudah tercatat hadir pada sesi perkuliahan ini.');
                return;
            }
            if ((item.attendanceCount || 0) >= 34) {
                alert('Kapasitas presensi kelas (34/34) sudah penuh.');
                return;
            }

            const newCount = Math.min(34, (item.attendanceCount || 0) + 1);
            this.attendedClasses[item.id] = true;
            localStorage.setItem('pd_attended_classes', JSON.stringify(this.attendedClasses));

            await supabaseClient
                .from('master_schedules')
                .update({ attendance_count: newCount })
                .eq('id', item.id);

            this.triggerWaNotification('Sistem Internal', `Presensi berhasil! Kehadiran kelas ${item.course} tercatat (${newCount}/34).`);
            await this.loadAllData();
        },

        getPendingRequests() {
            let pendingList = this.requests.filter(r => r.status === 'pending');
            if (this.role === 'pj' && this.currentUserTargetMatkul) {
                const target = this.currentUserTargetMatkul.toLowerCase().trim();
                pendingList = pendingList.filter(r => {
                    const course = this.getCourse(r.schedule_id || r.scheduleId);
                    const cName = course?.course?.toLowerCase().trim() || '';
                    return cName === target || cName.includes(target);
                });
            }
            return pendingList;
        },

        getApprovedRequestsNeedingGmeet() {
            return this.requests.filter(r => {
                if (r.status !== 'approved') return false;
                if (this.role === 'pj' && this.currentUserTargetMatkul) {
                    const course = this.getCourse(r.schedule_id || r.scheduleId);
                    if (!course || !course.course.toLowerCase().includes(this.currentUserTargetMatkul.toLowerCase())) {
                        return false;
                    }
                }
                const chosenOpt = (r.selectedOption === 1 || r.selected_option === 1) ? r.opt1 : r.opt2;
                const isOnline = chosenOpt && (chosenOpt.isOnline === 'true' || chosenOpt.isOnline === true);
                const ask = r.askPjForGmeet || r.ask_pj_for_gmeet;
                const link = r.gmeetLink || r.gmeet_link;
                return isOnline && ask && !link;
            });
        },

        // ==========================================
        // FITUR BARU: DETEKSI KUORUM VOTING (50% + 1)
        // ==========================================
        hasReachedQuorum(req) {
            if (!req?.votes) return false;
            return (
                (req.votes.opt1 || 0) >= QUORUM_THRESHOLD ||
                ((req.hasOpt2 || req.has_opt2) && (req.votes.opt2 || 0) >= QUORUM_THRESHOLD) ||
                (req.votes.reject || 0) >= QUORUM_THRESHOLD
            );
        },

        getLeadingOptionLabel(req) {
            if (!req?.votes) return '';
            const v1 = req.votes.opt1 || 0;
            const v2 = (req.hasOpt2 || req.has_opt2) ? (req.votes.opt2 || 0) : -1;
            const vr = req.votes.reject || 0;
            if (v1 >= QUORUM_THRESHOLD && v1 >= v2 && v1 >= vr) return 'Opsi 1 Mencapai Kuorum Mayoritas';
            if (v2 >= QUORUM_THRESHOLD && v2 >= v1 && v2 >= vr) return 'Opsi 2 Mencapai Kuorum Mayoritas';
            if (vr >= QUORUM_THRESHOLD) return 'Mayoritas Mahasiswa Menyatakan Bentrok';
            return '';
        },

        async approveOption(reqId, optNumber) {
            const req = this.requests.find(r => r.id == reqId);
            if (!req) return;
            await supabaseClient.from('requests').update({ status: 'approved', selected_option: optNumber }).eq('id', reqId);
            const chosen = optNumber === 1 ? req.opt1 : req.opt2;
            const course = this.getCourse(req.schedule_id || req.scheduleId);
            this.triggerWaNotification(
                'Grup WA Kelas S1 SI 2025 C',
                `[JADWAL SEPAKAT]\nPJ menetapkan Opsi ${optNumber} untuk ${course.course}.\nJadwal baru: ${chosen.day}, ${chosen.time} (${chosen.isOnline ? 'Online' : 'Tatap Muka'}).`
            );
            await this.loadAllData();
        },

        async submitGmeetByPj(reqId) {
            const link = this.pjInputGmeet[reqId];
            if (!link || !link.trim()) {
                alert('Input link Google Meet tidak boleh kosong.');
                return;
            }
            await supabaseClient.from('requests').update({ gmeet_link: link.trim() }).eq('id', reqId);
            const req = this.requests.find(r => r.id == reqId);
            const course = this.getCourse(req.schedule_id || req.scheduleId);
            this.triggerWaNotification(
                'Grup WA Kelas S1 SI 2025 C',
                `[LINK GOOGLE MEET TERSEDIA]\nLink GMeet untuk kelas ${course.course} telah diperbarui oleh PJ kelas:\n${link.trim()}`
            );
            await this.loadAllData();
        },

        openRejectModal(reqId) {
            this.selectedReqId = reqId;
            this.rejectReason = '';
            this.isModalRejectOpen = true;
        },

        async confirmReject() {
            if (!this.rejectReason.trim()) {
                alert('Alasan penolakan wajib dicantumkan.');
                return;
            }
            const req = this.requests.find(r => r.id == this.selectedReqId);
            if (!req) return;
            await supabaseClient.from('requests').update({
                status: 'async_task',
                auto_fallback: true,
                reject_reason: this.rejectReason.trim(),
                task_note: 'Jadwal pengganti tidak dapat diakomodasi. Silakan selesaikan tugas mandiri pekan ini.'
            }).eq('id', req.id);

            const course = this.getCourse(req.schedule_id || req.scheduleId);
            this.triggerWaNotification(
                'Grup WA Kelas S1 SI 2025 C',
                `[PENGALIHAN TUGAS]\nPerubahan jadwal untuk ${course.course} dibatalkan (${this.rejectReason.trim()}). Pembelajaran dialihkan menjadi tugas mandiri.`
            );
            this.isModalRejectOpen = false;
            await this.loadAllData();
        },

        generatePJChat(req) {
            const course = this.getCourse(req.scheduleId || req.schedule_id);
            const total = this.getTotalVotes(req);
            const opt1 = req.opt1 || { day: '-', time: '-' };
            const opt2 = req.opt2 || { day: '-', time: '-' };

            let text = `Selamat Pagi/Siang/Sore Bapak/Ibu ${course.dosen},\n\n`;
            text += `Mohon maaf mengganggu waktunya. Saya Penanggung Jawab (PJ) kelas S1 SI 2025 C untuk mata kuliah ${course.course}.\n\n`;
            text += `Izin melaporkan hasil jajak pendapat (voting) mahasiswa terkait usulan perubahan jadwal:\n`;
            text += `- Opsi 1 (${opt1.day}, ${opt1.time}): ${req.votes?.opt1 || 0} suara\n`;
            if (req.hasOpt2 || req.has_opt2) {
                text += `- Opsi 2 (${opt2.day}, ${opt2.time}): ${req.votes?.opt2 || 0} suara\n`;
            }
            text += `- Kendala/Bentrok: ${req.votes?.reject || 0} suara\n`;
            text += `Total partisipasi: ${total} mahasiswa.\n\n`;
            text += `Berdasarkan perolehan suara tersebut, apakah Bapak/Ibu ingin menetapkan jadwal pengganti pada Opsi yang terbanyak, atau ada arahan lain?\n\nTerima kasih banyak Bapak/Ibu.`;

            this.copyText(text, 'Draft WA Dosen berhasil disalin ke Clipboard.');
        },

        async addVote(reqId, key) {
            if (this.hasUserVoted[reqId]) {
                alert('Anda sudah mengirimkan pilihan untuk agenda voting jadwal ini.');
                return;
            }
            const req = this.requests.find(r => r.id == reqId);
            if (!req) return;

            const newVotes = { ...(req.votes || { opt1: 0, opt2: 0, reject: 0 }) };
            const prevCount = newVotes[key] || 0;
            newVotes[key] = prevCount + 1;
            req.votes = newVotes;

            this.hasUserVoted[reqId] = true;
            localStorage.setItem('pd_has_voted', JSON.stringify(this.hasUserVoted));

            await supabaseClient.from('requests').update({ votes: newVotes }).eq('id', reqId);

            // Notifikasi Kuorum Otomatis saat tepat menyentuh angka 18 (50% + 1)
            if (prevCount < QUORUM_THRESHOLD && newVotes[key] === QUORUM_THRESHOLD) {
                const course = this.getCourse(req.schedule_id || req.scheduleId);
                const optLabel = key === 'opt1'
                    ? `Opsi 1 (${req.opt1?.day}, ${req.opt1?.time})`
                    : (key === 'opt2' ? `Opsi 2 (${req.opt2?.day}, ${req.opt2?.time})` : 'Kendala / Bentrok');

                this.triggerWaNotification(
                    'Grup WA Kelas S1 SI 2025 C',
                    `[KUORUM VOTING TERCAPAI 50%+1]\nMata Kuliah: ${course.course}\nPilihan "${optLabel}" telah mencapai ${QUORUM_THRESHOLD}/34 suara mahasiswa. PJ Kelas sudah dapat menetapkan keputusan jadwal di Dashboard PJ.`
                );
            } else {
                this.triggerWaNotification('Sistem Internal', 'Suara baru berhasil masuk dalam sistem negosiasi jadwal.');
            }

            await this.loadAllData();
        },

        getTotalVotes(req) {
            if (!req?.votes) return 0;
            return (req.votes.opt1 || 0) + ((req.hasOpt2 || req.has_opt2) ? (req.votes.opt2 || 0) : 0) + (req.votes.reject || 0);
        },

        getVotePercent(req, key) {
            const total = this.getTotalVotes(req);
            return total === 0 ? 0 : Math.round(((req.votes?.[key] || 0) / total) * 100);
        },

        copyPollingLink(req) {
            const c = this.getCourse(req.schedule_id || req.scheduleId);
            const url = `${window.location.origin}/?poll=2025c-${req.id}`;
            const txt = `[VOTING JADWAL KULIAH]\nMata Kuliah: ${c.course}\nMohon tentukan jadwal pengganti Anda pada: ${url}`;
            this.triggerWaNotification('Grup WA Kelas S1 SI 2025 C', txt);
        },

        get mergedSchedules() {
            return this.masterSchedules.map(s => {
                const activeReq = this.requests.find(r => (r.schedule_id ?? r.scheduleId) == s.id);
                const baseData = {
                    ...s,
                    isHadir: Boolean(s.isHadir ?? s.is_hadir),
                    attendanceCount: s.attendanceCount ?? s.attendance_count ?? 0
                };

                if (activeReq) {
                    baseData.reqId = activeReq.id;
                    baseData.reqStatus = activeReq.status;
                    baseData.rejectReason = activeReq.reject_reason || activeReq.rejectReason;
                    baseData.hasOpt2 = activeReq.has_opt2 || activeReq.hasOpt2;

                    if (activeReq.status === 'approved') {
                        const chosenOpt = (activeReq.selected_option || activeReq.selectedOption) === 1 ? activeReq.opt1 : activeReq.opt2;
                        baseData.isRescheduled = true;
                        baseData.selectedOption = activeReq.selected_option || activeReq.selectedOption;
                        baseData.actualDay = chosenOpt?.day || '';
                        baseData.actualTime = chosenOpt?.time || '';
                        baseData.actualOnline = chosenOpt?.isOnline === true || chosenOpt?.isOnline === 'true';
                        baseData.askPjForGmeet = activeReq.ask_pj_for_gmeet || activeReq.askPjForGmeet;
                        baseData.gmeetLink = activeReq.gmeet_link || activeReq.gmeetLink;
                    } else if (activeReq.status === 'async_task') {
                        baseData.isAsyncTask = true;
                        baseData.autoFallback = activeReq.auto_fallback || activeReq.autoFallback;
                        baseData.taskNote = activeReq.task_note || activeReq.taskNote;
                    }
                }
                return baseData;
            });
        },

        getSchedulesByDay(targetDay) {
            if (this.scheduleView === 'master') {
                return this.masterSchedules
                    .filter(s => s.day === targetDay && this.matchesSearch(s))
                    .map(s => ({ ...s, uniqueKey: 'master-' + s.id, displayTime: s.time }))
                    .sort((a, b) => (a.displayTime || '').localeCompare(b.displayTime || ''));
            }

            const results = [];
            this.mergedSchedules.forEach(item => {
                if (!this.matchesSearch(item)) return;
                if (item.day === targetDay) {
                    if (item.isRescheduled && item.actualDay !== targetDay) {
                        results.push({
                            ...item,
                            uniqueKey: 'rt-away-' + item.id,
                            displayTime: item.time,
                            isMovedHere: false,
                            isMovedAway: true,
                            movedToDay: item.actualDay,
                            movedToTime: item.actualTime,
                            effectiveOnline: item.actualOnline
                        });
                    } else {
                        results.push({
                            ...item,
                            uniqueKey: 'rt-stay-' + item.id,
                            displayTime: item.isRescheduled ? item.actualTime : item.time,
                            isMovedHere: false,
                            isMovedAway: false,
                            effectiveOnline: item.isRescheduled ? item.actualOnline : false
                        });
                    }
                } else if (item.isRescheduled && item.actualDay === targetDay) {
                    results.push({
                        ...item,
                        uniqueKey: 'rt-here-' + item.id,
                        displayTime: item.actualTime,
                        isMovedHere: true,
                        isMovedAway: false,
                        originalDay: item.day,
                        effectiveOnline: item.actualOnline
                    });
                }
            });

            results.sort((a, b) => (a.displayTime || '').localeCompare(b.displayTime || ''));
            return results;
        },

        getAsyncCourses() {
            return this.requests
                .filter(r => r.status === 'async_task')
                .map(r => {
                    const c = this.getCourse(r.schedule_id || r.scheduleId);
                    return {
                        ...c,
                        taskKey: `req-${r.id}`,
                        taskNote: r.task_note || r.taskNote,
                        isAsyncTask: true,
                        rejectReason: r.reject_reason || r.rejectReason,
                        autoFallback: r.auto_fallback || r.autoFallback
                    };
                });
        },

        isTaskDone(taskKey) {
            return this.completedTasks.includes(taskKey);
        },

        toggleTaskDone(taskKey) {
            if (this.completedTasks.includes(taskKey)) {
                this.completedTasks = this.completedTasks.filter(k => k !== taskKey);
            } else {
                this.completedTasks.push(taskKey);
            }
            localStorage.setItem('pd_done_tasks', JSON.stringify(this.completedTasks));
        },

        get filteredAgendas() {
            const prefix = `[${this.currentUserEmail}] `;
            return this.agendas
                .filter(a => {
                    if (!a.title) return false;
                    if (a.title.startsWith('[')) {
                        return a.title.startsWith(prefix);
                    }
                    return true;
                })
                .map(a => ({
                    ...a,
                    cleanTitle: a.title.startsWith(prefix) ? a.title.slice(prefix.length) : a.title
                }));
        },

        async addAgenda() {
            if (!this.newAgenda.title.trim() || !this.newAgenda.time.trim()) {
                alert('Data agenda/waktu tidak lengkap.');
                return;
            }
            const taggedTitle = this.currentUserEmail
                ? `[${this.currentUserEmail}] ${this.newAgenda.title.trim()}`
                : this.newAgenda.title.trim();

            await supabaseClient.from('agendas').insert([{
                id: Date.now(),
                title: taggedTitle,
                time: this.newAgenda.time.trim()
            }]);
            this.newAgenda = { title: '', time: '' };
            await this.loadAllData();
        },

        async removeAgenda(id) {
            await supabaseClient.from('agendas').delete().eq('id', id);
            await this.loadAllData();
        },

        async resetAllDemoData() {
            if (this.role !== 'dosen' && this.role !== 'pj') {
                alert('Hanya Dosen dan PJ Kelas yang memiliki otoritas mereset data sistem.');
                return;
            }
            if (!confirm('PERINGATAN: Tindakan ini akan mereset seluruh pengajuan jadwal, status kehadiran, dan pengumuman kelas. Lanjutkan?')) {
                return;
            }

            await Promise.all([
                supabaseClient.from('requests').delete().neq('id', 0),
                supabaseClient.from('agendas').delete().neq('id', 0),
                supabaseClient.from('wa_logs').delete().neq('id', 0),
                supabaseClient.from('announcements').delete().neq('id', 0),
                supabaseClient.from('master_schedules').update({ is_hadir: false, attendance_count: 0 }).neq('id', 0)
            ]);

            await supabaseClient.from('agendas').insert([
                { id: 1, title: 'Rapat Evaluasi Kurikulum', time: '13:00' },
                { id: 2, title: 'Sidang Skripsi - Sdr. Ahmad', time: '15:30' }
            ]);

            this.completedTasks = [];
            this.hasUserVoted = {};
            this.attendedClasses = {};
            localStorage.removeItem('pd_done_tasks');
            localStorage.removeItem('pd_has_voted');
            localStorage.removeItem('pd_attended_classes');

            this.triggerWaNotification('Sistem Internal', 'Simulasi sistem dan database berhasil diset ulang.');
            await this.loadAllData();
        },

        async simulateOtherDosen() {
            const targetCourse = this.masterSchedules.find(s => s.course === 'Transformasi Digital');
            if (!targetCourse) return;

            const existing = this.requests.find(r => (r.schedule_id || r.scheduleId) == targetCourse.id);
            if (existing) {
                await supabaseClient.from('requests').delete().eq('id', existing.id);
            }

            const simPayload = {
                id: Date.now(),
                schedule_id: targetCourse.id,
                status: 'approved',
                selected_option: 1,
                opt1: { day: 'Kamis', time: '10:00 - 12:30 WIB', isOnline: true },
                ask_pj_for_gmeet: false,
                gmeet_link: 'https://meet.google.com/anggraeni-2025c',
                has_opt2: false,
                auto_fallback: false,
                votes: { opt1: 28, opt2: 0, reject: 2 }
            };

            await supabaseClient.from('requests').insert([simPayload]);
            this.scheduleView = 'realtime';
            this.triggerWaNotification(
                'Grup WA Kelas S1 SI 2025 C',
                `[JADWAL PENGGANTI DOSEN LAIN]\nIbu Anggraeni Widya Purwita mengalihkan kuliah Transformasi Digital dari hari Selasa ke hari Kamis pukul 10:00 - 12:30 WIB (Online).`
            );
            await this.loadAllData();
        }
    };
};