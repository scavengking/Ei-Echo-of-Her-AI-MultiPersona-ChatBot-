// static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- KEY DOM ELEMENTS ---
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const emptySessionPlaceholder = document.getElementById('empty-session-placeholder');
    const earnedBadgesContainer = document.getElementById('earned-badges-container');
    const xpLevelEl = document.getElementById('xp-level');
    const xpBarEl = document.getElementById('xp-bar');
    const xpCurrentEl = document.getElementById('xp-current');
    const xpNextLevelEl = document.getElementById('xp-next-level');
    const historyPanel = document.getElementById('history-panel');
    const historyPanelToggle = document.getElementById('history-panel-toggle');
    const historyList = document.getElementById('history-list');
    const newChatButton = document.getElementById('new-chat-button');
    const personaQuickSelect = document.getElementById('persona-quick-select');
    const usernameDisplay = document.getElementById('username-display');
    const subscriptionLink = document.getElementById('subscription-link');
    
    // Elements for the persona overlay
    const personaOverlay = document.getElementById('persona-selection-overlay');
    const personaCards = document.querySelectorAll('.persona-card');
    const continueToChatBtn = document.getElementById('continue-to-chat-btn');
    const closePersonaBtn = document.getElementById('close-persona-btn');

    if (!chatForm) {
        console.log("Not on the main chat page. main.js will not run.");
        return;
    }

    // --- STATE VARIABLES ---
    const LS_PERSONA_KEY = 'ei_selected_persona';
    const LS_SESSION_ID_KEY = 'ei_current_session_id';
    const LS_PERSONA_INTRO_KEY = 'ei_has_seen_persona_intro_v1'; // We use this to track first selection

    let currentPersona = localStorage.getItem(LS_PERSONA_KEY) || 'friendly';
    let currentSessionId = localStorage.getItem(LS_SESSION_ID_KEY);
    let latestRequestTimestamp = 0;
    
    let userProfile = {
        username: 'User',
        xp: 0,
        badges: [],
        subscription_status: 'none'
    };
    let currentUserLevel = 1;

    // --- BADGE DEFINITIONS & GAMIFICATION STATE ---
    const XP_PER_MESSAGE = 15;
    const LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5500];
    const ALL_PERSONA_IDS = ["friendly", "sage", "coding", "sarcastic", "scifi"];
    const badges = {
        firstEcho: { id: 'firstEcho', name: 'First Echo', description: "You've initiated your first conversation with Ei.", emoji: '💬', unlocked: false },
        curiousMind: { id: 'curiousMind', name: 'Curious Mind', description: "Explored at least 2 different facets of Ei's personality.", emoji: '🎭', unlocked: false },
        level2Reached: { id: 'level2Reached', name: 'Level 2 Reached', description: "Your connection with Ei is growing stronger!", emoji: '✨', unlocked: false },
        sessionWeaver: { id: 'sessionWeaver', name: 'Session Weaver', description: "Weaving at least 3 threads of conversation.", emoji: '🧵', unlocked: false },
        timeTraveler: { id: 'timeTraveler', name: 'Time Traveler', description: "Revisited a past conversation stream.", emoji: '🕰️', unlocked: false },
        dedicatedListener: { id: 'dedicatedListener', name: 'Dedicated Listener', description: "Listened and responded thoughtfully (25 messages sent).", emoji: '🎧', unlocked: false },
        personaVirtuoso: { id: 'personaVirtuoso', name: 'Persona Virtuoso', description: "Experienced all primary facets of Ei (all 5 personas tried).", emoji: '🌟', unlocked: false }
    };

    // --- CORRECTED PERSONA OVERLAY LOGIC ---
    function setupPersonaOverlay() {
        let selectedPersona = currentPersona;
        
        // Set initial active card
        personaCards.forEach(card => {
            if (card.dataset.persona === selectedPersona) {
                card.classList.add('active');
            }
        });

        personaCards.forEach(card => {
            card.addEventListener('click', () => {
                personaCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                selectedPersona = card.dataset.persona;
            });
        });

        // Close button listener
        if(closePersonaBtn) {
            closePersonaBtn.addEventListener('click', () => {
                // Only allow closing if a persona has been chosen before
                if (localStorage.getItem(LS_PERSONA_KEY)) {
                    personaOverlay.classList.remove('visible');
                } else {
                    alert("Please select a persona to continue.");
                }
            });
        }

        // Continue button listener
        continueToChatBtn.addEventListener('click', () => {
            currentPersona = selectedPersona;
            localStorage.setItem(LS_PERSONA_KEY, currentPersona);
            if (personaQuickSelect) personaQuickSelect.value = currentPersona;
            
            // This key is for badge logic, not for showing the panel
            localStorage.setItem(LS_PERSONA_INTRO_KEY, 'true'); 
            personaOverlay.classList.remove('visible');

            // Log persona usage for badges
            let personasTried = JSON.parse(localStorage.getItem('ei_personas_tried_v2') || '[]');
            if (!personasTried.includes(currentPersona)) {
                personasTried.push(currentPersona);
                localStorage.setItem('ei_personas_tried_v2', JSON.stringify(personasTried));
            }
            checkAndAwardBadges();
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && personaOverlay.classList.contains('visible')) {
                // Only allow closing if a persona has been chosen before
                 if (localStorage.getItem(LS_PERSONA_KEY)) {
                    personaOverlay.classList.remove('visible');
                }
            }
        });
    }

    // --- CORRECTED INITIALIZATION LOGIC ---
    async function initializeApp() {
        try {
            const response = await fetch('/get_user_profile');
            if (!response.ok) {
                window.location.href = '/auth';
                return;
            }
            userProfile = await response.json();
            
            if (usernameDisplay) usernameDisplay.textContent = userProfile.username;
            updateSubscriptionStatusUI(userProfile.subscription_status);
            
            updateBadgeUnlockStatus();
            recalculateLevelFromXP();
            updateXPDisplay();
            displayEarnedBadges();

            if (personaQuickSelect) personaQuickSelect.value = currentPersona;
            
            await loadChatSessions();
            
            if (currentSessionId) {
                await loadChatHistoryForSession(currentSessionId);
            } else {
                startNewChatSession(false);
            }
            
            // Always setup the listeners for the persona panel
            setupPersonaOverlay();
            
            // Show the persona overlay IF no persona has EVER been selected
            if (!localStorage.getItem(LS_PERSONA_KEY)) {
                personaOverlay.classList.add('visible');
            }
            
            anime({ targets: '#main-content-area', opacity: [0, 1], duration: 800, easing: 'easeInExpo' });

        } catch (error) {
            console.error("Initialization failed:", error);
            window.location.href = '/auth';
        }
    }

    // --- ALL OTHER FUNCTIONS (No Changes) ---

    function updateBadgeUnlockStatus() {
        userProfile.badges.forEach(badgeId => {
            if (badges[badgeId]) badges[badgeId].unlocked = true;
        });
    }

    function awardBadge(badgeId) {
        if (badges[badgeId] && !badges[badgeId].unlocked) {
            badges[badgeId].unlocked = true;
            userProfile.badges.push(badgeId);
            showBadgeNotification(badges[badgeId]);
            displayEarnedBadges();
            syncGamificationWithBackend({ badges: userProfile.badges });
        }
    }
    
    async function syncGamificationWithBackend(data) {
        try {
            await fetch('/update_gamification', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error("Failed to sync gamification data:", error);
        }
    }

    function addXP(amount) {
        userProfile.xp += amount;
        const oldLevel = currentUserLevel;
        recalculateLevelFromXP();
        updateXPDisplay();
        if (currentUserLevel > oldLevel) {
            addMessageToChat(`Congratulations! You've reached Level ${currentUserLevel}! ✨`, 'system-info');
        }
        syncGamificationWithBackend({ xp: userProfile.xp });
        checkAndAwardBadges();
    }
    
    function recalculateLevelFromXP() {
        currentUserLevel = LEVEL_THRESHOLDS.findIndex(threshold => userProfile.xp < threshold);
        if (currentUserLevel === -1) currentUserLevel = LEVEL_THRESHOLDS.length; // Max level
    }
    
    function updateXPDisplay() {
        if (!xpLevelEl) return;
        xpLevelEl.textContent = currentUserLevel;
        const xpStartCurrentLevel = LEVEL_THRESHOLDS[currentUserLevel - 1] || 0;
        const xpNeededForNextLevel = LEVEL_THRESHOLDS[currentUserLevel] || userProfile.xp;
        
        if (xpNeededForNextLevel <= xpStartCurrentLevel) {
             xpBarEl.style.width = "100%";
             xpCurrentEl.textContent = userProfile.xp;
             xpNextLevelEl.textContent = "MAX";
        } else {
            const xpIntoCurrentLevel = userProfile.xp - xpStartCurrentLevel;
            const xpRangeForCurrentLevel = xpNeededForNextLevel - xpStartCurrentLevel;
            let progress = Math.min(100, (xpIntoCurrentLevel / xpRangeForCurrentLevel) * 100);
            xpBarEl.style.width = `${progress}%`;
            xpCurrentEl.textContent = userProfile.xp;
            xpNextLevelEl.textContent = xpNeededForNextLevel;
        }
    }

    function displayEarnedBadges() {
        if (!earnedBadgesContainer) return;
        earnedBadgesContainer.innerHTML = '';
        if (userProfile.badges.length === 0) return;
        
        userProfile.badges.forEach(badgeId => {
            const badge = badges[badgeId];
            if (badge) {
                const badgeElement = document.createElement('div');
                badgeElement.className = 'tooltip text-2xl';
                badgeElement.innerHTML = `${badge.emoji}<span class="tooltiptext">${badge.name}: ${badge.description}</span>`;
                earnedBadgesContainer.appendChild(badgeElement);
            }
        });
    }

    function checkAndAwardBadges() {
        const personasTried = JSON.parse(localStorage.getItem('ei_personas_tried_v2') || '[]');
        const totalMessages = document.querySelectorAll('.user-bubble').length;
        const sessionCount = historyList.children.length;

        if (totalMessages >= 1) awardBadge('firstEcho');
        if (personasTried.length >= 2) awardBadge('curiousMind');
        if (currentUserLevel >= 2) awardBadge('level2Reached');
        if (sessionCount >= 3) awardBadge('sessionWeaver');
        if (localStorage.getItem('ei_has_viewed_history_v2') === 'true') awardBadge('timeTraveler');
        if (totalMessages >= 25) awardBadge('dedicatedListener');
        if (ALL_PERSONA_IDS.every(id => personasTried.includes(id))) awardBadge('personaVirtuoso');
    }

    function updateSubscriptionStatusUI(status) {
        if (status === 'active' && subscriptionLink) {
            subscriptionLink.textContent = 'Pro Plan Active';
            subscriptionLink.classList.remove('bg-green-600', 'hover:bg-green-500');
            subscriptionLink.classList.add('bg-blue-600', 'cursor-default');
            subscriptionLink.href = '#';
        }
    }

    function startNewChatSession(loadHistory = true) {
        currentSessionId = uuid.v4();
        localStorage.setItem(LS_SESSION_ID_KEY, currentSessionId);
        if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
        showTypingIndicator(false);
        showEmptySessionPlaceholder(true);
        if (loadHistory) loadChatSessions();
        updateActiveSessionInPanel(currentSessionId);
    }

    async function loadChatSessions() {
        if (!historyList) return; 
        try {
            const response = await fetch('/get_sessions');
            if (!response.ok) throw new Error('Failed to fetch sessions');

            const sessions = await response.json();
            historyList.innerHTML = '';

            if (sessions.length > 0) {
                sessions.forEach(session => {
                    const li = document.createElement('li');
                    li.className = 'history-item flex justify-between items-center';
                    li.dataset.sessionId = session.session_id;

                    const textContainer = document.createElement('div');
                    textContainer.className = 'flex-grow cursor-pointer p-2';
                    textContainer.innerHTML = `<span class="block text-sm truncate">${session.first_user_message_preview || "Chat session"}</span><span class="text-xs text-gray-400">${new Date(session.first_timestamp).toLocaleString()}</span>`;
                    textContainer.addEventListener('click', () => switchSession(session.session_id));

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '🗑️';
                    deleteBtn.className = 'p-1 ml-2 text-lg text-gray-500 hover:text-red-400 transition-colors rounded-full';
                    deleteBtn.title = 'Delete Session';
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this conversation?')) {
                            const deleteResponse = await fetch(`/delete_session/${session.session_id}`, { method: 'DELETE' });
                            if (deleteResponse.ok) {
                                li.remove();
                                if (currentSessionId === session.session_id) startNewChatSession(true);
                            } else alert('Failed to delete session.');
                        }
                    });

                    li.appendChild(textContainer);
                    li.appendChild(deleteBtn);
                    historyList.appendChild(li);
                });
            }
            updateActiveSessionInPanel(currentSessionId);
        } catch (error) {
            console.error('Could not fetch chat sessions:', error);
            historyList.innerHTML = `<li class="px-2 py-1 text-sm text-red-400 italic">Error loading sessions.</li>`;
        }
    }
    
    function switchSession(sessionId) {
        if (currentSessionId !== sessionId) {
            currentSessionId = sessionId;
            localStorage.setItem(LS_SESSION_ID_KEY, currentSessionId);
            localStorage.setItem('ei_has_viewed_history_v2', 'true');
            checkAndAwardBadges();
            loadChatHistoryForSession(currentSessionId);
            updateActiveSessionInPanel(currentSessionId);
        }
        if (historyPanel.classList.contains('open')) {
            historyPanel.classList.remove('open');
        }
    }

    async function loadChatHistoryForSession(sessionId) {
        if (!chatMessagesContainer || !sessionId) return;
        chatMessagesContainer.innerHTML = '';
        showEmptySessionPlaceholder(false);
        try {
            const response = await fetch(`/get_history?session_id=${sessionId}`);
            const history = await response.json();
            if (history.error) throw new Error(history.error);

            if (history.length === 0) {
                showEmptySessionPlaceholder(true);
            } else {
                history.forEach(log => {
                    if (log.user_message) addMessageToChat(log.user_message, 'user', true);
                    if (log.ei_response) addMessageToChat(log.ei_response, 'ei', true);
                });
            }
            setTimeout(() => chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight, 100);
        } catch (error) {
            addMessageToChat(`System: Failed to load chat history. ${error.message}`, 'system-info', true);
        }
    }

    function showEmptySessionPlaceholder(show) {
        if (emptySessionPlaceholder) emptySessionPlaceholder.classList.toggle('visible', show);
    }

    chatForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const userMessage = messageInput.value.trim();
        if (!currentSessionId || !userMessage) return;

        addMessageToChat(userMessage, 'user');
        messageInput.value = '';
        showTypingIndicator(true);

        const requestTimestamp = Date.now();
        latestRequestTimestamp = requestTimestamp;

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, persona: currentPersona, session_id: currentSessionId }),
            });
            const data = await response.json();
            
            if (requestTimestamp < latestRequestTimestamp) {
                showTypingIndicator(false);
                return;
            }

            showTypingIndicator(false);
            if (response.ok) {
                addMessageToChat(data.reply, 'ei');
                addXP(XP_PER_MESSAGE);
            } else {
                addMessageToChat(data.error || 'Error: Could not get a response.', 'ei-error');
            }
        } catch (error) {
            showTypingIndicator(false);
            addMessageToChat('Error: Could not connect to the server.', 'ei-error');
        }
    });

    newChatButton.addEventListener('click', () => {
        startNewChatSession(true);
        if (historyPanel.classList.contains('open')) {
            historyPanel.classList.remove('open');
        }
    });

    personaQuickSelect.addEventListener('change', function() {
        currentPersona = this.value;
        localStorage.setItem(LS_PERSONA_KEY, currentPersona);
        let personasTried = JSON.parse(localStorage.getItem('ei_personas_tried_v2') || '[]');
        if (!personasTried.includes(currentPersona)) {
            personasTried.push(currentPersona);
            localStorage.setItem('ei_personas_tried_v2', JSON.stringify(personasTried));
        }
        checkAndAwardBadges();
    });
    
    historyPanelToggle.addEventListener('click', () => historyPanel.classList.toggle('open'));
    
    function addMessageToChat(message, sender, isHistory = false) {
        if (!chatMessagesContainer) return null;
        if (!isHistory && sender !== 'system-info') showEmptySessionPlaceholder(false);
        
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'} w-full`;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-bubble');

        if (sender === 'user') {
            messageDiv.classList.add('user-bubble', 'bg-violet-600', 'text-white', 'rounded-br-none');
            messageDiv.textContent = message;
        } else if (sender === 'ei') {
            messageDiv.classList.add('ei-bubble', 'bg-gray-700', 'text-gray-200', 'rounded-bl-none');
            messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(message));
        } else { // System messages
            messageDiv.className = 'text-center text-sm text-gray-400 italic w-full py-2';
            messageDiv.textContent = message;
            chatMessagesContainer.appendChild(messageDiv);
            return messageDiv;
        }

        messageWrapper.appendChild(messageDiv);
        chatMessagesContainer.appendChild(messageWrapper);
        if (!isHistory) {
            anime({ targets: messageDiv, opacity: [0, 1], translateY: [10, 0], duration: 400, easing: 'easeOutQuad' });
        }
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        return messageDiv;
    }

    function showTypingIndicator(show) {
        if(typingIndicator) typingIndicator.style.display = show ? 'block' : 'none';
    }

    function updateActiveSessionInPanel(activeSessionId) {
        if (!historyList) return;
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.classList.toggle('active-session', item.dataset.sessionId === activeSessionId);
        });
    }

    function showBadgeNotification(badge) {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'fixed top-5 right-5 bg-violet-700 text-white p-4 rounded-lg shadow-xl z-50';
        notificationDiv.innerHTML = `<p class="font-semibold text-lg">Badge Unlocked! ${badge.emoji}</p><p class="text-sm">${badge.name}</p>`;
        document.body.appendChild(notificationDiv);
        anime({
            targets: notificationDiv,
            opacity: [0, 1],
            translateY: [-20, 0],
            duration: 500,
            complete: () => {
                anime({
                    targets: notificationDiv,
                    opacity: 0,
                    translateY: [0, -20],
                    duration: 500,
                    delay: 4000,
                    complete: () => { notificationDiv.remove(); }
                });
            }
        });
     }

    // --- START THE APP ---
    initializeApp();
});
