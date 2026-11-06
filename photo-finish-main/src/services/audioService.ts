import { saveCustomAudioFile, getCustomAudioFile, deleteCustomAudioFile } from './audioStorage';
import {
  DEFAULT_STARTER_SOUND_NAME,
  DEFAULT_STARTER_SOUND_DURATION,
  DEFAULT_STARTER_SOUND_BASE64,
} from './embeddedSounds';

/**
 * تحويل نص Base64 إلى ArrayBuffer لفك تشفيره مباشرة في الذاكرة دون طلبات HTTP
 * هذا يمنع نهائياً اعتراض برامج التحميل (مثل IDM) للملفات الصوتية.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * محرك الصوتيات الاحترافي لسباقات ألعاب القوى (Athletics Audio Engine)
 * - استعادة إعدادات الطلقة الأصلية النقية بدقة الاستوديو ودون تشويش أو صدى مصطنع.
 * - تحميل الصوت مدمجاً مباشرة في الذاكرة لمنع ظهور برامج التحميل (IDM) نهائياً.
 * - دعم رفع ملفات MP3 مخصصة والتخزين الدائم بـ 0ms Latency.
 * - صفارة الشرطة المستمرة للفت الانتباه وفحص الإشارة بين الهاتفين.
 */
class AthleticsAudioEngine {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  // إعدادات الصوت ومحاكي صوت الملعب الأولمبي الفائق
  public globalVolume: number = 1.8;
  public globalPitch: number = 1.0;
  public stadiumAcoustics: boolean = true;
  public stadiumReverbLevel: number = 0.65;
  public stadiumAmbience: boolean = true;
  public hapticEnabled: boolean = true;
  private stadiumImpulseBuffer: AudioBuffer | null = null;

  // المخزن المؤقت لملف MP3 النشط (محمل في الذاكرة مسبقاً)
  private activeAudioBuffer: AudioBuffer | null = null;
  public activeAudioName: string = DEFAULT_STARTER_SOUND_NAME;
  public activeAudioDuration: number = DEFAULT_STARTER_SOUND_DURATION;
  private isAudioLoading: boolean = false;

  // عقد صفارة الشرطة المتصلة (Police Siren Nodes)
  private sirenNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
    hornFilter: BiquadFilterNode;
    sirenGain: GainNode;
    compressor: DynamicsCompressorNode;
    hapticInterval: any;
  } | null = null;
  public isSirenActive: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSavedAudio();

      window.addEventListener('click', () => this.resumeContext(), { once: true });
      window.addEventListener('touchstart', () => this.resumeContext(), { once: true });
    }
  }

  private initContext(): AudioContext {
    if (typeof window === 'undefined') {
      return {
        currentTime: 0,
        state: 'suspended',
        resume: async () => {},
        createGain: () => ({ gain: { value: 1, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }),
        createBufferSource: () => ({ buffer: null, playbackRate: { value: 1 }, connect: () => {}, start: () => {}, stop: () => {} }),
        destination: {}
      } as any;
    }
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private async resumeContext(): Promise<void> {
    const ctx = this.initContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  /**
   * تهيئة واسترجاع الملف الصوتي في الذاكرة مباشرة:
   * 1. فحص IndexedDB للملف المخصص الذي رفعه المستخدم
   * 2. في حال عدم وجوده، فك تشفير الصوت الافتراضي المدمج (Base64) فورياً في الذاكرة دون طلب HTTP
   */
  public async initSavedAudio(): Promise<void> {
    if (this.isAudioLoading) return;
    this.isAudioLoading = true;

    try {
      const ctx = this.initContext();

      // 1. محاولة استرجاع ملف المستخدم من التخزين الدائم IndexedDB
      const stored = await getCustomAudioFile();
      if (stored && stored.data) {
        try {
          const decoded = await ctx.decodeAudioData(stored.data.slice(0));
          this.activeAudioBuffer = decoded;
          this.activeAudioName = stored.name;
          this.activeAudioDuration = decoded.duration;
          this.isAudioLoading = false;
          return;
        } catch (e) {
          console.warn('Failed to decode stored audio data, falling back to embedded', e);
        }
      }

      // 2. فك تشفير الصوت الافتراضي المدمج في الذاكرة (لا يسبب أي طلب شبكة ولا يفتح IDM)
      await this.loadDefaultAudio();
    } catch (err) {
      console.warn('Audio initialization error:', err);
    } finally {
      this.isAudioLoading = false;
    }
  }

  /**
   * تحميل وفك تشفير ملف الصوت الافتراضي الأصلي من الذاكرة مباشرة (Base64)
   * يمنع أي ظهور لبرامج التحميل (IDM) ويعمل فورياً بـ 0ms تأخير
   */
  public async loadDefaultAudio(): Promise<boolean> {
    try {
      const ctx = this.initContext();
      const arrayBuffer = base64ToArrayBuffer(DEFAULT_STARTER_SOUND_BASE64);
      this.activeAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.activeAudioName = DEFAULT_STARTER_SOUND_NAME;
      this.activeAudioDuration = this.activeAudioBuffer.duration;
      return true;
    } catch (e) {
      console.warn('Could not decode embedded audio', e);
      return false;
    }
  }

  /**
   * رفع واستيراد ملف MP3 مخصص من جهاز المستخدم وتخزينه دائماً
   */
  public async loadCustomAudioFromFile(file: File): Promise<{ name: string; duration: number }> {
    const ctx = this.initContext();
    const arrayBuffer = await file.arrayBuffer();

    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    this.activeAudioBuffer = decoded;
    this.activeAudioName = file.name;
    this.activeAudioDuration = decoded.duration;

    await saveCustomAudioFile(file.name, arrayBuffer, decoded.duration);

    return {
      name: file.name,
      duration: decoded.duration,
    };
  }

  /**
   * إعادة الضبط إلى صوت الانطلاق الأصلي وحذف الملف المخصص
   */
  public async resetToDefaultSound(): Promise<void> {
    await deleteCustomAudioFile();
    await this.loadDefaultAudio();
  }

  public triggerHaptic(pattern: number[] = [180, 40, 90]): void {
    if (!this.hapticEnabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * توليد استجابة نبضية لمحاكاة صوت وصدى مدرجات وجدران الملعب المفتوح (Stadium Impulse Response)
   * صدى واقعي وطبيعي يمتد لـ 2.4 ثانية مع ارتدادات أولية لمحاكاة المدرجات الضخمة
   */
  private getStadiumImpulseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.stadiumImpulseBuffer && this.stadiumImpulseBuffer.sampleRate === ctx.sampleRate) {
      return this.stadiumImpulseBuffer;
    }

    const rate = ctx.sampleRate;
    const duration = 2.4;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    // ارتدادات أولية من مدرجات الملعب (Discrete early reflections)
    const reflections = [
      { time: 0.032, amp: 0.42, pan: -0.3 },
      { time: 0.058, amp: 0.35, pan: 0.35 },
      { time: 0.095, amp: 0.28, pan: -0.2 },
      { time: 0.145, amp: 0.22, pan: 0.25 },
      { time: 0.210, amp: 0.16, pan: -0.1 },
    ];

    for (let i = 0; i < length; i++) {
      const t = i / rate;
      // انحدار أسي للصدى في فضاء مفتوح واسع
      const decay = Math.exp(-t * 2.8);
      const noiseL = (Math.random() * 2 - 1) * decay * 0.45;
      const noiseR = (Math.random() * 2 - 1) * decay * 0.45;

      left[i] = noiseL;
      right[i] = noiseR;
    }

    // إضافة الارتدادات المحددة
    for (const ref of reflections) {
      const idx = Math.floor(ref.time * rate);
      if (idx < length) {
        const panL = (1 - ref.pan) * 0.5;
        const panR = (1 + ref.pan) * 0.5;
        left[idx] += ref.amp * panL;
        right[idx] += ref.amp * panR;
      }
    }

    this.stadiumImpulseBuffer = impulse;
    return impulse;
  }

  /**
   * تشغيل طبقة خلفية محاكية لأجواء مضمار الملعب المفتوح (Subtle Outdoor Stadium Track Ambience)
   */
  private playStadiumAmbienceLayer(ctx: AudioContext, startTime: number, volume: number): void {
    if (!this.stadiumAmbience) return;

    try {
      const duration = 2.5;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // ضوضاء دافئة متناغمة تمثل الهواء المفتوح وأجواء المضمار
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.05;
        b1 = 0.96300 * b1 + white * 0.11;
        b2 = 0.57000 * b2 + white * 0.25;
        data[i] = (b0 + b1 + b2) * 0.18;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      // فلتر تمرير حزمة لأجواء الهواء والجمهور البعيد
      const bandFilter = ctx.createBiquadFilter();
      bandFilter.type = 'bandpass';
      bandFilter.frequency.setValueAtTime(450, startTime);
      bandFilter.Q.setValueAtTime(0.8, startTime);

      const ambienceGain = ctx.createGain();
      const ambVol = Math.min(0.22, volume * 0.12);
      ambienceGain.gain.setValueAtTime(ambVol * 0.3, startTime);
      ambienceGain.gain.linearRampToValueAtTime(ambVol, startTime + 0.1);
      ambienceGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      noiseSource.connect(bandFilter);
      bandFilter.connect(ambienceGain);
      ambienceGain.connect(ctx.destination);

      noiseSource.start(startTime);
      noiseSource.stop(startTime + duration);
    } catch (e) {
      // ignore
    }
  }

  /**
   * بناء وتوصيل مسار معالجة الصوت المتقدم (Audio Processing Graph):
   * Source -> Punch EQ (Low Punch 95Hz + High Crack 3200Hz) -> Studio Compressor -> Master Gain ->
   * -> [Dry: Destination] + [Wet: Stadium Convolver Reverb -> Reverb Gain -> Destination]
   */
  private executeSoundGraph(ctx: AudioContext, now: number, buffer: AudioBuffer, vol: number, pitch: number): void {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(pitch, now);

    // 1. معادل الصوت الرياضي (Punch & Snap EQ)
    const lowPunch = ctx.createBiquadFilter();
    lowPunch.type = 'peaking';
    lowPunch.frequency.setValueAtTime(95, now);
    lowPunch.gain.setValueAtTime(4.5, now); // تعزيز الضربة القوية للطلقة
    lowPunch.Q.setValueAtTime(1.4, now);

    const highCrack = ctx.createBiquadFilter();
    highCrack.type = 'peaking';
    highCrack.frequency.setValueAtTime(3200, now);
    highCrack.gain.setValueAtTime(5.5, now); // تعزيز فرقعة البارود الحادة والواضحة
    highCrack.Q.setValueAtTime(1.8, now);

    // 2. ضاغط ديناميكي للاستوديو (Studio Dynamics Compressor) لتكبير الصوت دون تشويش
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, now);
    compressor.knee.setValueAtTime(4, now);
    compressor.ratio.setValueAtTime(8, now);
    compressor.attack.setValueAtTime(0.001, now);
    compressor.release.setValueAtTime(0.12, now);

    // 3. مضخم الصوت الرئيسي مع دعم حتى 300%
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(vol, now);

    // ربط مسار المعالجة الأساسي
    source.connect(lowPunch);
    lowPunch.connect(highCrack);
    highCrack.connect(compressor);
    compressor.connect(masterGain);

    // 4. خروج الصوت المباشر (Dry Signal)
    masterGain.connect(ctx.destination);

    // 5. محاكاة صدى مدرجات الملعب الأولمبي (Stadium Convolver Reverb)
    if (this.stadiumAcoustics) {
      try {
        const convolver = ctx.createConvolver();
        convolver.buffer = this.getStadiumImpulseBuffer(ctx);

        const reverbGain = ctx.createGain();
        const wetLevel = Math.max(0.05, Math.min(1.0, this.stadiumReverbLevel)) * 0.45;
        reverbGain.gain.setValueAtTime(wetLevel, now);

        masterGain.connect(convolver);
        convolver.connect(reverbGain);
        reverbGain.connect(ctx.destination);
      } catch (e) {
        console.warn('Convolver reverb fallback:', e);
      }
    }

    // 6. تشغيل طبقة هواء وأجواء المضمار
    if (this.stadiumAmbience) {
      this.playStadiumAmbienceLayer(ctx, now, vol);
    }

    source.start(now);
  }

  /**
   * تشغيل صوت طلقة الانطلاق الحقيقي (MP3) مع هندسة صوت الملعب والتضخيم الفائق:
   * - تشغيل مباشر من الذاكرة بـ 0ms تأخير دون طلب HTTP (يمنع IDM نهائياً).
   * - مضخم استوديو فائق (EQ Punch + Dynamics Compressor) لصوت جهير قوي وكراك حاد وواضح.
   * - محاكاة واقعية لصدى مدرجات الملعب الأولمبي (Stadium Convolver Reverb).
   * - طبقة هواء وأجواء المضمار الخارجي (Track Ambience).
   * - متزامن فورياً مع ساعة الانطلاق والاهتزاز اللمسي.
   */
  public playStarterSound(volInput?: number, pitchInput?: number): void {
    if (typeof window === 'undefined' || this.isMuted) return;

    const ctx = this.initContext();
    const now = ctx.currentTime;

    // مستوى الصوت مع دعم التضخيم العالي حتى 300%
    let rawVol = volInput !== undefined && Number.isFinite(volInput) ? volInput : this.globalVolume;
    if (rawVol > 5.0) rawVol = rawVol / 100;
    const vol = Math.max(0.1, Math.min(3.5, rawVol));

    // حدة وسرعة الصوت
    let rawPitch = pitchInput !== undefined && Number.isFinite(pitchInput) ? pitchInput : this.globalPitch;
    const pitch = Math.max(0.5, Math.min(2.0, rawPitch));

    // اهتزاز لمسي لحظي
    this.triggerHaptic([180, 40, 90]);

    if (this.activeAudioBuffer) {
      this.executeSoundGraph(ctx, now, this.activeAudioBuffer, vol, pitch);
      return;
    }

    // في حال عدم اكتمال فك التشفير، المحاولة من الصوت المدمج فوراً
    this.loadDefaultAudio().then(() => {
      if (this.activeAudioBuffer) {
        this.executeSoundGraph(ctx, ctx.currentTime, this.activeAudioBuffer, vol, pitch);
      }
    });
  }

  /**
   * طلقة استرجاع العدائين عند البداية الخاطئة (طلقتان متتاليتان + صفارة تحذير)
   */
  public playRecallGun(vol?: number, pitch?: number): void {
    const safeVol = vol !== undefined && Number.isFinite(vol) ? vol : this.globalVolume;
    const safePitch = pitch !== undefined && Number.isFinite(pitch) ? pitch : this.globalPitch;

    this.playStarterSound(safeVol, safePitch);
    setTimeout(() => {
      this.playStarterSound(safeVol, safePitch);
      this.playBeep(980, 0.35);
    }, 280);
  }

  /**
   * تشغيل صفارة الشرطة المستمرة للفت الانتباه وفحص الإشارة بين الهاتفين (Signal Check)
   * يستمر في الرنين بأعلى صوت طالما أن الزر مضغوط
   */
  public startPoliceSiren(volumeMultiplier: number = 1.0): void {
    if (this.isMuted || this.isSirenActive) return;

    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // 1. المذبذب الرئيسي لصفارة الشرطة (Wail Siren Sawtooth)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(850, now);

      // 2. مذبذب ثانوي متناغم بتضخيم الرنين (Dual-Tone Police Horn)
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(845, now);

      // 3. مذبذب LFO للتموج الدوري الكلاسيكي لصفارة الشرطة (Wail sweep)
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(1.3, now);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(420, now);

      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      // 4. مرشح بوق الشرطة الميغافون
      const hornFilter = ctx.createBiquadFilter();
      hornFilter.type = 'peaking';
      hornFilter.frequency.setValueAtTime(1300, now);
      hornFilter.Q.setValueAtTime(2.2, now);
      hornFilter.gain.setValueAtTime(8.0, now);

      // 5. ضاغط لتضخيم الصوت لأقصى درجة ممكنة دون تشويش
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, now);
      compressor.ratio.setValueAtTime(12, now);
      compressor.attack.setValueAtTime(0.002, now);
      compressor.release.setValueAtTime(0.1, now);

      // 6. التحكم في الحجم الرئيسي
      const sirenGain = ctx.createGain();
      const targetGain = Math.min(1.8, Math.max(0.6, volumeMultiplier * 1.4));
      sirenGain.gain.setValueAtTime(0.01, now);
      sirenGain.gain.linearRampToValueAtTime(targetGain, now + 0.04);

      // توصيل المسار:
      osc1.connect(hornFilter);
      osc2.connect(hornFilter);
      hornFilter.connect(compressor);
      compressor.connect(sirenGain);
      sirenGain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);

      // نبضات اهتزاز لمسي قوية ومستمرة للهاتف المنبه
      let hapticInterval: any = null;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([300, 100, 300, 100]);
          hapticInterval = setInterval(() => {
            if (this.isSirenActive && 'vibrate' in navigator) {
              navigator.vibrate([300, 100, 300, 100]);
            }
          }, 800);
        } catch (e) {
          // ignore
        }
      }

      this.sirenNodes = {
        osc1,
        osc2,
        lfo,
        lfoGain,
        hornFilter,
        sirenGain,
        compressor,
        hapticInterval,
      };
      this.isSirenActive = true;
    } catch (e) {
      console.warn('Failed to start police siren:', e);
    }
  }

  /**
   * إيقاف صفارة الشرطة فور إفلات الزر
   */
  public stopPoliceSiren(): void {
    if (!this.isSirenActive || !this.sirenNodes) return;

    try {
      const { osc1, osc2, lfo, sirenGain, hapticInterval } = this.sirenNodes;
      if (this.ctx) {
        const now = this.ctx.currentTime;
        sirenGain.gain.cancelScheduledValues(now);
        sirenGain.gain.setValueAtTime(sirenGain.gain.value, now);
        sirenGain.gain.linearRampToValueAtTime(0.001, now + 0.06);

        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
            lfo.stop();
            osc1.disconnect();
            osc2.disconnect();
            lfo.disconnect();
            sirenGain.disconnect();
          } catch (e) {
            // ignore
          }
        }, 80);
      }

      if (hapticInterval) {
        clearInterval(hapticInterval);
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(0);
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Error stopping police siren:', e);
    } finally {
      this.sirenNodes = null;
      this.isSirenActive = false;
    }
  }

  /**
   * نغمة تنبيه الحساس الضوئي عند قطع خط النهاية
   */
  public playSensorCutBeep(laneNumber: number): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime;

    const baseFreq = 800 + (laneNumber * 80);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playBeep(frequency: number = 880, duration: number = 0.15, volume: number = 0.4): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * صافرة النهاية الرياضية
   */
  public playWhistle(duration: number = 0.5, count: number = 2, vol?: number, pitch?: number): void {
    if (this.isMuted) return;
    const safeVol = vol !== undefined && Number.isFinite(vol) ? vol : this.globalVolume;
    const safePitch = pitch !== undefined && Number.isFinite(pitch) ? pitch : 1.0;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.playBeep(2400 * safePitch, duration, 0.4 * safeVol);
      }, i * (duration * 1000 + 120));
    }
  }

  public speakArabic(text: string): void {
    if (this.isMuted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech error:', e);
    }
  }
}

export const athleticsAudio = new AthleticsAudioEngine();
