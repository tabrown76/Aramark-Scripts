const express = require('express');
const cors = require ('cors');
const { main: JPJMMain } = require('./JPJMenus');
const { main: APLMain } = require('./AppetizePriceLevels');

const app = express();

app.use(cors());
app.use(express.json());

// Endpoint to run the JPJMenus script
app.post('/run-jpjm-script', async (req, res) => {
    const { setToConcert } = req.body;

    try {
        console.log(`Starting JPJMenus script with setToConcert: ${setToConcert}`);
        await JPJMMain(setToConcert);
        res.status(200).send({ message: 'JPJMenus script executed successfully.' });
    } catch (error) {
        console.error('Error executing JPJMenus script:', error);
        res.status(500).send({ error: 'JPJMenus script execution failed.' });
    }
});

// Endpoint to run the AppetizePriceLevels script
app.post('/run-apl-script', async (req, res) => {
    const { setToConcert } = req.body;

    try {
        console.log(`Starting AppetizePriceLevels script with setToConcert: ${setToConcert}`);
        await APLMain(setToConcert);
        res.status(200).send({ message: 'AppetizePriceLevels script executed successfully.' });
    } catch (error) {
        console.error('Error executing AppetizePriceLevels script:', error);
        res.status(500).send({ error: 'AppetizePriceLevels script execution failed.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
