// ============================================
//  PARTÍCULAS DE LUZ FLOTANTES
// ============================================
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];

const isMobile = /android|webos|iphone|ipad|ipod/i.test(navigator.userAgent);
const PARTICLE_COUNT = isMobile ? 50 : 90;

function resize() {
    width  = canvas.width  = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

function createParticle() {
    return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.8 + 0.4,
        speedY: -(Math.random() * 0.45 + 0.1),
        drift: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.6 + 0.25,
        twinkle: Math.random() * Math.PI * 2,
        color: Math.random() > 0.5 ? '255, 235, 180' : '200, 220, 255',
    };
}

function initParticles() {
    resize();
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle());
}

function animate() {
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
        p.y += p.speedY;
        p.x += p.drift + Math.sin(p.twinkle) * 0.35;
        p.twinkle += 0.02;

        if (p.y < -20) { p.y = height + 20; p.x = Math.random() * width; }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;

        const a = p.alpha * (0.55 + 0.45 * Math.sin(p.twinkle));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${a})`;
        ctx.shadowColor = `rgba(${p.color}, 0.9)`;
        ctx.shadowBlur = 12;
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
initParticles();
animate();


// ============================================
//  AUDIO (Web Audio API)
// ============================================
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
const soundBuffers = {};
let chargeSource = null;
let ambientSource = null;

(function setupAudio() {
    if (!AudioCtxClass) {
        console.warn('Web Audio API no soportada en este navegador.');
        return;
    }
    try {
        audioCtx = new AudioCtxClass();
        loadSound('charge',  'charge.mp3');
        loadSound('flower',  'flower.mp3');
        loadSound('ambient', 'ambient.mp3');
    } catch (e) {
        console.warn('No se pudo inicializar el audio:', e);
    }
})();

function loadSound(key, url) {
    if (!audioCtx) return;
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.arrayBuffer();
        })
        .then(data => audioCtx.decodeAudioData(data))
        .then(buffer => {
            soundBuffers[key] = buffer;
            console.log(`🔊 Sonido "${key}" cargado.`);
        })
        .catch(err => {
            console.warn(`⚠️ No se pudo cargar "${url}" (${key}):`, err.message || err);
        });
}

function unlockAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(key, { volume = 1, loop = false, fadeIn = 0 } = {}) {
    if (!audioCtx || !soundBuffers[key]) return null;
    unlockAudio();

    const source = audioCtx.createBufferSource();
    source.buffer = soundBuffers[key];
    source.loop = loop;

    const gain = audioCtx.createGain();
    if (fadeIn > 0) {
        const now = audioCtx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + fadeIn);
    } else {
        gain.gain.value = volume;
    }

    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);

    source._gainNode = gain;
    return source;
}

function stopSource(source, fadeDuration = 0.3) {
    if (!source) return;
    const gain = source._gainNode;
    if (gain && audioCtx) {
        const now = audioCtx.currentTime;
        try {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0, now + fadeDuration);
        } catch (e) {}
        try { source.stop(now + fadeDuration + 0.05); } catch (e) {}
    } else {
        try { source.stop(); } catch (e) {}
    }
}


// ============================================
//  FLORES INTERACTIVAS
// ============================================
const flowersEl = document.getElementById('flowers');
const flowerButtons = document.querySelectorAll('.flower');

flowerButtons.forEach(flower => {
    flower.addEventListener('click', (e) => {
        e.preventDefault();
        flower.classList.add('is-lit');

        // ✨ Sonido de la flor
        playSound('flower', { volume: 0.6 });

        clearTimeout(flower._timer);
        flower._timer = setTimeout(() => {
            flower.classList.remove('is-lit');
        }, 2600);
    });
});


// ============================================
//  INTERACCIÓN: MANTENER PRESIONADO EL SOBRE
// ============================================
const intro         = document.getElementById('intro');
const envelope      = document.getElementById('envelope');
const mainScene     = document.getElementById('mainScene');
const characterWrap = document.getElementById('characterWrap');
const message       = document.getElementById('message');

const HOLD_DURATION = 1600;

let started  = false;
let holding  = false;
let progress = 0;

function startHold(e) {
    if (started || holding) return;
    if (e && e.preventDefault) e.preventDefault();

    unlockAudio();

    holding = true;
    progress = 0;
    envelope.classList.add('charging');
    envelope.style.setProperty('--progress', 0);

    // 🎵 Sonido de carga (una sola vez, mientras mantienes)
    // Si tu sonido es largo y quieres que suene continuo, pon loop: true
    chargeSource = playSound('charge', { volume: 0.5, loop: false });

    const start = performance.now();

    function tick(now) {
        if (!holding) return;
        progress = Math.min((now - start) / HOLD_DURATION, 1);
        envelope.style.setProperty('--progress', progress);

        if (progress >= 1) {
            completeHold();
            return;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function cancelHold() {
    if (!holding) return;
    holding = false;
    progress = 0;
    envelope.classList.remove('charging');
    envelope.style.setProperty('--progress', 0);

    // 🔇 Cortar el sonido de carga si sueltas antes
    stopSource(chargeSource, 0.15);
    chargeSource = null;
}

function completeHold() {
    if (started) return;
    started = true;
    holding = false;
    progress = 1;
    envelope.style.setProperty('--progress', 1);
    envelope.classList.remove('charging');
    envelope.classList.add('opening');

    // 🔇 Cortar el sonido de carga
    stopSource(chargeSource, 0.15);
    chargeSource = null;

    // Cuando el sobre termina de abrirse → escena + flores + ambiente
    setTimeout(() => {
        intro.classList.add('fade-out');
        mainScene.classList.add('reveal');
        flowersEl.classList.add('reveal');

        // 🎵 Arrancar música ambiente (fade-in suave de 2 s)
        if (!ambientSource) {
            ambientSource = playSound('ambient', {
                volume: 0.25,
                loop: true,
                fadeIn: 2
            });
        }

        setTimeout(() => characterWrap.classList.add('visible'), 400);
        setTimeout(() => message.classList.add('visible'), 3400);
    }, 1300);
}

// --- Eventos del sobre ---
envelope.addEventListener('pointerdown', startHold);
envelope.addEventListener('pointerup', cancelHold);
envelope.addEventListener('pointercancel', cancelHold);
envelope.addEventListener('pointerleave', cancelHold);
envelope.addEventListener('contextmenu', e => e.preventDefault());

// Accesibilidad por teclado
envelope.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !started && !holding) {
        e.preventDefault();
        progress = 1;
        envelope.style.setProperty('--progress', 1);
        completeHold();
    }
});