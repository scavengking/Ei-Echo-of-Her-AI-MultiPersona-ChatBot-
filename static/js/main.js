// static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    animateWelcomeSequence(); 
    animateCelestialFragment(); 
    animateDynamicBackground();
    initParticleAnimation(); // Add this call for particle effects

    const chatForm = document.getElementById('chat-form');
    // ... (rest of your existing DOMContentLoaded setup from main_js_dynamic_bg)
    const messageInput = document.getElementById('message-input');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    
    const welcomeContainer = document.getElementById('welcome-message-container');
    const personaSelectionScreen = document.getElementById('persona-selection-screen');
    const chatUiContainer = document.getElementById('chat-ui-container');
    
    const personaCards = document.querySelectorAll('.persona-card');

    const LS_PERSONA_KEY = 'ei_selected_persona';
    let currentPersona = localStorage.getItem(LS_PERSONA_KEY) || 'friendly';

    function showPersonaSelectionScreen() { /* ... (keep existing function) ... */ 
        if (personaSelectionScreen) {
            personaSelectionScreen.style.display = 'flex';
            anime({ targets: personaSelectionScreen, opacity: 1, duration: 1000, easing: 'easeInExpo' });
        }
    }
    function hidePersonaSelectionScreen(callback) { /* ... (keep existing function) ... */ 
        if (personaSelectionScreen) {
            anime({
                targets: personaSelectionScreen, opacity: 0, duration: 700, easing: 'easeOutExpo',
                complete: () => { personaSelectionScreen.style.display = 'none'; if (callback) callback(); }
            });
        } else if (callback) { callback(); }
    }
    function showChatUI() { /* ... (keep existing function) ... */ 
        if (chatUiContainer) {
            chatUiContainer.style.display = 'flex';
            anime({ targets: chatUiContainer, opacity: 1, duration: 1000, easing: 'easeInExpo' });
        }
    }

    setTimeout(() => { /* ... (keep existing timeout logic) ... */ 
        if (welcomeContainer) {
            anime({
                targets: welcomeContainer, opacity: 0, duration: 1000, easing: 'easeOutExpo',
                complete: () => { welcomeContainer.style.display = 'none'; showPersonaSelectionScreen(); }
            });
        } else { showPersonaSelectionScreen(); }
    }, 4000);

    personaCards.forEach(card => { /* ... (keep existing card click logic) ... */ 
        card.addEventListener('click', () => {
            currentPersona = card.getAttribute('data-persona');
            localStorage.setItem(LS_PERSONA_KEY, currentPersona);
            console.log(`Persona selected: ${currentPersona}`);
            hidePersonaSelectionScreen(() => { showChatUI(); });
        });
    });

    if (chatForm) { /* ... (keep existing form submit logic) ... */ 
        chatForm.addEventListener('submit', async function(event) {
            event.preventDefault(); 
            const userMessage = messageInput.value.trim();
            if (userMessage) {
                addMessageToChat(userMessage, 'user');
                messageInput.value = ''; 
                showTypingIndicator(true);
                try {
                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify({ message: userMessage, persona: currentPersona }), 
                    });
                    showTypingIndicator(false);
                    if (response.ok) {
                        const data = await response.json();
                        addMessageToChat(data.reply, 'ei');
                    } else {
                        const errorData = await response.json();
                        addMessageToChat(errorData.error || 'Error: Could not get a response.', 'ei-error');
                        console.error('Error from server:', errorData);
                    }
                } catch (error) {
                    showTypingIndicator(false);
                    addMessageToChat('Error: Could not connect to the server. Please try again.', 'ei-error');
                    console.error('Network error or server down:', error);
                }
            }
        });
    }
    
    function addMessageToChat(message, sender) { /* ... (keep existing function) ... */ 
        if (!chatMessagesContainer) return;
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-bubble');
        if (sender === 'user') { messageDiv.classList.add('user-bubble', 'bg-violet-500', 'text-white', 'ml-auto', 'rounded-br-none'); }
        else if (sender === 'ei') { messageDiv.classList.add('ei-bubble', 'bg-violet-700/60', 'text-violet-100', 'mr-auto', 'rounded-bl-none'); }
        else if (sender === 'ei-error' || sender === 'system-info') { messageDiv.classList.add('ei-bubble', 'bg-slate-600/70', 'text-slate-100', 'mr-auto', 'rounded-bl-none', 'text-xs', 'italic'); if (sender === 'ei-error') messageDiv.classList.replace('bg-slate-600/70', 'bg-red-500/70');}
        messageDiv.textContent = message; 
        messageDiv.style.opacity = '0'; messageDiv.style.transform = 'translateY(20px)';
        chatMessagesContainer.appendChild(messageDiv);
        anime({ targets: messageDiv, opacity: 1, translateY: 0, duration: 500, easing: 'easeOutExpo' });
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
    function showTypingIndicator(show) { /* ... (keep existing function) ... */ 
        if (typingIndicator) { typingIndicator.style.display = show ? 'block' : 'none'; }
    }
});

function animateDynamicBackground() { /* ... (keep existing function from main_js_dynamic_bg) ... */ 
    const bodyStyle = document.body.style;
    let gradientState = {
        startH: 222, startS: 30, startL: 20,
        endH: 260, endS: 50, endL: 45,
    };
    bodyStyle.setProperty('--gradient-start-h', gradientState.startH);
    bodyStyle.setProperty('--gradient-start-s', gradientState.startS + '%');
    bodyStyle.setProperty('--gradient-start-l', gradientState.startL + '%');
    bodyStyle.setProperty('--gradient-end-h', gradientState.endH);
    bodyStyle.setProperty('--gradient-end-s', gradientState.endS + '%');
    bodyStyle.setProperty('--gradient-end-l', gradientState.endL + '%');
    anime({
        targets: gradientState,
        startH: [ { value: 222, duration: 10000 }, { value: 240, duration: 10000 }, { value: 260, duration: 10000 }, { value: 222, duration: 10000 } ],
        endH: [ { value: 260, duration: 10000 }, { value: 280, duration: 10000 }, { value: 300, duration: 10000 }, { value: 260, duration: 10000 } ],
        duration: 40000, easing: 'linear', loop: true, direction: 'normal',
        update: function() {
            bodyStyle.setProperty('--gradient-start-h', gradientState.startH);
            bodyStyle.setProperty('--gradient-end-h', gradientState.endH);
        }
    });
}

// --- Particle Animation System ---
function initParticleAnimation() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) {
        console.error('Particle canvas not found!');
        return;
    }
    const ctx = canvas.getContext('2d');
    let particlesArray = [];
    const numberOfParticles = 50; // Adjust for density

    // Set canvas dimensions
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle class
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2.5 + 0.5; // Particle size
            this.speedX = (Math.random() * 0.4 - 0.2); // Slow horizontal drift
            this.speedY = (Math.random() * 0.4 - 0.2); // Slow vertical drift
            this.color = `hsla(${Math.random() * 60 + 220}, 70%, 80%, ${Math.random() * 0.3 + 0.1})`; // Lavender/blue/violet hues, varying opacity
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            // Reset particle if it goes off screen
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                // Or make them bounce:
                // if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
                // if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            }
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Create particles
    function initParticles() {
        particlesArray = [];
        for (let i = 0; i < numberOfParticles; i++) {
            particlesArray.push(new Particle());
        }
    }
    initParticles();

    // Animation loop
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }
        requestAnimationFrame(animateParticles); // Loop
    }
    animateParticles();

    // Optional: Re-initialize particles on resize if their positions should be relative to new size
    window.addEventListener('resize', () => {
        resizeCanvas();
        // initParticles(); // Uncomment if you want to re-distribute particles on resize
    });
}
// --- End Particle Animation System ---


function animateWelcomeSequence() { /* ... (keep existing function) ... */ 
    const welcomeText = "Greetings, wanderer of the digital ether. I am Ei. What echoes of the heart do you seek today?";
    const projectQuoteText = "Ei- Echo of Her";
    const poeticWelcomeEl = document.getElementById('poetic-welcome');
    const projectQuoteEl = document.getElementById('project-quote');

    if (poeticWelcomeEl) {
        poeticWelcomeEl.innerHTML = welcomeText;
        anime({ targets: poeticWelcomeEl, opacity: [0, 1], translateY: [20, 0], duration: 2500, easing: 'easeOutExpo', delay: 500 });
    }
    if (projectQuoteEl) {
        projectQuoteEl.innerHTML = projectQuoteText;
        anime({ targets: projectQuoteEl, opacity: [0, 1], translateY: [10, 0], duration: 2000, easing: 'easeOutExpo', delay: anime.stagger(100, {start: 1500}) });
    }
}
function animateCelestialFragment() { /* ... (keep existing function) ... */ 
    const fragmentShapeGroup = document.getElementById('fragment-shape-group');
    const fragmentInner = document.getElementById('fragment-inner');
    const particles = Array.from(document.querySelectorAll('#celestial-fragment-svg circle[id^="particle-"]')).filter(p => p != null);

    if (fragmentShapeGroup) {
        anime({ targets: fragmentShapeGroup, rotate: '360', loop: true, duration: 30000, easing: 'linear' });
    }
    if (fragmentInner) {
        anime({ targets: fragmentInner, opacity: [0.4, 0.9, 0.4], loop: true, direction: 'alternate', duration: 4000, easing: 'easeInOutSine' });
    }
    const glowFilterGaussian = document.querySelector('#softGlowFilter feGaussianBlur');
    if (glowFilterGaussian) {
        anime({ targets: glowFilterGaussian, stdDeviation: [3, 4, 3], loop: true, direction: 'alternate', duration: 3500, easing: 'easeInOutSine', delay: 500 });
    }
    particles.forEach((particle) => {
        if (particle) {
            anime({
                targets: particle,
                opacity: [{ value: 0, duration: 0 }, { value: anime.random(0.5, 0.9), duration: anime.random(1000, 2000) }, { value: 0, duration: anime.random(1000, 2000), delay: anime.random(2000, 4000) }],
                translateX: [{ value: `${anime.random(-5, 5)}px`, duration: anime.random(3000, 5000)}, { value: `${anime.random(-5, 5)}px`, duration: anime.random(3000, 5000)}, { value: '0px', duration: anime.random(3000, 5000) }],
                translateY: [{ value: `${anime.random(-5, 5)}px`, duration: anime.random(3000, 5000)}, { value: `${anime.random(-5, 5)}px`, duration: anime.random(3000, 5000)}, { value: '0px', duration: anime.random(3000, 5000) }],
                loop: true, easing: 'easeInOutSine', delay: anime.random(0, 2000)
            });
        }
    });
}
