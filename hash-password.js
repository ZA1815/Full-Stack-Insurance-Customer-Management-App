// Created this to test the login for the app
// Run in cmd prompt to use

const bcrypt = require('bcrypt');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Enter the password to hash: ', async (password) => {
    if (!password) {
        console.error('Password cannot be empty.');
        readline.close();
        return;
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('\n--- BCRYPT HASH ---');
        console.log(hashedPassword);
        console.log('-------------------\n');

    } catch (err) {
        console.error('Error hashing password:', err);
    } finally {
        readline.close();
    }
});