// static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    animateWelcomeSequence(); // Handles welcome text animations
    animateCelestialFragment(); // Handles celestial fragment animations

    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const welcomeContainer = document.getElementById('welcome-message-container');
    const chatUiContainer = document.getElementById('chat-ui-container');

    // Transition from welcome to chat UI
    setTimeout(() => {
        if (welcomeContainer) {
            anime({
                targets: welcomeContainer,
                opacity: 0,
                duration: 1000,
                easing: 'easeOutExpo',
                complete: () => {
                    welcomeContainer.style.display = 'none'; // Hide after fading
                    if (chatUiContainer) {
                        chatUiContainer.style.opacity = '0'; // Ensure it starts from 0 before fade-in
                        chatUiContainer.style.display = 'flex'; // Make it visible for animation
                        anime({
                            targets: chatUiContainer,
                            opacity: 1,
                            duration: 1000,
                            easing: 'easeInExpo'
                        });
                    }
                }
            });
        }
    }, 4000); // Delay before fading out welcome and fading in chat UI (adjust as needed)


    if (chatForm) {
        chatForm.addEventListener('submit', async function(event) {
            event.preventDefault(); // Prevent default form submission (page reload)
            const userMessage = messageInput.value.trim();

            if (userMessage) {
                addMessageToChat(userMessage, 'user');
                messageInput.value = ''; // Clear the input field
                showTypingIndicator(true);

                try {
                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ message: userMessage }),
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

    function addMessageToChat(message, sender) {
        if (!chatMessagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-bubble');
        // Apply Tailwind classes directly or use predefined CSS classes
        if (sender === 'user') {
            messageDiv.classList.add('user-bubble', 'bg-violet-500', 'text-white', 'ml-auto', 'rounded-br-none');
        } else if (sender === 'ei') {
            messageDiv.classList.add('ei-bubble', 'bg-violet-700/60', 'text-violet-100', 'mr-auto', 'rounded-bl-none');
        } else if (sender === 'ei-error') {
            messageDiv.classList.add('ei-bubble', 'bg-red-500/70', 'text-white', 'mr-auto', 'rounded-bl-none');
        }
        
        messageDiv.textContent = message; // Using textContent to prevent XSS

        // Animation for new message bubble
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';
        chatMessagesContainer.appendChild(messageDiv);

        anime({
            targets: messageDiv,
            opacity: 1,
            translateY: 0,
            duration: 500,
            easing: 'easeOutExpo'
        });

        // Scroll to the bottom of the chat messages
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function showTypingIndicator(show) {
        if (typingIndicator) {
            typingIndicator.style.display = show ? 'block' : 'none';
        }
    }
});


// --- Animation functions from previous steps ---
function animateWelcomeSequence() {
    const welcomeText = "Greetings, wanderer of the digital ether. I am Ei. What echoes of the heart do you seek today?";
    const projectQuoteText = "Ei- Echo of Her";

    const poeticWelcomeEl = document.getElementById('poetic-welcome');
    const projectQuoteEl = document.getElementById('project-quote');

    if (poeticWelcomeEl) {
        poeticWelcomeEl.innerHTML = welcomeText;
        anime({
            targets: poeticWelcomeEl,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 2500,
            easing: 'easeOutExpo',
            delay: 500
        });
    }

    if (projectQuoteEl) {
        projectQuoteEl.innerHTML = projectQuoteText;
        anime({
            targets: projectQuoteEl,
            opacity: [0, 1],
            translateY: [10, 0],
            duration: 2000,
            easing: 'easeOutExpo',
            delay: anime.stagger(100, {start: 1500})
        });
    }
}

function animateCelestialFragment() {
    const fragmentShapeGroup = document.getElementById('fragment-shape-group');
    const fragmentInner = document.getElementById('fragment-inner');
    const particles = [
        document.getElementById('particle-1'),
        document.getElementById('particle-2'),
        document.getElementById('particle-3')
    ].filter(p => p != null);

    if (fragmentShapeGroup) {
        anime({
            targets: fragmentShapeGroup,
            rotate: '360',
            loop: true,
            duration: 30000,
            easing: 'linear'
        });
    }

    if (fragmentInner) {
        anime({
            targets: fragmentInner,
            opacity: [0.4, 0.9, 0.4],
            loop: true,
            direction: 'alternate',
            duration: 4000,
            easing: 'easeInOutSine'
        });
    }
    
    const glowFilterGaussian = document.querySelector('#softGlowFilter feGaussianBlur');
    if (glowFilterGaussian) {
        anime({
            targets: glowFilterGaussian,
            stdDeviation: [3, 4, 3],
            loop: true,
            direction: 'alternate',
            duration: 3500,
            easing: 'easeInOutSine',
            delay: 500
        });
    }

    particles.forEach((particle) => {
        if (particle) {
            anime({
                targets: particle,
                opacity: [
                    { value: 0, duration: 0 },
                    { value: anime.random(0.5, 0.9), duration: anime.random(1000, 2000) },
                    { value: 0, duration: anime.random(1000, 2000), delay: anime.random(2000, 4000) }
                ],
                translateX: [
                    { value: `${anime.random(-5, 5)}px`, duration: anime.random(3000, 5000)},
                    { value: `${anime.random(-5, 5)}px`, duration: anime.random(3000, 5000)},
                    { value: '0px', duration: anime.random(3000, 5000) }
                ],
                translateY: [
                    { value: `${anime.random(-5, 5)}px`, duration: anime.random(3000, 5000)},
                    { value: `${anime.random(-5, 5)}px`, duration: anime.random(3000, 5000)},
                    { value: '0px', duration: anime.random(3000, 5000) }
                ],
                loop: true,
                easing: 'easeInOutSine',
                delay: anime.random(0, 2000)
            });
        }
    });
}
