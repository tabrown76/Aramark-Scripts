document.addEventListener('DOMContentLoaded', () => {
    const consoleWindow = document.getElementById('consoleWindow');
    const toggle1 = document.getElementById('toggle1');
    const toggle2 = document.getElementById('toggle2');

    if (!consoleWindow || !toggle1 || !toggle2) {
        console.error('One or more required DOM elements are missing.');
        return;
    }

    // Redirect console.log output to the simulated console
    const originalConsoleLog = console.log;
    console.log = function (...args) {
        originalConsoleLog(...args); // Maintain default behavior
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
        ).join(' ');
        const logElement = document.createElement('div');
        logElement.textContent = message;
        consoleWindow.appendChild(logElement);
        consoleWindow.scrollTop = consoleWindow.scrollHeight; // Auto-scroll to the bottom
    };

    // Helper to disable toggles while a script runs
    function setTogglesDisabled(disabled) {
        toggle1.disabled = disabled;
        toggle2.disabled = disabled;
    }

    // Save toggle state to localStorage
    function saveToggleState(toggleId, state) {
        localStorage.setItem(toggleId, state);
    }

    // Load toggle state from localStorage
    function loadToggleState(toggleId) {
        return localStorage.getItem(toggleId) === 'true';
    }

    // Initialize toggles with saved states
    toggle1.checked = loadToggleState('toggle1');
    toggle2.checked = loadToggleState('toggle2');

    // Function to call backend endpoint
    async function callEndpoint(url, setToConcert, toggle) {
        try {
            console.log(`Calling ${url} with setToConcert: ${setToConcert}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setToConcert }),
            });

            const data = await response.json();
            if (response.ok) {
                console.log(data.message);
                saveToggleState(toggle.id, setToConcert);
                console.log(`Concert Pricing is now ${toggle.checked ? 'ON' : 'OFF'}`);
            } else {
                console.error(data.error);
                toggle.checked = !setToConcert; 
            }
        } catch (error) {
            console.error('Error communicating with the server:', error);
            toggle.checked = !setToConcert;
        } finally {
            setTogglesDisabled(false);
        }
    }

    // Event listeners for toggles
    toggle1.addEventListener('change', async () => {
        setTogglesDisabled(true);
        const isChecked = toggle1.checked;

        await callEndpoint('http://localhost:3000/run-jpjm-script', isChecked, toggle1);
        
        saveToggleState('toggle1', isChecked);
        console.log(`Concert Pricing is now ${toggle1.checked ? 'ON' : 'OFF'}`);
    });

    toggle2.addEventListener('change', async () => {
        setTogglesDisabled(true);
        const isChecked = toggle2.checked;

        await callEndpoint('http://localhost:3000/run-apl-script', isChecked, toggle2);

        saveToggleState('toggle2', isChecked);
        console.log(`Concert Pricing is now ${toggle2.checked ? 'ON' : 'OFF'}`);
    });

    // Example initial log
    console.log('Console initialized. Toggles are ready.');
});
