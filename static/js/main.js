// static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DEFINE KEY DOM ELEMENTS ---
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const welcomeContainer = document.getElementById('welcome-message-container');
    const personaSelectionScreen = document.getElementById('persona-selection-screen');
    const chatUiContainer = document.getElementById('chat-ui-container');
    const personaCards = document.querySelectorAll('.persona-card');
    const emptySessionPlaceholder = document.getElementById('empty-session-placeholder');
    const earnedBadgesContainer = document.getElementById('earned-badges-container');

    // Gamification Elements
    const xpLevelEl = document.getElementById('xp-level');
    const xpBarEl = document.getElementById('xp-bar');
    const xpCurrentEl = document.getElementById('xp-current');
    const xpNextLevelEl = document.getElementById('xp-next-level');

    // History Panel Elements
    const historyPanel = document.getElementById('history-panel');
    const historyPanelToggle = document.getElementById('history-panel-toggle');
    const historyList = document.getElementById('history-list');
    const newChatButton = document.getElementById('new-chat-button');
    const mainContentArea = document.getElementById('main-content-area');

    // --- STATE VARIABLES ---
    const LS_PERSONA_KEY = 'ei_selected_persona';
    const LS_SESSION_ID_KEY = 'ei_current_session_id';
    let currentPersona = localStorage.getItem(LS_PERSONA_KEY) || 'friendly';
    let currentSessionId = localStorage.getItem(LS_SESSION_ID_KEY);

    // --- BADGE DEFINITIONS & GAMIFICATION STATE ---
    const LS_EARNED_BADGES_KEY = 'ei_earned_badges';
    const LS_MESSAGE_COUNT_KEY = 'ei_message_count';
    const LS_PERSONAS_TRIED_KEY = 'ei_personas_tried';
    const LS_SESSIONS_INTERACTED_KEY = 'ei_sessions_interacted';
    const LS_HAS_VIEWED_HISTORY_KEY = 'ei_has_viewed_history';
    const LS_XP_KEY = 'ei_user_xp'; 
    const LS_LEVEL_KEY = 'ei_user_level'; 

    // XP and Leveling constants
    const XP_PER_MESSAGE = 15; // Moved here for clarity with other gamification constants
    const LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5500]; // Added back


    let earnedBadges = JSON.parse(localStorage.getItem(LS_EARNED_BADGES_KEY)) || [];
    let totalMessagesSent = parseInt(localStorage.getItem(LS_MESSAGE_COUNT_KEY), 10) || 0;
    let personasTried = JSON.parse(localStorage.getItem(LS_PERSONAS_TRIED_KEY)) || [];
    let sessionsInteracted = JSON.parse(localStorage.getItem(LS_SESSIONS_INTERACTED_KEY)) || [];
    let hasViewedHistory = localStorage.getItem(LS_HAS_VIEWED_HISTORY_KEY) === 'true';

    const ALL_PERSONA_IDS = ["friendly", "sage", "coding", "sarcastic", "scifi"];

    const badges = {
        firstEcho: {
            id: 'firstEcho',
            name: 'First Echo',
            description: "You've initiated your first conversation with Ei.",
            emoji: '💬',
            unlocked: false
        },
        curiousMind: {
            id: 'curiousMind',
            name: 'Curious Mind',
            description: "Explored at least 2 different facets of Ei's personality.",
            emoji: '🎭',
            unlocked: false
        },
        level2Reached: {
            id: 'level2Reached',
            name: 'Level 2 Reached',
            description: "Your connection with Ei is growing stronger!",
            emoji: '✨',
            unlocked: false
        },
        sessionWeaver: {
            id: 'sessionWeaver',
            name: 'Session Weaver',
            description: "Weaving at least 3 threads of conversation.",
            emoji: '🧵',
            unlocked: false
        },
        timeTraveler: {
            id: 'timeTraveler',
            name: 'Time Traveler',
            description: "Revisited a past conversation stream.",
            emoji: '🕰️',
            unlocked: false
        },
        dedicatedListener: {
            id: 'dedicatedListener',
            name: 'Dedicated Listener',
            description: "Listened and responded thoughtfully (25 messages sent).",
            emoji: '🎧',
            unlocked: false
        },
        personaVirtuoso: {
            id: 'personaVirtuoso',
            name: 'Persona Virtuoso',
            description: "Experienced all primary facets of Ei (all 5 personas tried).",
            emoji: '🌟',
            unlocked: false
        }
    };

    // Gamification core state (XP and Level)
    let currentUserXP = 0;
    let currentUserLevel = 1;


    function updateBadgeUnlockStatus() {
        earnedBadges.forEach(badgeId => {
            if (badges[badgeId]) {
                badges[badgeId].unlocked = true;
            }
        });
    }

    function saveEarnedBadges() {
        localStorage.setItem(LS_EARNED_BADGES_KEY, JSON.stringify(earnedBadges));
    }

    function saveGamificationStats() {
        localStorage.setItem(LS_MESSAGE_COUNT_KEY, totalMessagesSent.toString());
        localStorage.setItem(LS_PERSONAS_TRIED_KEY, JSON.stringify(personasTried));
        localStorage.setItem(LS_SESSIONS_INTERACTED_KEY, JSON.stringify(sessionsInteracted));
        localStorage.setItem(LS_HAS_VIEWED_HISTORY_KEY, hasViewedHistory.toString());
        localStorage.setItem(LS_XP_KEY, currentUserXP.toString()); 
        localStorage.setItem(LS_LEVEL_KEY, currentUserLevel.toString()); 
        saveEarnedBadges(); 
    }

    function showBadgeNotification(badge) {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'badge-notification fixed top-20 right-5 bg-violet-700 text-white p-4 rounded-lg shadow-xl z-50 opacity-0 transition-all duration-500 ease-out';
        notificationDiv.innerHTML = `
            <p class="font-semibold text-lg">Badge Unlocked! ${badge.emoji}</p>
            <p class="text-sm">${badge.name}: ${badge.description}</p>
        `;
        document.body.appendChild(notificationDiv);
        anime({
            targets: notificationDiv,
            opacity: [0, 1], translateY: [-20, 0], duration: 500, easing: 'easeOutExpo',
            complete: () => {
                anime({
                    targets: notificationDiv,
                    opacity: 0, translateY: [0, -20], duration: 500, delay: 4000, easing: 'easeInExpo',
                    complete: () => { notificationDiv.remove(); }
                });
            }
        });
    }

    function awardBadge(badgeId) {
        if (badges[badgeId] && !badges[badgeId].unlocked) {
            badges[badgeId].unlocked = true;
            if (!earnedBadges.includes(badgeId)) {
                earnedBadges.push(badgeId);
            }
            saveEarnedBadges(); 
            console.log(`Badge awarded: ${badges[badgeId].name}`);
            showBadgeNotification(badges[badgeId]);
            displayEarnedBadges();
        }
    }

    function displayEarnedBadges() {
        if (!earnedBadgesContainer) return;
        earnedBadgesContainer.innerHTML = '';
        if (earnedBadges.length === 0) {
            earnedBadgesContainer.style.display = 'none';
            return;
        }
        earnedBadgesContainer.style.display = 'flex';
        earnedBadges.forEach(badgeId => {
            const badge = badges[badgeId];
            if (badge) {
                const badgeElement = document.createElement('div');
                badgeElement.className = 'badge-item text-2xl tooltip';
                badgeElement.setAttribute('data-tooltip', `${badge.name}: ${badge.description}`);
                badgeElement.textContent = badge.emoji;
                earnedBadgesContainer.appendChild(badgeElement);
            }
        });
    }

    function checkAndAwardBadges() {
        if (totalMessagesSent >= 1) awardBadge('firstEcho');
        if (personasTried.length >= 2) awardBadge('curiousMind');
        if (currentUserLevel >= 2) awardBadge('level2Reached');
        if (sessionsInteracted.length >= 3) awardBadge('sessionWeaver');
        if (hasViewedHistory) awardBadge('timeTraveler');
        if (totalMessagesSent >= 25) awardBadge('dedicatedListener');
        if (ALL_PERSONA_IDS.every(id => personasTried.includes(id))) {
            awardBadge('personaVirtuoso');
        }
    }

    // --- GAMIFICATION FUNCTIONS (XP and Level) ---
    function loadXPState() {
        const storedXP = localStorage.getItem(LS_XP_KEY); 
        const storedLevel = localStorage.getItem(LS_LEVEL_KEY); 

        if (storedXP !== null) {
            currentUserXP = parseInt(storedXP, 10);
        } else {
            currentUserXP = 0;
        }
        recalculateLevelFromXP();
        updateXPDisplay();
    }
    
    function getXPForNextLevel(level) {
        if (level < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level]; // Uses LEVEL_THRESHOLDS
        return Infinity;
    }

    function getXPForCurrentLevelStart(level) {
        // Uses LEVEL_THRESHOLDS
        if (level > 0 && (level - 1) < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1]; 
        return 0;
    }

    function updateXPDisplay() {
        if (!xpLevelEl || !xpBarEl || !xpCurrentEl || !xpNextLevelEl) {
            return;
        }
        xpLevelEl.textContent = currentUserLevel;
        const xpStart = getXPForCurrentLevelStart(currentUserLevel);
        const xpNext = getXPForNextLevel(currentUserLevel);

        if (xpNext === Infinity) {
            xpCurrentEl.textContent = currentUserXP;
            xpNextLevelEl.textContent = "MAX";
            xpBarEl.style.width = "100%";
        } else {
            const xpInLevel = currentUserXP - xpStart;
            const xpNeeded = xpNext - xpStart;
            let progress = 0;
            if (xpNeeded > 0) progress = Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));
            else if (currentUserXP >= xpNext) progress = 100;

            xpCurrentEl.textContent = currentUserXP;
            xpNextLevelEl.textContent = xpNext;
            xpBarEl.style.width = `${progress}%`;
        }
    }

    function recalculateLevelFromXP() {
        let newLevel = 1;
        // Uses LEVEL_THRESHOLDS
        for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
            if (currentUserXP >= LEVEL_THRESHOLDS[i]) newLevel = i + 1;
            else break;
        }
        currentUserLevel = newLevel;
    }

    function addXP(amount) {
        currentUserXP += amount;
        const oldLevel = currentUserLevel;
        recalculateLevelFromXP();
        updateXPDisplay(); 

        if (currentUserLevel > oldLevel) {
            console.log(`Level Up! Reached Level ${currentUserLevel}`);
            addMessageToChat(`Congratulations! You've reached Level ${currentUserLevel}! ✨`, 'system-info');
        }
        saveGamificationStats(); 
        checkAndAwardBadges(); 
    }


    // --- INITIALIZATION ---
    function initializeApp() {
        animateWelcomeSequence();
        animateCelestialFragment();
        animateDynamicBackground();
        initParticleAnimation();
        
        loadXPState(); 
        updateBadgeUnlockStatus(); 

        if (!currentSessionId) {
            startNewChatSession(false);
        } else {
            if (!sessionsInteracted.includes(currentSessionId)) {
                sessionsInteracted.push(currentSessionId);
            }
        }
        saveGamificationStats(); 

        loadChatSessions();
        displayEarnedBadges();
        checkAndAwardBadges(); 

        setTimeout(() => { 
            if (welcomeContainer) {
                anime({
                    targets: welcomeContainer, opacity: 0, duration: 1000, easing: 'easeOutExpo',
                    complete: () => {
                        welcomeContainer.style.display = 'none';
                        showPersonaSelectionScreen();
                    }
                });
            } else {
                showPersonaSelectionScreen();
            }
        }, 4000);
    }
    
    function generateSessionId() {
        return uuid.v4();
    }

    function startNewChatSession(showUI = true) {
        currentSessionId = generateSessionId();
        localStorage.setItem(LS_SESSION_ID_KEY, currentSessionId);
        console.log(`Started new session: ${currentSessionId}`);

        if (!sessionsInteracted.includes(currentSessionId)) {
            sessionsInteracted.push(currentSessionId);
        }
        saveGamificationStats(); 

        if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
        showTypingIndicator(false);
        showEmptySessionPlaceholder(true);
        loadChatSessions();
        updateActiveSessionInPanel(currentSessionId);
        checkAndAwardBadges(); 

        if (showUI) { 
            if (personaSelectionScreen.style.opacity === "1") {
                hidePersonaSelectionScreen(showChatUI);
            } else {
                showChatUI();
            }
        }
        return currentSessionId;
    }

     function showEmptySessionPlaceholder(show) {
        if (emptySessionPlaceholder) {
            if (show) {
                emptySessionPlaceholder.classList.add('visible');
            } else {
                emptySessionPlaceholder.classList.remove('visible');
            }
        }
    }

    if (historyPanelToggle && historyPanel && mainContentArea) {
        historyPanelToggle.addEventListener('click', () => {
            historyPanel.classList.toggle('open');
        });
    }

    if (newChatButton) {
        newChatButton.addEventListener('click', () => {
            startNewChatSession(true); 
            if (historyPanel.classList.contains('open')) {
                 historyPanel.classList.remove('open');
            }
        });
    }

    async function loadChatSessions() { 
        if (!historyList) return;
        try {
            const response = await fetch('/get_sessions');
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP error! Status: ${response.status}`);
            }
            const sessions = await response.json();
            historyList.innerHTML = ''; 

            if (sessions.length === 0) {
                const noSessionsLi = document.createElement('li');
                noSessionsLi.textContent = "No past sessions found.";
                noSessionsLi.className = 'px-2 py-1 text-sm text-gray-400 italic';
                historyList.appendChild(noSessionsLi);
            } else {
                sessions.forEach(session => {
                    const li = document.createElement('li');
                    li.className = 'history-item';
                    li.dataset.sessionId = session.session_id;

                    const previewSpan = document.createElement('span');
                    previewSpan.className = 'history-item-preview';
                    previewSpan.textContent = session.first_user_message_preview || "Chat session";

                    const timestampSpan = document.createElement('span');
                    timestampSpan.className = 'history-item-timestamp';
                    timestampSpan.textContent = session.first_timestamp ? new Date(session.first_timestamp).toLocaleString() : 'N/A';

                    li.appendChild(previewSpan);
                    li.appendChild(timestampSpan);

                    li.addEventListener('click', () => {
                        if (currentSessionId !== session.session_id) {
                            currentSessionId = session.session_id;
                            localStorage.setItem(LS_SESSION_ID_KEY, currentSessionId);
                            console.log(`Switched to session: ${currentSessionId}`);
                            
                            hasViewedHistory = true; 
                            saveGamificationStats(); 

                            loadChatHistoryForSession(currentSessionId);
                            updateActiveSessionInPanel(currentSessionId);
                            checkAndAwardBadges(); 
                        }
                         if (historyPanel.classList.contains('open')) {
                            historyPanel.classList.remove('open');
                         }
                         if (personaSelectionScreen.style.opacity === "1") {
                             hidePersonaSelectionScreen(showChatUI);
                         } else if (chatUiContainer.style.opacity === "0") {
                             showChatUI();
                         }
                    });
                    historyList.appendChild(li);
                });
            }
            updateActiveSessionInPanel(currentSessionId);
        } catch (error) {
            console.error('Could not fetch chat sessions:', error);
            historyList.innerHTML = `<li class="px-2 py-1 text-sm text-red-400 italic">Error loading sessions.</li>`;
        }
    }
    function updateActiveSessionInPanel(activeSessionId) { 
        const items = historyList.querySelectorAll('.history-item');
        items.forEach(item => {
            if (item.dataset.sessionId === activeSessionId) {
                item.classList.add('active-session');
            } else {
                item.classList.remove('active-session');
            }
        });
    }
    async function loadChatHistoryForSession(sessionId) { 
        if (!chatMessagesContainer || !sessionId) return;
        chatMessagesContainer.innerHTML = ''; 
        showEmptySessionPlaceholder(false); 

        try {
            const response = await fetch(`/get_history?session_id=${sessionId}`);
            if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(errData.error || `HTTP error! Status: ${response.status}`);
            }
            const history = await response.json();

            if (history.error) {
                console.error("Error fetching history from backend:", history.error, history.details || '');
                addMessageToChat(`System: Could not load chat history - ${history.error}`, 'system-info', true); 
                return;
            }
            if (history.length === 0) {
                showEmptySessionPlaceholder(true); 
            } else {
                history.forEach(log => {
                    if (log.user_message) {
                        addMessageToChat(log.user_message, 'user', true);
                    }
                    if (log.ei_response) {
                        addMessageToChat(log.ei_response, 'ei', true);
                    }
                });
            }
            setTimeout(() => {
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            }, 100);

        } catch (error) {
            console.error(`Could not fetch chat history for session ${sessionId}:`, error);
            addMessageToChat(`System: Failed to load chat history. ${error.message}`, 'system-info', true); 
            showEmptySessionPlaceholder(false); 
        }
    }

    function showPersonaSelectionScreen() { 
        if (personaSelectionScreen) {
            hideChatUI();
            personaSelectionScreen.style.display = 'flex';
            anime({ targets: personaSelectionScreen, opacity: 1, duration: 800, easing: 'easeInExpo' });
        }
    }
    function hidePersonaSelectionScreen(callback) { 
        if (personaSelectionScreen) {
            anime({
                targets: personaSelectionScreen, opacity: 0, duration: 700, easing: 'easeOutExpo',
                complete: () => {
                    personaSelectionScreen.style.display = 'none';
                    if (callback) callback();
                }
            });
        } else if (callback) {
            callback();
        }
    }
    function showChatUI() { 
        if (chatUiContainer) {
            showTypingIndicator(false);
            chatUiContainer.style.display = 'flex';
            anime({
                targets: chatUiContainer,
                opacity: 1,
                duration: 1000,
                easing: 'easeInExpo',
            });
        }
    }
    function hideChatUI() {
        if (chatUiContainer) {
            anime({
                targets: chatUiContainer,
                opacity: 0,
                duration: 500,
                easing: 'easeOutExpo',
                complete: () => {
                    chatUiContainer.style.display = 'none';
                }
            });
        }
    }

    personaCards.forEach(card => {
        card.addEventListener('click', () => {
            currentPersona = card.getAttribute('data-persona');
            localStorage.setItem(LS_PERSONA_KEY, currentPersona);
            console.log(`Persona selected: ${currentPersona}`);

            if (!personasTried.includes(currentPersona)) {
                personasTried.push(currentPersona);
            }
            saveGamificationStats(); 

            hidePersonaSelectionScreen(() => {
                showChatUI();
                loadChatHistoryForSession(currentSessionId);
                checkAndAwardBadges(); 
            });
        });
    });

    if (chatForm) {
        chatForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const userMessage = messageInput.value.trim();

            if (!currentSessionId) {
                addMessageToChat("Error: No active session. Please start a new chat.", 'ei-error');
                return;
            }

            if (userMessage) {
                showEmptySessionPlaceholder(false);
                addMessageToChat(userMessage, 'user');
                messageInput.value = '';
                showTypingIndicator(true);

                totalMessagesSent++;
                
                try {
                    addXP(XP_PER_MESSAGE); 

                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify({
                            message: userMessage,
                            persona: currentPersona,
                            session_id: currentSessionId
                        }),
                    });
                    showTypingIndicator(false);
                    if (response.ok) {
                        const data = await response.json();
                        addMessageToChat(data.reply, 'ei');
                    } else {
                        const errorData = await response.json();
                        addMessageToChat(errorData.error || 'Error: Could not get a response.', 'ei-error');
                    }
                } catch (error) {
                    showTypingIndicator(false);
                    addMessageToChat('Error: Could not connect to the server. Please try again.', 'ei-error');
                } finally {
                    saveGamificationStats(); 
                    checkAndAwardBadges(); 
                }
            }
        });
    }
    
    if (messageInput) { 
        messageInput.addEventListener('input', () => {
            if (emptySessionPlaceholder && emptySessionPlaceholder.classList.contains('visible') &&
                chatMessagesContainer && chatMessagesContainer.children.length === 0) {
                 showEmptySessionPlaceholder(false);
            }
        });
        messageInput.addEventListener('focus', () => { 
            if (emptySessionPlaceholder && emptySessionPlaceholder.classList.contains('visible') &&
                chatMessagesContainer && chatMessagesContainer.children.length === 0) {
                 showEmptySessionPlaceholder(false);
            }
        });
    }

    function addMessageToChat(message, sender, isHistory = false) { 
        if (!chatMessagesContainer) return;
        if (!isHistory && sender !== 'system-info') {
            showEmptySessionPlaceholder(false);
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-bubble');

        if (sender === 'user') {
            messageDiv.classList.add('user-bubble', 'bg-violet-500', 'text-white', 'ml-auto', 'rounded-br-none');
        } else if (sender === 'ei') {
            messageDiv.classList.add('ei-bubble', 'bg-violet-700/60', 'text-violet-100', 'mr-auto', 'rounded-bl-none');
        } else if (sender === 'ei-error' || sender === 'system-info') {
            messageDiv.classList.add('ei-bubble', 'text-slate-100', 'mr-auto', 'rounded-bl-none', 'text-xs', 'italic');
            if (sender === 'ei-error') {
                messageDiv.classList.add('bg-red-500/70');
            } else {
                messageDiv.classList.add('bg-slate-600/70');
            }
        }
        messageDiv.textContent = message;
        chatMessagesContainer.appendChild(messageDiv);

        if (!isHistory) {
            messageDiv.style.opacity = '0';
            messageDiv.style.transform = 'translateY(20px)';
            anime({ targets: messageDiv, opacity: 1, translateY: 0, duration: 500, easing: 'easeOutExpo' });
        }
         chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
    function showTypingIndicator(show) { 
        if (typingIndicator) { typingIndicator.style.display = show ? 'block' : 'none'; }
    }

    function animateDynamicBackground() { 
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

    function initParticleAnimation() { 
        const canvas = document.getElementById('particle-canvas');
        if (!canvas) { console.error('Particle canvas not found!'); return; }
        const ctx = canvas.getContext('2d');
        let particlesArray = [];
        const numberOfParticles = 50;
        function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2.5 + 0.5;
                this.speedX = (Math.random() * 0.4 - 0.2); this.speedY = (Math.random() * 0.4 - 0.2);
                this.color = `hsla(${Math.random() * 60 + 220}, 70%, 80%, ${Math.random() * 0.3 + 0.1})`;
            }
            update() {
                this.x += this.speedX; this.y += this.speedY;
                if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
                if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            }
            draw() {
                ctx.fillStyle = this.color; ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            }
        }
        function initParticles() {
            particlesArray = [];
            for (let i = 0; i < numberOfParticles; i++) { particlesArray.push(new Particle()); }
        }
        initParticles();
        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particlesArray.length; i++) { particlesArray[i].update(); particlesArray[i].draw(); }
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
    }

    function animateWelcomeSequence() { 
        const welcomeText = "Greetings, wanderer of the digital ether. I am Ei. What echoes of the heart do you seek today?";
        const projectQuoteText = "Ei- Echo of Her";
        const poeticWelcomeEl = document.getElementById('poetic-welcome');
        const projectQuoteEl = document.getElementById('project-quote');

        if (welcomeContainer) {
            anime({
                targets: welcomeContainer,
                opacity: [0,1],
                duration: 500,
                easing: 'easeInExpo',
                complete: () => {
                    if (poeticWelcomeEl) {
                        poeticWelcomeEl.textContent = welcomeText;
                        anime({ targets: poeticWelcomeEl, opacity: [0, 1], translateY: [20, 0], duration: 2000, easing: 'easeOutExpo', delay: 200 });
                    }
                    if (projectQuoteEl) {
                        projectQuoteEl.textContent = projectQuoteText;
                        anime({ targets: projectQuoteEl, opacity: [0, 1], translateY: [10, 0], duration: 1800, easing: 'easeOutExpo', delay: 700 });
                    }
                }
            });
        } else {
            console.warn("welcomeContainer not found for animation.");
        }
    }

    function animateCelestialFragment() { 
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
            anime({ targets: glowFilterGaussian, attribute: 'stdDeviation', values: ['3', '4', '3'], loop: true, direction: 'alternate', duration: 3500, easing: 'easeInOutSine', delay: 500 });
        }
        particles.forEach((particle) => {
            if (particle) {
                anime({
                    targets: particle,
                    opacity: [{ value: 0, duration: 0 }, { value: anime.random(0.5, 0.9), duration: anime.random(1000, 2000) }, { value: 0, duration: anime.random(1000, 2000), delay: anime.random(2000, 4000) }],
                    translateX: [{ value: () => anime.random(-5, 5), duration: anime.random(3000, 5000)}, { value: () => anime.random(-5, 5), duration: anime.random(3000, 5000)}, { value: 0, duration: anime.random(3000, 5000) }],
                    translateY: [{ value: () => anime.random(-5, 5), duration: anime.random(3000, 5000)}, { value: () => anime.random(-5, 5), duration: anime.random(3000, 5000)}, { value: 0, duration: anime.random(3000, 5000) }],
                    loop: true, easing: 'easeInOutSine', delay: anime.random(0, 2000)
                });
            }
        });
    }

    // --- START THE APP ---
    initializeApp();

});
