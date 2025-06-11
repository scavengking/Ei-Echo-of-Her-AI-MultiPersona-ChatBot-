// static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- KEY DOM ELEMENTS ---
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const chatUiContainer = document.getElementById('chat-ui-container');
    const emptySessionPlaceholder = document.getElementById('empty-session-placeholder');
    const earnedBadgesContainer = document.getElementById('earned-badges-container');
    const eiNameDisplay = document.getElementById('ei-name-display');
    const eiAvatarModelViewer = document.getElementById('ei-avatar-model-viewer');
    const xpLevelEl = document.getElementById('xp-level');
    const xpBarEl = document.getElementById('xp-bar');
    const xpCurrentEl = document.getElementById('xp-current');
    const xpNextLevelEl = document.getElementById('xp-next-level');
    const historyPanel = document.getElementById('history-panel');
    const historyPanelToggle = document.getElementById('history-panel-toggle');
    const historyList = document.getElementById('history-list');
    const newChatButton = document.getElementById('new-chat-button');
    const mainContentArea = document.getElementById('main-content-area');
    const personaQuickSelect = document.getElementById('persona-quick-select');
    const usernameDisplay = document.getElementById('username-display');
    const subscriptionLink = document.getElementById('subscription-link');

    // --- STATE VARIABLES ---
    const LS_PERSONA_KEY = 'ei_selected_persona';
    const LS_SESSION_ID_KEY = 'ei_current_session_id';

    let currentPersona = localStorage.getItem(LS_PERSONA_KEY) || 'friendly';
    let currentSessionId = localStorage.getItem(LS_SESSION_ID_KEY);
    let latestRequestTimestamp = 0;
    
    // User profile data - will be fetched from backend
    let userProfile = {
        username: 'User',
        xp: 0,
        badges: [],
        subscription_status: 'none'
    };
    let currentUserLevel = 1;


    // --- PERSONA CONFIGURATION ---
    const personaConfig = {
        friendly: { name: "Ei (Friendly)", avatar: "https://models.readyplayer.me/683424f141bfeee7cc66dac1.glb" },
        sage: { name: "Ei (Sage)", avatar: "https://models.readyplayer.me/683430d3ab2f2a1923a50157.glb" },
        coding: { name: "Ei (Coding Mentor)", avatar: "https://models.readyplayer.me/68357d10eff9e447b093ad69.glb" },
        sarcastic: { name: "Ei (Sarcastic)", avatar: "https://models.readyplayer.me/68357e47c24bd6b4127b13b5.glb" },
        scifi: { name: "Ei (Sci-Fi Bot)", avatar: "https://models.readyplayer.me/68357ed7a4fff27714a9d6f2.glb" },
        default: { name: "Ei", avatar: "https://models.readyplayer.me/68357ed7a4fff27714a9d6f2.glb" }
    };

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
    
    // --- CORE INITIALIZATION ---
    async function initializeApp() {
        animateDynamicBackground();
        initParticleAnimation();
        
        try {
            const response = await fetch('/get_user_profile');
            if (!response.ok) {
                // If we can't get profile, it likely means session expired.
                window.location.href = '/login';
                return;
            }
            userProfile = await response.json();
            
            // Sync localStorage gamification stats with the backend profile
            await syncLocalGamificationToDB();

            if (usernameDisplay) usernameDisplay.textContent = userProfile.username;
            updateSubscriptionStatusUI(userProfile.subscription_status);
            
            updateBadgeUnlockStatus();
            recalculateLevelFromXP();
            updateXPDisplay();
            displayEarnedBadges();

            updateEiDisplay(currentPersona);
            if (personaQuickSelect) personaQuickSelect.value = currentPersona;
            
            await loadChatSessions(); // Load sessions after profile is fetched
            
            if (currentSessionId) {
                await loadChatHistoryForSession(currentSessionId);
            } else {
                startNewChatSession(false); // Start a new session if none exists
            }
            
            // Show the main UI
            chatUiContainer.style.display = 'flex';
            anime({ targets: chatUiContainer, opacity: 1, duration: 800, easing: 'easeInExpo' });

        } catch (error) {
            console.error("Initialization failed:", error);
            // Redirect to login on any critical failure
            window.location.href = '/login';
        }
    }
    
    // --- GAMIFICATION & DATA SYNC ---
    async function syncLocalGamificationToDB() {
        // This function is for one-time migration from old localStorage-based system
        // to the new database-backed system.
        const localXP = parseInt(localStorage.getItem('ei_user_xp'), 10) || 0;
        const localBadges = JSON.parse(localStorage.getItem('ei_earned_badges')) || [];

        if (localXP > userProfile.xp || localBadges.length > userProfile.badges.length) {
            console.log("Local gamification data found. Syncing with database...");
            const updates = {
                xp: Math.max(localXP, userProfile.xp),
                badges: [...new Set([...localBadges, ...userProfile.badges])]
            };
            await syncGamificationWithBackend(updates);
            userProfile.xp = updates.xp;
            userProfile.badges = updates.badges;
            // Clear old keys after successful sync
            localStorage.removeItem('ei_user_xp');
            localStorage.removeItem('ei_user_level');
            localStorage.removeItem('ei_earned_badges');
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

    function updateBadgeUnlockStatus() {
        userProfile.badges.forEach(badgeId => {
            if (badges[badgeId]) {
                badges[badgeId].unlocked = true;
            }
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

    function addXP(amount) {
        userProfile.xp += amount;
        const oldLevel = currentUserLevel;
        recalculateLevelFromXP();
        updateXPDisplay();
        if (currentUserLevel > oldLevel) {
            console.log(`Level Up! Reached Level ${currentUserLevel}`);
            addMessageToChat(`Congratulations! You've reached Level ${currentUserLevel}! ✨`, 'system-info');
        }
        syncGamificationWithBackend({ xp: userProfile.xp });
        checkAndAwardBadges();
    }
    
    function recalculateLevelFromXP() {
        let newLevel = 1;
        for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
            if (userProfile.xp >= LEVEL_THRESHOLDS[i]) {
                newLevel = i + 1;
            } else {
                break;
            }
        }
        currentUserLevel = newLevel;
    }
    
    function updateXPDisplay() {
        if (!xpLevelEl) return;
        xpLevelEl.textContent = currentUserLevel;
        const xpStartCurrentLevel = currentUserLevel > 1 ? LEVEL_THRESHOLDS[currentUserLevel - 1] : 0;
        const xpNeededForNextLevel = LEVEL_THRESHOLDS[currentUserLevel] || userProfile.xp;
        
        if (xpNeededForNextLevel <= xpStartCurrentLevel) { // Max level reached
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
        if (userProfile.badges.length === 0) {
            earnedBadgesContainer.style.display = 'none'; return;
        }
        earnedBadgesContainer.style.display = 'flex';
        userProfile.badges.forEach(badgeId => {
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
        if (status === 'active') {
            if (subscriptionLink) {
                subscriptionLink.textContent = 'Pro Plan Active';
                subscriptionLink.classList.remove('bg-green-600', 'hover:bg-green-500');
                subscriptionLink.classList.add('bg-blue-600', 'cursor-default');
                subscriptionLink.href = '#';
            }
        }
    }

    // --- Chat & Session Management ---
    function generateSessionId() { return uuid.v4(); }

    function startNewChatSession(loadHistory = true) {
        currentSessionId = generateSessionId();
        localStorage.setItem(LS_SESSION_ID_KEY, currentSessionId);
        console.log(`Started new session: ${currentSessionId}`);
        if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
        showTypingIndicator(false);
        showEmptySessionPlaceholder(true);
        if (loadHistory) loadChatSessions(); // Refresh session list
        updateActiveSessionInPanel(currentSessionId);
        return currentSessionId;
    }

    async function loadChatSessions() {
        if (!historyList) return; 

        try {
            const response = await fetch('/get_sessions');
            if (!response.ok) throw new Error('Failed to fetch sessions');

            const sessions = await response.json();
            historyList.innerHTML = ''; // Clear the list before populating

            if (sessions.length === 0) {
                const noSessionsLi = document.createElement('li');
                noSessionsLi.textContent = "No past sessions found.";
                noSessionsLi.className = 'px-2 py-1 text-sm text-gray-400 italic';
                historyList.appendChild(noSessionsLi);
            } else {
                sessions.forEach(session => {
                    const li = document.createElement('li');
                    li.className = 'history-item flex justify-between items-center'; // Use flexbox
                    li.dataset.sessionId = session.session_id;

                    // Create a container for the text content
                    const textContainer = document.createElement('div');
                    textContainer.className = 'flex-grow cursor-pointer p-2';
                    textContainer.innerHTML = `
                        <span class="history-item-preview">${session.first_user_message_preview || "Chat session"}</span>
                        <span class="history-item-timestamp">${new Date(session.first_timestamp).toLocaleString()}</span>
                    `;
                    textContainer.addEventListener('click', () => {
                        switchSession(session.session_id);
                    });

                    // Create the delete button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '🗑️'; // Trash can emoji
                    deleteBtn.className = 'p-1 ml-2 text-lg text-gray-500 hover:text-red-400 transition-colors rounded-full flex-shrink-0';
                    deleteBtn.title = 'Delete Session'; // Tooltip for hover
                    
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation(); // Prevent the session switch event from firing

                        if (window.confirm('Are you sure you want to permanently delete this entire conversation?')) {
                            try {
                                const deleteResponse = await fetch(`/delete_session/${session.session_id}`, {
                                    method: 'DELETE'
                                });

                                if (deleteResponse.ok) {
                                    // Remove the item from the UI instantly
                                    li.remove();
                                    // If the deleted session was the active one, start a new chat
                                    if (currentSessionId === session.session_id) {
                                        startNewChatSession(true);
                                    }
                                } else {
                                    const errorData = await deleteResponse.json();
                                    alert(`Failed to delete session: ${errorData.error}`);
                                }
                            } catch (error) {
                                console.error('Error deleting session:', error);
                                alert('An error occurred while trying to delete the session.');
                            }
                        }
                    });

                    // Append elements to the list item
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
            console.log(`Switched to session: ${currentSessionId}`);
            
            // Mark that user has viewed history for badge
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
                    if (log.user_message) {
                        const userBubble = addMessageToChat(log.user_message, 'user', true);
                        addEditControls(userBubble, log.message_id);
                    }
                    if (log.ei_response) {
                        addMessageToChat(log.ei_response, 'ei', true);
                    }
                });
            }
            setTimeout(() => chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight, 100);
        } catch (error) {
            console.error(`Could not fetch chat history for session ${sessionId}:`, error);
            addMessageToChat(`System: Failed to load chat history. ${error.message}`, 'system-info', true);
        }
    }

    function showEmptySessionPlaceholder(show) {
        if (emptySessionPlaceholder) emptySessionPlaceholder.classList.toggle('visible', show);
    }

    // --- Event Listeners ---
    if (chatForm) {
        chatForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const userMessage = messageInput.value.trim();
            if (!currentSessionId || !userMessage) return;

            // Add user message to UI immediately
            const userMessageBubble = addMessageToChat(userMessage, 'user');
            messageInput.value = '';
            showTypingIndicator(true);

            // Remove any previous "Edit" buttons to prevent editing old messages
            document.querySelectorAll('.edit-btn-container').forEach(btn => btn.remove());

            // --- Core Resubmit Logic ---
            const requestTimestamp = Date.now();
            latestRequestTimestamp = requestTimestamp;
            // -------------------------

            try {
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: userMessage, persona: currentPersona, session_id: currentSessionId }),
                });
                const data = await response.json();
                
                // --- Stale Response Check ---
                if (requestTimestamp < latestRequestTimestamp) {
                    console.log("Stale response ignored.", { requestTimestamp, latestRequestTimestamp });
                    showTypingIndicator(false);
                    return; // An edit/resubmit has happened, so ignore this response.
                }
                // ---------------------------

                showTypingIndicator(false);

                if (response.ok) {
                    addMessageToChat(data.reply, 'ei');
                    // Now that the AI has responded, add the Edit button to the user's message
                    addEditControls(userMessageBubble, data.user_message_id);
                } else {
                    addMessageToChat(data.error || 'Error: Could not get a response.', 'ei-error');
                }
            } catch (error) {
                showTypingIndicator(false);
                addMessageToChat('Error: Could not connect to the server.', 'ei-error');
            }
        });
    }

    if (newChatButton) {
        newChatButton.addEventListener('click', () => {
            startNewChatSession(true);
            if (historyPanel.classList.contains('open')) historyPanel.classList.remove('open');
        });
    }

    if (personaQuickSelect) {
        personaQuickSelect.addEventListener('change', function() {
            currentPersona = this.value;
            localStorage.setItem(LS_PERSONA_KEY, currentPersona);
            updateEiDisplay(currentPersona);
            
            // Track personas tried for badges
            let personasTried = JSON.parse(localStorage.getItem('ei_personas_tried_v2') || '[]');
            if (!personasTried.includes(currentPersona)) {
                personasTried.push(currentPersona);
                localStorage.setItem('ei_personas_tried_v2', JSON.stringify(personasTried));
            }
            checkAndAwardBadges();
        });
    }
    
    // History Panel Toggle
    if (historyPanelToggle) {
        historyPanelToggle.addEventListener('click', () => historyPanel.classList.toggle('open'));
    }
    
    // --- UI/Animation and Helper Functions ---
    function updateEiDisplay(personaId) {
         const config = personaConfig[personaId] || personaConfig.default;
        if (eiAvatarModelViewer) {
            if (config.avatar && config.avatar.endsWith('.glb')) {
                eiAvatarModelViewer.src = config.avatar;
                eiAvatarModelViewer.alt = `${config.name} Avatar`;
                eiAvatarModelViewer.style.display = 'block';
            } else {
                eiAvatarModelViewer.src = ''; 
                eiAvatarModelViewer.style.display = 'none';
            }
        }
        if (eiNameDisplay) {
            eiNameDisplay.textContent = config.name;
        }
    }
    
    // UPDATED function to handle Markdown rendering
    function addMessageToChat(message, sender, isHistory = false) {
        if (!chatMessagesContainer) return null;
        if (!isHistory && sender !== 'system-info' && emptySessionPlaceholder && emptySessionPlaceholder.classList.contains('visible')) {
            showEmptySessionPlaceholder(false);
        }
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-bubble', 'max-w-[70%]', 'break-words');

        if (sender === 'user') {
            messageDiv.classList.add('user-bubble', 'bg-violet-500', 'text-white', 'ml-auto', 'rounded-br-none', 'self-end');
            messageDiv.textContent = message; // User messages don't need Markdown parsing
        } else if (sender === 'ei') {
            messageDiv.classList.add('ei-bubble', 'bg-violet-700', 'bg-opacity-60', 'text-violet-100', 'mr-auto', 'rounded-bl-none', 'self-start');
            // Parse and sanitize the AI's Markdown response
            messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(message));
        } else if (sender === 'ei-error' || sender === 'system-info') {
            messageDiv.classList.add('ei-bubble', 'text-slate-100', 'mr-auto', 'rounded-bl-none', 'text-xs', 'italic', 'self-start', 'w-full', 'text-center', 'max-w-full');
            messageDiv.classList.add(sender === 'ei-error' ? 'bg-red-500' : 'bg-slate-600', 'bg-opacity-70');
            messageDiv.textContent = message;
        }

        chatMessagesContainer.appendChild(messageDiv);
        if (!isHistory) {
            anime({ targets: messageDiv, opacity: [0, 1], translateY: [20, 0], duration: 500, easing: 'easeOutExpo' });
        }
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        return messageDiv; // Return the created element
    }

    function addEditControls(messageBubble, messageId) {
        const editContainer = document.createElement('div');
        editContainer.className = 'edit-btn-container text-right -mt-2 mr-1';
        
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit & Resubmit';
        editButton.className = 'text-xs text-violet-300 hover:text-white underline px-2 py-1';
        editButton.onclick = () => {
            // Replace the bubble text with an input field
            const originalText = messageBubble.textContent;
            messageBubble.innerHTML = `
                <textarea class="w-full bg-violet-600 text-white p-2 rounded-lg text-sm" style="resize: none;">${originalText}</textarea>
                <div class="text-right mt-1">
                    <button class="save-btn text-xs bg-green-500 hover:bg-green-400 text-white px-2 py-1 rounded">Save</button>
                    <button class="cancel-btn text-xs bg-gray-500 hover:bg-gray-400 text-white px-2 py-1 rounded">Cancel</button>
                </div>
            `;
            editContainer.remove(); // Remove the edit button itself

            const textarea = messageBubble.querySelector('textarea');
            textarea.focus();
            textarea.style.height = textarea.scrollHeight + 'px'; // Auto-resize

            // Handle Save
            messageBubble.querySelector('.save-btn').onclick = async () => {
                const newMessage = textarea.value.trim();
                if (newMessage && newMessage !== originalText) {
                    // 1. Visually update the bubble
                    messageBubble.textContent = newMessage;

                    // 2. Update the message in the database (fire and forget)
                    fetch(`/edit_message/${messageId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ new_message: newMessage })
                    });

                    // 3. Resubmit to the /chat endpoint to get a new AI response
                    messageInput.value = newMessage;
                    chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
                } else {
                    // If no change, just revert to original text
                    messageBubble.textContent = originalText;
                }
            };

            // Handle Cancel
            messageBubble.querySelector('.cancel-btn').onclick = () => {
                messageBubble.textContent = originalText;
            };
        };

        editContainer.appendChild(editButton);
        messageBubble.insertAdjacentElement('afterend', editContainer);
    }

    function showTypingIndicator(show) {
        if(typingIndicator) typingIndicator.style.display = show ? 'block' : 'none';
    }
    function animateDynamicBackground() {
         const bodyStyle = document.body.style;
        let gradientState = { startH: 222, endH: 260 };
        bodyStyle.setProperty('--gradient-start-h', gradientState.startH);
        bodyStyle.setProperty('--gradient-end-h', gradientState.endH);
        anime({
            targets: gradientState,
            startH: [{ value: 240, duration: 10000 }, { value: 222, duration: 10000 }],
            endH:   [{ value: 280, duration: 10000 }, { value: 260, duration: 10000 }],
            duration: 20000, easing: 'linear', loop: true, direction: 'alternate',
            update: () => {
                bodyStyle.setProperty('--gradient-start-h', gradientState.startH);
                bodyStyle.setProperty('--gradient-end-h', gradientState.endH);
            }
        });
    }
    function initParticleAnimation() {
        const canvas = document.getElementById('particle-canvas');
        if (!canvas) return;
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
            draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); }
        }
        function initParticles() {
            for (let i = 0; i < numberOfParticles; i++) particlesArray.push(new Particle());
        }
        initParticles();
        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particlesArray.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
    }
    function showBadgeNotification(badge) {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'badge-notification fixed top-20 right-5 bg-violet-700 text-white p-4 rounded-lg shadow-xl z-50';
        notificationDiv.innerHTML = `<p class="font-semibold text-lg">Badge Unlocked! ${badge.emoji}</p><p class="text-sm">${badge.name}: ${badge.description}</p>`;
        document.body.appendChild(notificationDiv);
        anime({
            targets: notificationDiv,
            opacity: [0, 1], translateY: [-20, 0], duration: 500,
            complete: () => {
                anime({
                    targets: notificationDiv,
                    opacity: 0, translateY: [0, -20], duration: 500, delay: 4000,
                    complete: () => { notificationDiv.remove(); }
                });
            }
        });
     }
    function updateActiveSessionInPanel(activeSessionId) {
        if (!historyList) return;
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.classList.toggle('active-session', item.dataset.sessionId === activeSessionId);
        });
    }

    // --- START THE APP ---
    initializeApp();
});