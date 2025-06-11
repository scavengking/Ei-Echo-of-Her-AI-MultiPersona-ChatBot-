document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorMessageEl = document.getElementById('error-message');
    const successMessageEl = document.getElementById('success-message');

    const displayMessage = (element, message, isError = true) => {
        if (element) {
            element.textContent = message;
            element.classList.remove('hidden');
            if (isError) {
                 element.classList.add('text-red-400');
                 element.classList.remove('text-green-400');
            } else {
                 element.classList.remove('text-red-400');
                 element.classList.add('text-green-400');
            }
        }
    };

    const hideMessages = () => {
        if (errorMessageEl) errorMessageEl.classList.add('hidden');
        if (successMessageEl) successMessageEl.classList.add('hidden');
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessages();
            
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const result = await response.json();

                if (response.ok) {
                    window.location.href = '/'; // Redirect to main app
                } else {
                    displayMessage(errorMessageEl, result.error || 'An unknown error occurred.');
                }
            } catch (error) {
                displayMessage(errorMessageEl, 'Could not connect to the server.');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessages();

            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData.entries());

            if (data.password.length < 6) {
                displayMessage(errorMessageEl, 'Password must be at least 6 characters long.');
                return;
            }

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const result = await response.json();

                if (response.ok) {
                    displayMessage(successMessageEl, 'Registration successful! Redirecting to login...', false);
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    displayMessage(errorMessageEl, result.error || 'An unknown error occurred.');
                }
            } catch (error) {
                displayMessage(errorMessageEl, 'Could not connect to the server.');
            }
        });
    }
});