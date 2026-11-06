import numpy as np
import wave
import struct
import math
import os

def generate_athletic_starter_signal(
    sample_rate=44100,
    duration=4.0,
    output_wav_path="starter_gun_shot.wav"
):
    """
    Creates an ultra-realistic athletics track race starting signal.
    - Single sharp, authoritative starter pistol shot used by an official race starter.
    - Strong explosive transient, metallic barrel crack, and physical compression shockwave.
    - Tartan track ground reflection and starting line hardware early reflections.
    - Authentic outdoor stadium grandstand slapbacks.
    - 3 to 4 seconds natural fading stadium reverberation with atmospheric air absorption.
    - Subtle outdoor stadium open-air ambience.
    - Clean, studio-grade 44.1kHz 16-bit stereo WAV.
    """
    num_samples = int(sample_rate * duration)
    
    audio_l = np.zeros(num_samples, dtype=np.float64)
    audio_r = np.zeros(num_samples, dtype=np.float64)
    
    # Timing of the shot: 35ms of clean pre-roll
    t_shot = 0.035
    shot_idx = int(t_shot * sample_rate)
    
    # ---------------------------------------------------------
    # 1. MECHANICAL TRIGGER BREAK (Starter pistol click 2.5ms before fire)
    # ---------------------------------------------------------
    click_len = int(sample_rate * 0.003)
    t_click = np.linspace(0, 0.003, click_len, endpoint=False)
    click = (np.sin(2 * np.pi * 4200 * t_click) + 0.5 * np.sin(2 * np.pi * 7800 * t_click)) * np.exp(-t_click / 0.0008)
    c_idx = max(0, shot_idx - click_len)
    audio_l[c_idx:c_idx + click_len] += click * 0.07
    audio_r[c_idx:c_idx + click_len] += click * 0.065

    # ---------------------------------------------------------
    # 2. PRIMARY STARTING PISTOL SHOT (Direct Transient & Crack)
    # ---------------------------------------------------------
    shot_dur = 0.045  # 45ms direct sound window
    shot_samples = int(sample_rate * shot_dur)
    t_s = np.linspace(0, shot_dur, shot_samples, endpoint=False)
    
    # A. Supersonic Shockwave (Friedlander N-wave profile)
    tp = 0.00055  # positive pressure phase (~0.55ms)
    td = 0.0012   # exponential relaxation (~1.2ms)
    shockwave = (1.0 - t_s / tp) * np.exp(-t_s / td) * 3.2
    
    # B. Razor-sharp High Frequency Crack (Cylinder gap escape & gas shearing)
    np.random.seed(101)
    raw_noise = np.random.uniform(-1.0, 1.0, shot_samples)
    hf_crack = np.diff(raw_noise, prepend=0.0)
    hf_crack_envelope = np.exp(-t_s / 0.0038)
    hf_crack_component = hf_crack * hf_crack_envelope * 2.6
    
    # C. Expanding Propellant Gas Turbulence (8-18ms)
    gas_envelope = (t_s / 0.001) * np.exp(-t_s / 0.0085)
    gas_component = raw_noise * gas_envelope * 1.8
    
    # D. Metallic Barrel & Chamber Resonance Modes
    metal_ring = (
        0.70 * np.sin(2 * np.pi * 3250 * t_s) * np.exp(-t_s / 0.0055) +
        0.50 * np.sin(2 * np.pi * 4600 * t_s) * np.exp(-t_s / 0.0040) +
        0.35 * np.sin(2 * np.pi * 6100 * t_s) * np.exp(-t_s / 0.0028) +
        0.30 * np.sin(2 * np.pi * 1850 * t_s) * np.exp(-t_s / 0.0090)
    )
    
    # E. Acoustic Chest Punch / Low-Mid Body (165 Hz -> 65 Hz in 26ms)
    t_punch = t_s[:int(sample_rate * 0.028)]
    punch_freq = 165.0 - 100.0 * (t_punch / 0.028)
    punch_phase = 2 * np.pi * np.cumsum(punch_freq) / sample_rate
    punch = np.sin(punch_phase) * np.exp(-t_punch / 0.0090) * 1.6
    
    # Assemble direct shot signal
    direct_shot = np.zeros(shot_samples, dtype=np.float64)
    direct_shot += shockwave
    direct_shot += hf_crack_component
    direct_shot += gas_component
    direct_shot += metal_ring
    direct_shot[:len(punch)] += punch
    
    # Starter standing position: Trackside near Lane 1 (subtle binaural spread)
    end_s = min(shot_idx + shot_samples, num_samples)
    l_direct = end_s - shot_idx
    audio_l[shot_idx:end_s] += direct_shot[:l_direct] * 1.0
    audio_r[shot_idx:end_s] += direct_shot[:l_direct] * 0.94

    # ---------------------------------------------------------
    # 3. EARLY REFLECTIONS (Tartan Track Ground & Starting Line Hardware)
    # ---------------------------------------------------------
    early_taps = [
        # (delay_sec, gain_l, gain_r, phase, lp_freq, desc)
        (0.0051, 0.34, 0.31, -1.0, 7500, "tartan_ground_bounce"),
        (0.0118, 0.22, 0.24,  1.0, 5800, "starting_blocks_metal"),
        (0.0225, 0.17, 0.18,  1.0, 4800, "starter_stand_rostrum"),
        (0.0380, 0.13, 0.11,  1.0, 4100, "trackside_photo_board"),
        (0.0590, 0.09, 0.11, -1.0, 3400, "inner_field_boundary"),
    ]
    
    for delay_s, gl, gr, phase, lp_f, _ in early_taps:
        idx_tap = shot_idx + int(delay_s * sample_rate)
        if idx_tap < num_samples:
            b = np.exp(-2.0 * np.pi * lp_f / sample_rate)
            filtered = np.zeros_like(direct_shot)
            val = 0.0
            for i in range(len(direct_shot)):
                val = (1.0 - b) * direct_shot[i] + b * val
                filtered[i] = val
                
            avail = min(len(filtered), num_samples - idx_tap)
            audio_l[idx_tap:idx_tap + avail] += filtered[:avail] * gl * phase
            audio_r[idx_tap:idx_tap + avail] += filtered[:avail] * gr * phase

    # ---------------------------------------------------------
    # 4. OUTDOOR STADIUM GRANDSTAND SLAPBACK REFLECTIONS
    # ---------------------------------------------------------
    stadium_slaps = [
        # delay_s, gain_l, gain_r, lp_hz, desc
        (0.092, 0.18, 0.14, 4200, "main_stand_concrete_fascia"),
        (0.155, 0.15, 0.20, 3400, "opposite_backstraight_lower_deck"),
        (0.220, 0.13, 0.16, 2700, "opposite_backstraight_upper_deck"),
        (0.290, 0.11, 0.10, 2100, "first_turn_curve_grandstand"),
        (0.380, 0.09, 0.11, 1700, "far_bend_curve_grandstand"),
        (0.490, 0.07, 0.08, 1350, "giant_video_board_and_pylons"),
        (0.630, 0.05, 0.06, 1050, "deep_stadium_perimeter_concourse"),
        (0.790, 0.04, 0.04,  850, "outer_stadium_gates_echo"),
    ]
    
    for delay_s, gl, gr, lp_f, _ in stadium_slaps:
        s_idx = shot_idx + int(delay_s * sample_rate)
        if s_idx < num_samples:
            b = np.exp(-2.0 * np.pi * lp_f / sample_rate)
            filtered = np.zeros_like(direct_shot)
            val = 0.0
            for i in range(len(direct_shot)):
                val = (1.0 - b) * direct_shot[i] + b * val
                filtered[i] = val
            avail = min(len(filtered), num_samples - s_idx)
            audio_l[s_idx:s_idx + avail] += filtered[:avail] * gl
            audio_r[s_idx:s_idx + avail] += filtered[:avail] * gr

    # ---------------------------------------------------------
    # 5. DIFFUSE OUTDOOR STADIUM REVERBERATION (3.5 - 4.0 Seconds)
    # ---------------------------------------------------------
    # Physical multi-band stadium impulse response:
    # Simulates the thousands of acoustic scattering paths off plastic stadium seating,
    # cantilever roof trusses, and open-air dispersion across the 400m arena.
    tail_len = num_samples - shot_idx
    t_tail = np.linspace(0, duration - t_shot, tail_len, endpoint=False)
    
    # 3 Physical Frequency Bands with realistic atmospheric absorption:
    # 1. High Frequencies (2000 - 6500 Hz): Air absorption causes rapid decay (RT60 ~ 1.8s -> tau ~ 0.26s)
    # 2. Mid Frequencies (450 - 2000 Hz): Main stadium bowl resonance (RT60 ~ 3.3s -> tau ~ 0.48s)
    # 3. Low Frequencies (100 - 450 Hz): Deep stadium structure & field resonance (RT60 ~ 3.6s -> tau ~ 0.52s)
    
    np.random.seed(303)
    # Decorrelated white scattering kernels for stereo stadium width
    scat_raw_l = np.random.normal(0, 1, tail_len)
    scat_raw_r = np.random.normal(0, 1, tail_len)
    
    # Pre-filter bands using FFT
    f_scat_l = np.fft.rfft(scat_raw_l)
    f_scat_r = np.fft.rfft(scat_raw_r)
    freqs = np.fft.rfftfreq(tail_len, 1.0 / sample_rate)
    
    def band_filter(f_sig, f_low, f_high):
        mask = (freqs >= f_low) & (freqs <= f_high)
        filt_f = np.zeros_like(freqs)
        filt_f[mask] = 1.0
        # Smooth roll-off
        low_taper = (freqs >= f_low * 0.75) & (freqs < f_low)
        if np.any(low_taper):
            filt_f[low_taper] = 0.5 * (1.0 - np.cos(np.pi * (freqs[low_taper] - f_low * 0.75) / (f_low * 0.25)))
        high_taper = (freqs > f_high) & (freqs <= f_high * 1.3)
        if np.any(high_taper):
            filt_f[high_taper] = 0.5 * (1.0 + np.cos(np.pi * (freqs[high_taper] - f_high) / (f_high * 0.3)))
        res = np.fft.irfft(f_sig * filt_f, n=tail_len)
        rms = np.sqrt(np.mean(res**2))
        return (res / rms) if rms > 0 else res

    band_high_l = band_filter(f_scat_l, 2000, 6500)
    band_high_r = band_filter(f_scat_r, 2000, 6500)
    
    band_mid_l = band_filter(f_scat_l, 450, 2000)
    band_mid_r = band_filter(f_scat_r, 450, 2000)
    
    band_low_l = band_filter(f_scat_l, 100, 450)
    band_low_r = band_filter(f_scat_r, 100, 450)
    
    # Physical decay curves:
    tau_high = 0.38  # RT60 ~ 1.8s
    tau_mid  = 0.72  # RT60 ~ 3.3s
    tau_low  = 0.78  # RT60 ~ 3.6s
    
    # Onset delay for diffuse field: stadium scatter builds up after initial 60ms
    onset_env = np.clip((t_tail - 0.050) / 0.080, 0.0, 1.0)
    
    env_high = onset_env * np.exp(-t_tail / tau_high)
    env_mid  = onset_env * np.exp(-t_tail / tau_mid)
    env_low  = onset_env * np.exp(-t_tail / tau_low)
    
    # Terminal smooth taper starting at 3.3s and reaching silence cleanly at 3.9s
    terminal_taper = np.clip((3.90 - t_tail) / 0.60, 0.0, 1.0)
    
    diffuse_l = (
        0.30 * band_high_l * env_high +
        0.48 * band_mid_l  * env_mid  +
        0.28 * band_low_l  * env_low
    ) * terminal_taper
    
    diffuse_r = (
        0.30 * band_high_r * env_high +
        0.48 * band_mid_r  * env_mid  +
        0.28 * band_low_r  * env_low
    ) * terminal_taper
    
    # Stadium reverberance scaling
    reverb_level = 0.20
    audio_l[shot_idx:] += diffuse_l * reverb_level
    audio_r[shot_idx:] += diffuse_r * reverb_level

    # ---------------------------------------------------------
    # 6. SUBTLE OUTDOOR STADIUM ATMOSPHERE (Spectators & Open Air)
    # ---------------------------------------------------------
    amb_noise_l = np.random.normal(0, 1, num_samples)
    amb_noise_r = np.random.normal(0, 1, num_samples)
    
    def apply_amb_filter_fft(noise_arr):
        f_noise = np.fft.rfft(noise_arr)
        freqs_a = np.fft.rfftfreq(len(noise_arr), 1.0 / sample_rate)
        bp = np.zeros_like(freqs_a)
        mask = (freqs_a >= 140) & (freqs_a <= 2600)
        bp[mask] = 1.0
        low = (freqs_a >= 80) & (freqs_a < 140)
        bp[low] = 0.5 * (1.0 - np.cos(np.pi * (freqs_a[low] - 80) / 60))
        high = (freqs_a > 2600) & (freqs_a <= 3400)
        bp[high] = 0.5 * (1.0 + np.cos(np.pi * (freqs_a[high] - 2600) / 800))
        
        filtered = np.fft.irfft(f_noise * bp, n=len(noise_arr))
        rms = np.sqrt(np.mean(filtered**2))
        return (filtered / rms) if rms > 0 else filtered

    amb_l = apply_amb_filter_fft(amb_noise_l)
    amb_r = apply_amb_filter_fft(amb_noise_r)
    
    fade_len = int(sample_rate * 0.05)
    fade = np.ones(num_samples)
    fade[:fade_len] = np.linspace(0, 1, fade_len)
    fade[-fade_len:] = np.linspace(1, 0, fade_len)
    
    # Subservient background: -48 dB relative to peak
    amb_level = 0.0020
    audio_l += amb_l * amb_level * fade
    audio_r += amb_r * amb_level * fade

    # ---------------------------------------------------------
    # 7. PROFESSIONAL MASTERING & DYNAMIC NORMALIZATION
    # ---------------------------------------------------------
    def analog_clip(x):
        return np.tanh(x * 1.02) / 1.02
        
    audio_l = analog_clip(audio_l)
    audio_r = analog_clip(audio_r)

    # Normalize to -0.3 dBFS (0.966 peak)
    peak = max(np.max(np.abs(audio_l)), np.max(np.abs(audio_r)))
    if peak > 0:
        audio_l = (audio_l / peak) * 0.966
        audio_r = (audio_r / peak) * 0.966
    final_peak = max(np.max(np.abs(audio_l)), np.max(np.abs(audio_r)))

    # ---------------------------------------------------------
    # 8. EXPORT TO HIGH-FIDELITY STEREO 16-BIT WAV
    # ---------------------------------------------------------
    int_l = np.int16(np.clip(audio_l * 32767.0, -32768, 32767))
    int_r = np.int16(np.clip(audio_r * 32767.0, -32768, 32767))
    
    interleaved = np.empty(num_samples * 2, dtype=np.int16)
    interleaved[0::2] = int_l
    interleaved[1::2] = int_r
    
    os.makedirs(os.path.dirname(os.path.abspath(output_wav_path)), exist_ok=True)
    with wave.open(output_wav_path, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(interleaved.tobytes())
        
    print(f"SUCCESS: Generated realistic athletics starter signal: {output_wav_path}")
    print(f"Duration: {duration:.2f}s, Sample Rate: {sample_rate}Hz, Peak: {final_peak:.3f}")
    return output_wav_path

if __name__ == "__main__":
    out_dir = r"c:\Users\Aladine20Dz\photo-finish\public\sounds"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "starter_gun_shot.wav")
    generate_athletic_starter_signal(output_wav_path=out_path)
    
    # Also save in artifacts directory for direct user access
    artifact_dir = r"C:\Users\Aladine20Dz\.gemini\antigravity-ide\brain\360590cf-4f22-4183-8519-fff979b4bfe9"
    os.makedirs(artifact_dir, exist_ok=True)
    out_artifact = os.path.join(artifact_dir, "athletics_starter_gun.wav")
    generate_athletic_starter_signal(output_wav_path=out_artifact)
